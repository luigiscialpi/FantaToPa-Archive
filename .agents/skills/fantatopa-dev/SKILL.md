---
name: fantatopa-dev
description: Guida allo sviluppo dell'Archivio Storico FantaTopa (Next.js/TS/Supabase). Usa SEMPRE questa skill quando si lavora su schema dati, migrazioni, RLS, adapter di ingestion (xlsx/OCR), pagine Classifica/Formazioni/Statistiche/Albo d'Oro, o quando serve una decisione già presa nel piano invece di reinventarla. Fai scattare questa skill anche per domande generiche tipo "perché è fatto così" o "dove va questo codice" su questo progetto.
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
