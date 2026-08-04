# AGENTS.md — Archivio Storico FantaTopa

File letto nativamente da Claude Code e Google Antigravity. GitHub Copilot ha il suo
`.github/copilot-instructions.md`, che rimanda qui invece di duplicare — stessa fonte di
verità, non due documenti da tenere allineati a mano.

Tenuto volutamente corto: questo file è sempre in contesto a ogni sessione, quindi ogni
riga ha un costo fisso ripetuto. Il piano di sviluppo completo vive in
`piano-sviluppo-fantatopa-archive.md`; per non caricarlo tutto ogni volta, usa la skill
`fantatopa-dev` (`.agents/skills/fantatopa-dev/SKILL.md`) che indica quale sezione leggere
in base al task.

## Cos'è

Sito che archivia le stagioni passate di una lega fantacalcio privata. Next.js/React/TS,
Supabase (Postgres+Auth+Storage), Netlify. Archivio riservato ai membri approvati — non
pubblico.

## Pattern non ovvi (il motivo per cui esistono, non solo il "cosa")

- **`standings` non si ricalcola mai automaticamente**: è sempre lo snapshot importato.
  Il confronto con `matches` è un controllo di qualità in fase di import, non un dato
  gemello salvato — due "fonti di verità" nella stessa tabella creano solo ambiguità.
  `points`/`totalFantapoints` in `StandingsImportSchema` sono opzionali apposta: una
  fonte `manual` (nota storica testuale, non un file della lega — vedi 2013-14) può
  conoscere solo la posizione di podio, senza inventare punteggi assenti.
- **`lineup_players` ha solo `voto`/`fantavoto`, niente bonus/malus granulari** (gol,
  assist, cartellini): la fonte xlsx non li riporta. Dove esiste una fonte HTML dedicata
  (Campionato 2025-26, `docs/html/`; Campionato 2017-18, icone in
  `formazioni-N.html` — stesso file già usato per le formazioni), i bonus/malus vivono
  in `player_matchday_bonuses` (chiave `matchday_id, player_id`, non `lineup_player_id`
  — un evento reale non va duplicato se più squadre fantacalcio schierano lo stesso
  giocatore), con derivazione Coppa via `matchday_bonus_sources` (mapping a giornata di
  Campionato, non applicabile al 2017-18: quella Coppa non ha formazioni per giocatore
  in questa fonte). Eccezione 2013-14 (unica stagione senza Campionato a livello di
  piattaforma): la fonte diretta è la Coppa Fase Finale stessa, quindi i bonus vivono
  su quella giornata senza `matchday_bonus_sources` — la query lato UI già ricade su
  `matchdayId` quando manca un mapping, quindi funziona senza altre modifiche. Non
  aggiungere quei campi a `lineup_players` per le stagioni che non
  hanno questa fonte.
- **Lookup table (`competition_kinds`, `import_source_types`...) solo dove c'è
  variabilità già osservata nei dati**, non ovunque per principio — altrove restano
  `check` semplici. Estendibilità mirata, non generalizzata a caso.
- **Niente generazione statica (SSG) per le pagine di stagione**: l'archivio è riservato,
  una pagina pre-renderizzata in build aggirerebbe la RLS. Rendering server-side con la
  sessione utente, sempre.
- **Nav globale persistente (`GlobalNav`, dentro `AppHeader`): Home/Albo d'Oro/
  Statistiche**, distinta dai tab per-stagione (`PageTabs`, solo sotto
  `stagioni/[season]/**`) — Albo d'Oro e Statistiche non sono scoped a una singola
  stagione (la prima mostra tutte le annate insieme, la seconda sceglie stagione/
  competizione al suo interno), quindi sono route top-level (`/albo-doro`,
  `/statistiche`), non pagine sotto `stagioni/[season]/**`. Scelta esplicita
  dell'utente contro il mockup originale, che le metteva come tab per-stagione.
- **`AppHeader` è un unico blocco sticky** (non più barre sticky indipendenti da
  coordinare): riga principale (hamburger mobile a sinistra + brand + selettore
  stagione, quest'ultimo in `variant="compact"` troncato su mobile per non
  affollare) e riga `GlobalNav` sotto. Chi consuma l'altezza dell'header (offset
  sticky di `stagioni/[season]/layout.tsx`, hardcoded in px) va ricalibrato ogni
  volta che l'altezza dell'header cambia — misurare sempre con Playwright
  (`getBoundingClientRect()`), non a occhio.
- **Filtri che innescano una query per ogni singola selezione sono un bug UX, non
  solo un dettaglio**: `StatisticheControls` usa un `<form>` non controllato
  (`defaultValue`, non `value`) con pulsante "Aggiorna" esplicito che legge tutti i
  campi e fa un solo `router.push()`, invece di un `onChange` per select che
  naviga subito. Le select, essendo non controllate, non si "auto-riallineano" ai
  valori risolti dal server dopo un fallback (es. stagione/competizione/squadra non
  trovata) — serve una `key` sul form derivata dai valori effettivi risolti lato
  server, per forzarne il remount.
- **Ingestion: adapter → schema Zod per concern → `SeasonRepository`**: mai scrivere su
  Supabase direttamente da un parser. Un `SeasonRepository` finto in memoria deve poter
  sostituire quello reale nei test, senza rete.
- **L'adapter Formazioni xlsx (`lineup.ts`) legge le colonne home/away come due stream
  indipendenti, mai una coppia sincronizzata riga per riga**: il file salta o aggiunge
  righe (es. "Modificatore difesa" assente se zero, "Fattore campo" solo in Coppa Fase
  Finale) per un solo lato alla volta. Dedurre lo stato di una riga guardando solo la
  cella home (o assumendo che home e away siano sulla stessa riga) ha causato 3 bug reali
  di totali azzerati — qualsiasi nuovo tipo di riga scoperto va riconosciuto ed escluso
  per entrambe le colonne separatamente.
- **Gli adapter `html-legacy/{lineup,roster,calendar,standings}.ts` sono condivisi da
  più stagioni (2014-15, 2016-17, 2017-18) con markup leggermente diverso fra loro
  (minificato vs pretty-printed): un regex reso più rigido per una stagione ha rotto
  silenziosamente il parsing rosa di un'altra già funzionante, mai ri-verificata. La
  stagione 2013-14 usa invece adapter dedicati in
  `html-legacy/2013-14/`, perché il suo markup XHTML non è compatibile con il formato
  flat. Dopo aver toccato uno degli adapter condivisi, controllare `git status`/`git diff
  HEAD` per modifiche staged-ma-non-committate di sessioni precedenti prima di fidarsi
  che siano "pulite", e ri-eseguire l'import delle altre stagioni che condividono
  l'adapter.
- **I crediti residui delle rose legacy hanno fonti esplicite**: `squadre.html` per
  2013-14 e 2014-15, pagine `dettaglio-squadra` per 2016-17 e 2017-18. Non assumere che
  la pagina `dettaglio-rosa` li contenga e non interpretare `teamCredits: []` come
  assenza obbligatoria del dato per queste stagioni. La verifica finale usa
  `verify-import.ts` e controlla il conteggio delle righe `team_seasons` con
  `credits_remaining` non nullo.
- **`matches.away_team_id` è nullable**: i gironi di Coppa con un numero dispari di
  squadre hanno sempre una squadra senza avversario ("solo") quella giornata, sempre
  normalizzata nello slot home. Unicità garantita da un indice parziale
  (`matches_solo_home_team_unique`), non dal vincolo unique a tre colonne (NULL ≠ NULL
  per un unique standard). Qualsiasi nuova query/adapter su `matches` deve gestire
  `away_team_id is null` esplicitamente, non assumere sempre una coppia di squadre.
- **Funzioni Postgres usate in policy RLS: sempre `plpgsql`, mai `sql`** — una funzione
  `sql security definer` può venire inlined dal query planner e perdere il privilegio
  elevato, riportando la ricorsione che dovrebbe evitare.
- **`createClient` e query cross-dominio (`getSeasons`, `getCompetitions`) wrappate in
  `cache()` di React**: layout e page le invocano entrambi nella stessa render request;
  senza `cache()` partirebbero due volte. La cache è per-request (non cross-utente),
  quindi rispetta la RLS. Query di dominio specifiche (classifica, formazioni...) non
  servono in `cache()` perché chiamate da un solo punto.
- **Qualunque query Supabase/PostgREST che può restituire più di 1000 righe va paginata
  esplicitamente con `.range()`**: oltre quella soglia la risposta viene troncata senza
  errore né warning (visto 3 volte: due in `apps/web/lib/queries/home.ts`, una in
  `packages/ingestion/scripts/derive-coppa-lineups.ts` — quest'ultima ha prodotto un
  `defense_modifier` derivato spazzatura passato inosservato da typecheck/lint/test).
  Tabella più a rischio: `lineup_players` (tante righe per poche lineup). Se serve solo
  un conteggio, `{ count: 'exact', head: true }` evita il problema a monte.
- **Ogni route sotto `stagioni/[season]/` ha un `loading.tsx`** con skeleton animato che
  ricalca la struttura della pagina reale. Il layout di stagione (navbar + tab) resta
  visibile durante il caricamento — lo skeleton sostituisce solo `{children}`. Nuove
  pagine di stagione devono avere il proprio `loading.tsx`.
- **Le query più pesanti del pannello squadra in Home sono cacheate cross-richiesta**
  (`lib/queries/home-cache.ts`, `cachedHomeStat`, `unstable_cache`) con invalidazione
  on-demand a fine import (`verify-import.ts` → `revalidate-web-cache.ts` → route
  handler protetto da `REVALIDATE_SECRET`) più un refresh a 1h come rete di sicurezza.
  Dettagli/insidie (Map non serializzabile, config Netlify) nei commenti di
  `home-cache.ts` e `app/api/internal/revalidate-home-stats/route.ts`.
- **"Migliori"/"Peggiori avversari" (home, `getOpponentRecords`) usano punti 3-1-0**
  (vittoria/pareggio/sconfitta), non conteggio grezzo di vittorie: altrimenti una
  squadra con molti pareggi contro un avversario batteva in classifica una squadra con
  un record di vittorie reali. Gli avversari già in top "migliori" sono esclusi dal pool
  dei "peggiori" per `opponentId` (mai per nome, per evitare falsi positivi da
  omonimie) — senza questa esclusione uno stesso avversario, giocato spesso, poteva
  comparire in entrambe le liste contemporaneamente. Un filtro precedente basato sul
  "segno" del record (richiede più sconfitte che vittorie per stare in "peggiori") è
  stato scartato: svuotava la card per una squadra dominante senza nessun record in
  perdita netta contro alcun avversario.
- **"Fuoriclasse della rosa" e "Miglior stagione individuale" condividono gli stessi dati
  grezzi di fantavoto** (`getCampionatoFantavotoRows`, cached) ma aggregano su chiavi
  diverse — per giocatore su tutta la carriera in squadra la prima, per coppia
  giocatore+stagione la seconda — così lo stesso giocatore compare una sola volta nella
  prima (con l'intervallo di stagioni in cui ha giocato) ma può comparire più volte
  nella seconda (una riga per ogni stagione sopra soglia presenze). Le righe delle
  liste sono su due linee (nome+media, poi la stagione/l'intervallo sotto): un
  intervallo di stagioni può essere lungo quanto il nome di un giocatore e su una riga
  sola lo schiacciava fino a troncarlo a 1-2 lettere — verificato solo con screenshot
  reale, non deducibile dal solo albero di accessibilità.
- **"Serie utile più lunga" (home, `getLongestUnbeatenStreak`) porta anche il record di
  vittorie consecutive, calcolato indipendentemente e non necessariamente nella stessa
  stagione** della striscia utile mostrata sopra: le due strisce sono ricavate dagli
  stessi `chronoMatches` già caricati (funzione condivisa `longestStreak` con predicato
  diverso: `points > 0` per la striscia utile, `points === 3` per il record vittorie),
  mai un'unica computazione che assuma che il periodo migliore di "non aver mai perso"
  coincida con quello di "aver sempre vinto".

## Come scrivere codice qui

Skill `ponytail` (personale, generica — non vive in questo repo, riusabile in altri
progetti): non scrivere codice nuovo se riuso, stdlib, piattaforma o una dipendenza già
installata bastano; bug fix sulla causa comune, non sul sintomo; niente astrazioni non
richieste; semplificazioni intenzionali marcate con commento `ponytail:` che nomina il
limite e il percorso di upgrade. Le eccezioni/istanze specifiche di questo progetto
(`SeasonRepository`, adapter, lookup table mirate, script investigativi one-off) sono
nella skill `fantatopa-dev`, non qui.

## Convenzioni

- TypeScript `strict: true`. Mai `any` (ESLint `@typescript-eslint/no-explicit-any: error`).
  Tipo sconosciuto per davvero → `unknown` + narrowing, non `any`. I tipi vengono da
  `z.infer<...>` (Zod) o da `supabase gen types typescript`, non si scrivono a mano.
- Un componente = un file. ~200-250 righe è una soglia di attenzione da rivedere in
  review, non un limite imposto meccanicamente. Cartelle per dominio
  (`components/classifica/`, non un `components/` piatto).
- Import relativi: **mai** suffisso `.js` in `apps/web/**` (il bundler Next.js non lo
  risolve verso il file sorgente `.ts`/`.tsx` sibling, "Module not found" in `next build`
  anche se `tsc --noEmit` passa), **sempre** in `packages/ingestion/**` (gira via `tsx`/
  Node ESM diretto, senza bundler, che richiede il suffisso). Stessa regola per
  `@fantatopa/shared-types/database`.
- Migrazioni Supabase sempre in `supabase/migrations/`, mai modifiche a mano da Studio
  senza poi catturarle con `supabase db pull`.

## Sicurezza — non negoziabile

- `SUPABASE_SERVICE_ROLE_KEY` solo negli script di ingestion server-side, mai nel client/
  bundle browser.
- Un solo progetto Supabase e un solo sito Netlify, nessuna distinzione staging/prod:
  migrazioni e import lanciati dal laptop toccano subito ciò che vedono gli utenti reali.
- Mai committare segreti reali, nemmeno in file di esempio.

## Comandi utili

- `npm run typecheck` / `npm run lint` / `npm run test` — da far girare prima di
  proporre una modifica come conclusa.
- `supabase db reset` — riapplica le migrazioni in locale, pulito.
