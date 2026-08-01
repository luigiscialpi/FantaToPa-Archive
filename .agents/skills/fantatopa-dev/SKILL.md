---
name: fantatopa-dev
description: Guida allo sviluppo dell'Archivio Storico FantaTopa (Next.js/TS/Supabase). Usa SEMPRE questa skill quando si lavora su schema dati, migrazioni, RLS, adapter di ingestion (xlsx/OCR), pagine Classifica/Formazioni/Statistiche/Albo d'Oro, o quando serve una decisione già presa nel piano invece di reinventarla. Fai scattare questa skill anche per domande generiche tipo "perché è fatto così" o "dove va questo codice" su questo progetto, o quando la skill generica `ponytail` lascia un dubbio su un'eccezione/istanza specifica di questo repo (astrazioni pre-decise, script investigativi one-off).
---

# FantaTopa — router verso il piano

Il piano di sviluppo completo (`piano-sviluppo-fantatopa-archive.md`, root del repo) è
lungo di proposito — è il registro di ogni decisione presa e perché. Caricarlo tutto per
ogni task spreca contesto. Questa skill dice quale sezione leggere in base a cosa stai
facendo, così apri solo quella.

**Nota**: finché il piano vive in un unico file, questa skill punta a sezioni via
numero/titolo. Se in futuro viene diviso in `docs/` (probabile una volta che la repo
cresce — vedi sezione 14 del piano sulla modularità), questa skill va aggiornata per
puntare ai file giusti invece che alle sezioni.

## Router per task

| Stai lavorando su... | Leggi |
|---|---|
| Nuova tabella, modifica schema, migrazione | Sezione 6 (Modello dati) |
| Import di una stagione, parser xlsx, alias squadre/giocatori | Sezione 7 (Pipeline di ingestion) |
| Bonus/malus per giornata (gol, assist, cartellini...) | Sezione 7.1 |
| Dati legacy da sito HTML vecchio (mirror scaricato, non immagine) | Sezione 7.2 |
| Dati legacy in immagine, OCR | Sezione 8 |
| Login, registrazione, RLS, ruoli | Sezione 9 (Autenticazione) |
| Qualsiasi pagina (Classifica, Formazioni, Statistiche, Albo d'Oro, Home) | Sezione 10 — include la mappa pagine completa e le decisioni UX già prese |
| Palette, componenti UI, mobile | Sezione 10 + il mockup React (`fantatopa-mockup.jsx` se presente nel repo/conversazione) come riferimento visivo vivente |
| "Perché non c'è ancora X" / cosa manca prima di iniziare | Sezione 14 (checklist pre-avvio) |
| Cosa fare adesso, a che fase siamo | Sezione 11 (Roadmap) |

## Se la sezione non basta

Il piano ha una sezione "Domande aperte" (12) per le cose non ancora decise. Se un task
richiede una decisione che non è né nel piano né ovvia dal codice esistente, quella è la
domanda da fare all'utente — non va inventata una risposta plausibile e portata avanti
come se fosse decisa.

## Query Supabase: mai a mano nei componenti

Se il task tocca dati (classifica, rose, formazioni...), la query non va scritta ad-hoc
nel componente React. Va in `apps/web/lib/queries/<dominio>.ts`, e ritorna un tipo di
dominio (non la riga grezza di Supabase) — vedi sezione 6, nota su Dependency Inversion.

## `ponytail` applicato qui

La skill `ponytail` (personale, generica, non versionata in questo repo) copre la
filosofia "lazy senior dev". Queste sono le eccezioni/istanze concrete negoziate per
questo progetto — quando sembrano in conflitto con una regola generica di `ponytail`,
queste vincono:

- **"Fewest files possible" e "un componente = un file" (AGENTS.md) non sono in
  tensione.** La seconda regola definisce il confine naturale (un file per
  componente/concern). La prima vieta di andare *oltre* quel confine — niente
  `Component.types.ts` + `Component.constants.ts` + `Component.utils.ts` per un
  componente che non lo richiede. Nessuna delle due dice "accorpa cose diverse per
  avere meno file."
- **"No abstractions that weren't explicitly requested" non si applica a
  `SeasonRepository`, agli adapter di ingestion, o alle lookup table
  (`competition_kinds`, `import_source_types`...).** Quelle astrazioni sono già la
  richiesta esplicita: negoziate e decise nel piano (sezioni 6-7), non lasciate alla
  discrezione di chi tocca il codice in quel momento. Lazy qui vuol dire non
  aggiungerne altre non richieste, non smontare quelle già concordate perché "si
  potrebbe scrivere con meno codice".
- **Script investigativi one-off** (il pattern generico è in `ponytail`): qui vuol
  dire `packages/ingestion/scripts/tmp-*.ts` che riusa gli adapter/schema già
  esistenti (mai reimplementare il parsing xlsx per un controllo estemporaneo),
  eseguito una volta contro i file/il DB reali, poi eliminato — mai un tool
  permanente per un dubbio one-off. Validato più volte su dati reali: alias
  "Marin R." (2024-25), Milinkovic-Savic/Bastoni (2021-22), "Radu" (2020-21).
- **Esempio concreto di commento `ponytail:` in questo stack**: un parser che assume
  un solo layout di colonne per un xlsx e non gestisce varianti mai viste —
  `// ponytail: layout fisso, non gestisce varianti xlsx non ancora osservate
  (sezione 7 del piano)`.
