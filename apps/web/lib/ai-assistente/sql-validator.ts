import { Parser, type AST } from 'node-sql-parser';
import { TABELLE_AMMESSE } from './schema-context';

const parser = new Parser();
const DIALETTO = 'PostgresQL';

// Denylist di funzioni note per essere pericolose (DoS, lettura filesystem,
// connessioni di rete, lettura di configurazione). Non è la difesa primaria —
// la tabella whitelist e la transazione read-only del Passo 2 lo sono — è uno
// strato in più per una classe di rischio che né l'una né l'altra coprono da
// sole (vedi commento più sotto su cosa copre ciascun controllo).
const FUNZIONI_VIETATE = [
  'pg_sleep',
  'dblink',
  'lo_import',
  'lo_export',
  'lo_get',
  'lo_put',
  'pg_read_file',
  'pg_read_binary_file',
  'pg_ls_dir',
  'pg_terminate_backend',
  'pg_cancel_backend',
  'pg_reload_conf',
  'set_config',
  'current_setting',
  'copy',
];

export class QueryNonValidaError extends Error {}

/**
 * Valida una stringa SQL generata da Gemini e restituisce una versione
 * eseguibile in sicurezza, oppure lancia QueryNonValidaError con un motivo
 * specifico. Non modifica MAI una query per renderla accettabile: la rifiuta
 * per intero, sempre — non esiste un percorso che esegue una query parzialmente
 * validata.
 */
export function validaEWrappa(sqlGenerata: string): string {
  const opt = { database: DIALETTO };

  // Rimuovi punto e virgola terminale e spazi bianchi
  const sqlPulita = sqlGenerata.trim().replace(/;+$/, '').trim();

  let ast;
  try {
    ast = parser.astify(sqlPulita, opt);
  } catch (e) {
    throw new QueryNonValidaError(
      `SQL non valida sintatticamente: ${(e as Error).message}`
    );
  }

  // Se astify restituisce un array (ad es. per via di punto e virgola o statement multipli):
  // se c'è un solo statement lo estraiamo; se sono più di uno rifiutiamo.
  const astSingolo: AST = (() => {
    if (Array.isArray(ast)) {
      if (ast.length === 1 && ast[0]) {
        return ast[0];
      } else if (ast.length > 1) {
        throw new QueryNonValidaError('Più di uno statement SQL nella stessa richiesta.');
      } else {
        throw new QueryNonValidaError('Nessuno statement SQL trovato.');
      }
    }
    return ast;
  })();

  if (astSingolo.type !== 'select') {
    throw new QueryNonValidaError(`Tipo di statement non ammesso: ${astSingolo.type}`);
  }

  // Una funzione chiamata al posto di una tabella in FROM/JOIN (es. "FROM
  // qualche_funzione()") è INVISIBILE al controllo whitelist sotto — verificato
  // empiricamente: tableList() non la conta come tabella referenziata, quindi
  // whiteListCheck() non avrebbe nulla da rifiutare. Va intercettata qui,
  // ispezionando direttamente astSingolo.from.
  const fromClause = (astSingolo as { from?: unknown[] }).from ?? [];
  const contieneFunzioneInFrom = fromClause.some((voce) => {
    const v = voce as { expr?: { type?: string } };
    return v?.expr?.type === 'function';
  });
  if (contieneFunzioneInFrom) {
    throw new QueryNonValidaError('Chiamata a funzione nel FROM/JOIN non ammessa.');
  }

  const tabelle = parser.tableList(sqlPulita, opt);
  if (tabelle.length === 0) {
    throw new QueryNonValidaError('Nessuna tabella reale referenziata.');
  }

  // Estrai eventuali CTE definite con la clausola WITH (es. WITH mia_cte AS (...))
  // per ammetterle come tabelle/alias legittimi nei riferimenti della query.
  // Le tabelle referenziate DENTRO la CTE vengono comunque controllate e
  // devono appartenere a TABELLE_AMMESSE.
  const astWith = (astSingolo as { with?: Array<{ name?: { value?: string } }> }).with ?? [];
  const nomiCte = astWith.map((item) => item?.name?.value).filter(Boolean) as string[];
  const whitelistEffettiva = [
    `^select::(null|public)::(${[...TABELLE_AMMESSE, ...nomiCte].join('|')})$`,
  ];

  // whiteListCheck ricorre correttamente anche dentro subquery in FROM e in
  // WHERE (verificato empiricamente) — copre il caso di una tabella vietata
  // nascosta in una sottoquery, non solo nel FROM di primo livello.
  try {
    parser.whiteListCheck(sqlPulita, whitelistEffettiva, { ...opt, type: 'table' });
  } catch (e) {
    throw new QueryNonValidaError(`Tabella non ammessa: ${(e as Error).message}`);
  }

  // Copre: (a) funzioni note pericolose in QUALUNQUE posizione della query
  // (SELECT list, WHERE, subquery — non solo FROM), cosa che il controllo
  // tabelle sopra non vede perché riguarda funzioni, non tabelle; (b) come
  // rete aggiuntiva, resta valido anche se in futuro qualcuno aggiunge una
  // tabella "esca" con lo stesso nome di una funzione pericolosa (scenario
  // remoto, ma il controllo non costa nulla).
  const testoLower = sqlPulita.toLowerCase();
  const funzioneVietata = FUNZIONI_VIETATE.find((fn) =>
    testoLower.includes(fn.toLowerCase())
  );
  if (funzioneVietata) {
    throw new QueryNonValidaError(`Funzione non ammessa: ${funzioneVietata}`);
  }

  // Esegui SEMPRE la versione ricostruita dall'AST (sqlify), MAI il testo
  // originale: qualunque stranezza di formattazione o commento che il parser
  // abbia tollerato ma non abbia portato nell'AST viene eliminata dalla
  // ricostruzione, invece di restare nel testo che poi arriva a Postgres.
  const sqlCanonica = parser.sqlify(astSingolo, opt);

  return `SELECT * FROM (${sqlCanonica}) AS _assistente_query LIMIT 200`;
}
