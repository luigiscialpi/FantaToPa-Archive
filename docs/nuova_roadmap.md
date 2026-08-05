Nota: questo file è una sintesi di lavoro non ufficiale, generata da una sessione
precedente — la fonte di verità resta `piano-sviluppo-fantatopa-archive.md`, sezione 11.
Aggiornato il 2026-08-05 con le decisioni prese in sessione.

**Fase 3 — completamento pannello admin — SALTATA (decisione esplicita utente, 2026-08-04)**
- Pannello import upload → anteprima → conferma: NON verrà costruito per ora. Gli
  import continuano a girare da script da terminale. `import_batches` resta nello
  schema ma inutilizzato (nessun bucket Storage per i file grezzi creato).

**Fase 4 — feature trasversali**
- Albo d'oro, Statistiche, Home personalizzata, **Profilo Squadra** (route dedicata
  `/profilo-squadra`, selettore libero di qualunque squadra): **completate** (vedi
  piano sezione 11).
- Restano da fare: **profilo giocatore multi-stagione**, **ricerca**.

**Profilo Squadra — rifiniture 2026-08-05 (completate)**
- Card "Ultima stagione" rinominata "Storico" (solo in questa pagina, non in Home);
  posizione corrente ora preceduta da "Ultima stagione: N°".
- Bacheca estesa con 2°/3° posto Campionato (oltre a Campionati/Coppe vinti).
- Nuova card "Stagioni disputate": conta `team_seasons` + le stagioni manuali
  2004-05→2012-13 (solo podio in `standings`, mai una riga `team_seasons`) in cui la
  squadra compare — con etichetta "Almeno N" quando ci sono di queste stagioni extra,
  perché resta comunque un minimo (una stagione manuale senza podio per quella
  squadra non lascia traccia recuperabile).
- `StandingSparkline`: con un solo dato storico noto (tipico di una squadra vista solo
  in una stagione manuale) mostra il valore come testo invece di restare vuota (una
  linea richiede ≥2 punti).
- Bug corretto: `AlboDoroList` aveva perso il click-through verso la classifica e il
  disattivo per le stagioni senza calendario reale (`hasSchedule`), presenti invece
  nella galleria stagioni Home — allineato allo stesso pattern.

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
