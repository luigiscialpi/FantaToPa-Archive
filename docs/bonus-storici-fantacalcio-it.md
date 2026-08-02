# Bonus/malus storici da fantacalcio.it (2020-21 → 2024-25) — analisi e piano

> Analisi di fattibilità e piano di sviluppo per estendere l'ingestion di bonus/malus
> granulari (gol, assist, cartellini, rigori...) alle 5 stagioni classico/mantra che
> oggi hanno solo voto/fantavoto da xlsx: 2020-21, 2021-22, 2022-23, 2023-24, 2024-25.
> **Non ancora implementato** — richiamato come sviluppo futuro in
> `piano-sviluppo-fantatopa-archive.md`, sezione 11 (Roadmap). Sezione 7.1 dello stesso
> piano descrive l'architettura già esistente per il 2025-26 e il 2017-18, riusata qui
> senza modifiche.

## Indice

1. [Contesto](#1-contesto)
2. [Cosa esiste già (riuso totale)](#2-cosa-esiste-già-riuso-totale)
3. [La domanda "API vs pagina intera"](#3-la-domanda-api-vs-pagina-intera)
4. [Percorso A vs Percorso B](#4-percorso-a-vs-percorso-b)
5. [Coppa: stato di `matchday_bonus_sources` per stagione](#5-coppa-stato-di-matchday_bonus_sources-per-stagione)
6. [Domande aperte / verifica in corso](#6-domande-aperte--verifica-in-corso)
7. [Linee di sviluppo](#7-linee-di-sviluppo)
8. [File coinvolti](#8-file-coinvolti)

## 1. Contesto

Richiesta originale: a partire da pagine come
`fantacalcio.it/serie-a/squadre/atalanta/muriel/507/2020-21` (riepilogo stagionale di un
giocatore reale), derivare bonus/malus per giornata e aggiungerli alle formazioni già
importate, per le stagioni che oggi ne sono prive. Contestualmente, la domanda se
convenga usare un'eventuale API invece di caricare pagine intere, per ridurre il costo in
token dell'analisi.

Le 5 stagioni classico/mantra 2020-21, 2021-22, 2022-23, 2023-24, 2024-25 hanno
formazioni con voto/fantavoto (da xlsx) ma nessun bonus/malus granulare. 2025-26 e
2017-18 hanno già questa granularità da fonti HTML dedicate (piano principale, sezione
7.1); il 2018-19 non ha formazioni per giocatore in nessuna fonte disponibile (gap di
fonte, non di importazione — non in scope qui).

## 2. Cosa esiste già (riuso totale)

`bonus_kinds` / `player_matchday_bonuses` / `matchday_bonus_sources`,
`BonusImportSchema`, il contratto `SourceAdapter<BonusImport>`,
`SeasonRepository.upsertMatchdayBonuses` e il join lato frontend sono **già generici** e
già usati da due fonti diverse (HTML "Voti" 2025-26, HTML legacy 2017-18 — piano
principale, sezione 7.1). Una terza fonte richiede solo un nuovo adapter + uno script di
orchestrazione: **zero modifiche a schema, loader o frontend**.

`upsertMatchdayBonuses` risolve ogni `playerName` tramite `resolvePlayerId`, lo stesso
meccanismo di alias già usato per l'import xlsx — mismatch di formattazione nome
(accenti, ordine cognome/nome, abbreviazioni) sono attesi e si risolvono con lo stesso
meccanismo già rodato, non serve una pipeline nuova.

### Luoghi nel codice da consultare

- `packages/ingestion/adapters/html-voti/bonus.ts` — riferimento diretto per il Percorso
  A (sezione 4): `LABEL_TO_CODE`, regex di riga giocatore, dedup per nome con controllo
  di coerenza.
- `packages/ingestion/adapters/html-legacy/bonus.ts` — riferimento per il pattern
  "fail-loud su etichetta sconosciuta" e riuso di regex già provate (`lineup.ts`).
- `packages/ingestion/schema/imports.ts` — `BonusImportSchema`/`BonusPlayerImportSchema`,
  deliberatamente source-agnostic (nessuna modifica prevista).
- `packages/ingestion/loader/supabase-season-repository.ts` — `upsertMatchdayBonuses` e
  `resolvePlayerId` (riuso diretto, nessuna modifica prevista).
- `packages/ingestion/scripts/import-bonus-2025-26.ts` e `import-bonus-2017-18.ts` —
  pattern di orchestrazione da ricalcare.
- `packages/ingestion/scripts/derive-coppa-lineups.ts` — `linkMatchdaySource`, pattern
  da riusare per la mappatura Coppa (sezione 5).
- `packages/ingestion/scripts/import-season.ts` / `season-configs.ts` — pattern
  "script generalizzato parametrizzato su stagione" da seguire per il nuovo script.
- `apps/web/lib/queries/formazioni.ts` — già risolve `matchday_bonus_sources` con
  fallback silenzioso (nessuna riga = nessun bonus mostrato); nessuna modifica prevista.
- `apps/web/components/formazioni/PlayerRow.tsx` — mappa `code -> emoji`; eventuale
  nuova voce solo se emerge un `bonus_kinds` non ancora visto (stesso precedente di
  `assist_fermo`, migrazione `20260802120000`).

## 3. La domanda "API vs pagina intera"

Sulle pagine esplorate esiste un solo riferimento concreto ad API:
`/api/v1/Excel/playerDetail/{id}/{playerId}/{n}` sulla pagina giocatore e
`/api/v1/Excel/votes/{id}/{giornata}` sulla pagina "Voti" aggregata. Entrambi sono
**dietro login** ("Accedi per utilizzare questa funzionalità") e servono un export
Excel, non JSON — non perseguibili senza account e senza bypassare un gate di
autenticazione di terze parti: **scartati**.

Nessun altro endpoint JSON non autenticato è stato individuato durante l'analisi (fatta
solo caricando pagine intere via fetch testuale, senza un ispettore di rete/XHR
disponibile in quella fase). La vera leva di efficienza non è quindi "API vs pagina" ma
**quale pagina** caricare (sezione 4): una pagina aggregata per giornata costa un ordine
di grandezza meno richieste di una pagina per giocatore.

**Nota sul costo in token**: irrilevante a runtime. Lo script di ingestion gira in Node
fuori dalla chat — un `fetch()` diretto non passa mai dal modello, indipendentemente da
quale fonte si scelga. Il costo in token esiste solo nella fase di *analisi/sviluppo
assistito* (pagine cariche di banner cookie/nav/footer ripetuti), non nell'esecuzione
dello script finale.

## 4. Percorso A vs Percorso B

### Percorso A — pagina aggregata per giornata (preferito)

Una pagina per giornata di Campionato con tutte le squadre/giocatori insieme (es.
`fantacalcio.it/voti-fantacalcio-serie-a`), il cui markup osservato sembra identico a
quello già gestito da `HtmlVotiBonusAdapter`.

- **Vantaggi**: ~38 richieste/stagione (una per giornata); riuso quasi diretto di codice
  già scritto e testato; nessun bisogno di enumerare i giocatori uno a uno.
- **Limiti**: non ancora confermato che esista uno storico stagioni raggiungibile da
  questa pagina (oggi mostra solo la giornata corrente) — verifica in corso, sezione 6.

### Percorso B — pagina per giocatore (fallback, proposta originale)

Una pagina per giocatore con il riepilogo dell'intera stagione (es. la pagina Muriel
citata in apertura).

- **Vantaggi**: i dati testuali non sembrano dietro login (solo l'export Excel lo è);
  copre comunque tutti i giocatori se enumerati correttamente.
- **Limiti**: ~250-300 richieste/stagione (una per giocatore reale apparso quella
  stagione); serve costruire un **player directory** per stagione (nome → id numerico
  fantacalcio.it, necessario per costruire l'URL — da NON indovinare, va enumerato da
  una pagina squadra/rosa/quotazioni); lo script di orchestrazione deve invertire la
  matrice (dati per-giocatore-tutte-le-giornate → per-giornata-tutti-i-giocatori) prima
  di poter chiamare `upsertMatchdayBonuses`, che si aspetta il secondo formato.

Il Percorso B resta pianificato per intero (non solo menzionato) nel caso la verifica
in sezione 6 escluda il Percorso A.

## 5. Coppa: stato di `matchday_bonus_sources` per stagione

| Stagione | Formazioni Coppa | `matchday_bonus_sources` | Azione richiesta |
|---|---|---|---|
| 2020-21 | Derivate dal Campionato (`derive-coppa-lineups.ts`) | Già popolata (derivata) | Nessuna: import bonus di Campionato basta, la Coppa li eredita via join |
| 2021-22 | Derivate dal Campionato (`derive-coppa-lineups.ts`) | Già popolata (derivata) | Nessuna, come sopra |
| 2022-23 | Reali, da xlsx proprio | Mai popolata | Conferma manuale utente giornata Coppa ↔ giornata Campionato, poi popolare (sezione 7, fase 6) |
| 2023-24 | Reali, da xlsx proprio | Mai popolata | Come sopra |
| 2024-25 | Reali, da xlsx proprio | Mai popolata | Come sopra |

La mappatura per 2022-23/2023-24/2024-25 è stata esplicitamente richiesta in scope per
questo piano (non rimandata a un secondo momento).

## 6. Domande aperte / verifica in corso

- **Bloccante per la scelta tra Percorso A e B**: esiste uno storico per-giornata (tutte
  le squadre insieme) per le stagioni 2020-21…2024-25, analogo a quello del 2025-26?
  Verifica in corso lato utente (browser, Network tab + eventuale selettore stagione).
  Se sì: annotare l'URL esatto e se richiede login.
- Se anche lo storico per-giornata risultasse dietro login (diversamente dalla pagina
  attuale, pubblica) → si ricade comunque sul Percorso B.
- Rate limiting esatto del sito non noto a priori — approccio conservativo di default
  (qualche centinaio di ms tra richieste), da aggiustare se emergono blocchi/429 durante
  il pilota.
- Rollout (una stagione pilota poi generalizzare, coerente con come sono state
  introdotte tutte le altre fonti in questo repo, vs. tutte e 5 da subito): non ancora
  deciso, da scegliere quando si passa dall'analisi all'esecuzione.

## 7. Linee di sviluppo

0. **Verifica sorgente** (in corso) — determina Percorso A vs B (sezioni 4, 6).
1. **Adapter**: Percorso A, variante leggera di `html-voti/bonus.ts` (fetch live + cache
   su disco invece di file già salvati, `LABEL_TO_CODE` proprio verificato sui label
   reali della fonte); Percorso B, nuovo adapter per-giocatore + player directory +
   inversione della matrice prima di `upsertMatchdayBonuses`.
2. **Vocabolario bonus e nomi** (in parallelo al punto 1): catalogare le etichette reali
   di un campione (1-2 giornate o 3-5 giocatori) della stagione pilota, mapparle su
   `bonus_kinds.code` esistenti; etichetta mai vista → nuova entry in `bonus_kinds`
   (stessa procedura di `assist_fermo`), mai un code inventato al volo; estendere
   `PlayerRow.tsx` solo se serve.
3. **Verifica numerazione giornata** (indipendente): confermare che "giornata N" reale
   di Serie A coincida 1:1 con "giornata N" del nostro Campionato per ciascuna delle 5
   stagioni (spot-check contro `calendario`/`matches` già importati); se emergono
   disallineamenti (rinvii/recuperi), serve una mappatura esplicita.
4. **Orchestrazione**: script parametrizzato su stagione (stesso spirito di
   `import-season.ts`/`season-configs.ts`), fetch con rate-limit conservativo, cache
   delle pagine grezze su disco (stesso principio "i file grezzi restano la fonte di
   verità" già seguito per xlsx/HTML legacy), poi `upsertMatchdayBonuses` per giornata.
   Idempotenza già garantita dal delete+insert esistente.
5. **Pilota + validazione**: una stagione prima delle altre 4 (proposta: 2024-25, la più
   recente delle mancanti); conteggio giornate/giocatori/bonus comparabile a 2025-26
   (~230/giornata) o 2017-18 (~144/giornata); spot-check qualitativo contro la pagina
   reale; nuove fixture di test (`__fixtures__/`, stesso pattern del 2017-18).
   Generalizzazione alle altre 4 stagioni dopo validazione.
6. **Mappatura Coppa 2022-23/2023-24/2024-25** (indipendente dai punti 1-5): conferma
   manuale utente giornata Coppa ↔ Campionato per ciascuna delle 3 stagioni (stesso
   schema già usato per il 2025-26), popolare `matchday_bonus_sources` con uno script
   one-off nello stile di `linkMatchdaySource` (mappatura è dato, non logica riusabile).
   Nessuna modifica frontend necessaria.

## 8. File coinvolti

- `packages/ingestion/adapters/html-voti/bonus.ts` — riferimento Percorso A
- `packages/ingestion/adapters/html-legacy/bonus.ts` — riferimento label-mapping fail-loud
- `packages/ingestion/schema/imports.ts` — nessuna modifica prevista
- `packages/ingestion/loader/supabase-season-repository.ts` — riuso diretto
- `packages/ingestion/scripts/import-bonus-2025-26.ts`, `import-bonus-2017-18.ts` — pattern orchestrazione
- `packages/ingestion/scripts/derive-coppa-lineups.ts` — pattern mappatura Coppa
- `packages/ingestion/scripts/season-configs.ts` — eventuale nuovo campo opzionale per config fonte bonus-web
- `supabase/migrations/20260802120000_bonus_kinds_assist_fermo.sql` — precedente da
  ricalcare se emergono nuovi `bonus_kinds`
- `apps/web/lib/queries/formazioni.ts` — nessuna modifica prevista
- `apps/web/components/formazioni/PlayerRow.tsx` — eventuale nuova emoji
