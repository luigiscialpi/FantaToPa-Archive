Nota: questo file è una sintesi di lavoro non ufficiale, generata da una sessione
precedente — la fonte di verità resta `piano-sviluppo-fantatopa-archive.md`, sezione 11.
Aggiornato il 2026-08-04 con le decisioni prese in sessione.

**Fase 3 — completamento pannello admin — SALTATA (decisione esplicita utente, 2026-08-04)**
- Pannello import upload → anteprima → conferma: NON verrà costruito per ora. Gli
  import continuano a girare da script da terminale. `import_batches` resta nello
  schema ma inutilizzato (nessun bucket Storage per i file grezzi creato).

**Fase 4 — feature trasversali**
- Albo d'oro, Statistiche, Home personalizzata: **completate** (vedi piano sezione 11).
- Restano da fare: **profilo giocatore multi-stagione**, **profilo squadra storico**, **ricerca**.

**Fase 5 — CHIUSA, non più un gap (2026-08-04, verificato nel piano)**
- Calendario gironi di Coppa 2020-21/2021-22 (solo immagini): risolto SENZA OCR.
  L'utente ha letto a mano i punteggi dagli screenshot; `derive-coppa-lineups.ts` li
  ha usati per derivare formazioni/modificatori dal Campionato della stessa settimana.
  Il banner `DataGapNotice` sparisce da solo (data-driven). Nessuna azione residua.

**Fase 7 — non iniziata**
- Bonus/malus granulari per le 5 stagioni "intermedie" (2020-21 → 2024-25, classico/mantra) da fantacalcio.it — analisi di fattibilità già fatta in bonus-storici-fantacalcio-it.md, ma resta da verificare se esiste uno storico per-giornata o solo pagine per-giocatore prima di scrivere l'adapter.

**Altre due note aperte non in roadmap ufficiale ma segnalate nelle mie note repo:**
- `calendario.ts` per Coppa Girone A/B (formula 1) probabilmente mostra ancora "falsa sfida" 1v1 come faceva Formazioni prima del fix — mai sistemato, solo segnalato.
- Mappatura `matchday_bonus_sources` per Coppa 2022-23/2023-24/2024-25 non popolata (dipende dalla Fase 7).
