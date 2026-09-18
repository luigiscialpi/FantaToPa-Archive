// Whitelist delle uniche tabelle su cui l'assistente può generare query.
// Escluse deliberatamente, indipendentemente dalla loro RLS: profiles,
// registration_requests, import_batches, import_source_types, admin_edits,
// documents, document_versions — sono tabelle operative/di audit o contenuti
// editoriali dell'admin, non dati statistici della lega.
export const TABELLE_AMMESSE = [
  'seasons',
  'teams',
  'team_aliases',
  'team_seasons',
  'competition_kinds',
  'competition_formats',
  'competitions',
  'roles',
  'players',
  'player_aliases',
  'player_roles',
  'rosters',
  'matchdays',
  'matches',
  'lineups',
  'lineup_players',
  'standings',
  'market_values',
  'bonus_kinds',
  'player_matchday_bonuses',
  'matchday_bonus_sources',
] as const;

// Descrizione schema passata al prompt Gemini. Include SOLO le colonne
// rilevanti per domande statistiche (non tutte le colonne esistenti).
export const DESCRIZIONE_SCHEMA = `
seasons(id, slug, label, starts_on, ends_on)
teams(id, canonical_name, slug) — identità stabile di una squadra nel tempo
team_aliases(id, team_id, alias_normalized) — varianti del nome nel tempo
team_seasons(id, team_id, season_id, manager_name, display_name, credits_remaining)
  — display_name è il nome USATO DAVVERO in quella stagione (può differire da
  teams.canonical_name, es. una squadra rinominata); se display_name è NULL usa
  teams.canonical_name come fallback.
competitions(id, season_id, parent_competition_id, name, kind_code, format_code)
competition_kinds(code, label) — es. 'campionato', 'coppa_girone'
roles(code, label) — ruoli Mantra: Por, Dc, Ds, Dd, B, E, M, C, W, T, A, Pc
players(id, canonical_name, slug)
player_aliases(id, player_id, alias_normalized)
rosters(season_id, team_id, player_id, real_team, cost)
matchdays(id, competition_id, number, label)
matches(id, matchday_id, home_team_id, away_team_id, home_score, away_score,
  home_result_points, away_result_points, home_goals, away_goals)
  — home_score/away_score = fantapunti squadra di QUELLA partita (non
  cumulativo: per un totale su più giornate vanno sommati).
  home_result_points/away_result_points = punti classifica di quella partita
  (0, 1 o 3).
  away_team_id può essere NULL (giornata con numero di squadre dispari):
  gestiscilo con attenzione nei JOIN, non assumere che sia sempre presente.
lineups(id, match_id, team_id, formation)
lineup_players(id, lineup_id, player_id, slot, voto, fantavoto, counts_for_total)
  — IMPORTANTE: quando sommi fantavoto per calcolare un totale squadra da
  lineup_players, filtra SEMPRE counts_for_total = true, altrimenti includi
  panchinari che non hanno contribuito al punteggio reale. Per un totale
  squadra su una singola partita esiste già matches.home_score/away_score:
  usa quello invece di risommare da lineup_players quando possibile, è la
  fonte più diretta e meno soggetta a errori di JOIN.
standings(id, competition_id, team_id, position, played, won, drawn, lost,
  goals_for, goals_against, goal_diff, points, total_fantapoints)
  — è lo snapshot FINALE importato di una competizione, unica fonte di
  verità per "classifica a fine competizione". Per un intervallo PARZIALE di
  giornate (es. "nelle ultime 5 giornate") questa tabella non basta: va
  derivato sommando da matches, perché standings è sempre e solo il finale.
market_values(season_id, player_id, role_code, real_team, initial_quote, current_quote)
bonus_kinds(code, label) — es. 'gol_fatto', 'assist', 'ammonizione'
player_matchday_bonuses(matchday_id, player_id, kind_code)
  — eventi bonus/malus per singolo giocatore in una giornata di Campionato.
matchday_bonus_sources(matchday_id, source_matchday_id)
  — collega una giornata di Coppa alla giornata di Campionato con gli stessi
  eventi reali, per derivare bonus di Coppa via JOIN.

Per identificare una squadra o un giocatore per nome, fai sempre riferimento a
teams/team_aliases o players/player_aliases (con un JOIN o una sottoquery), mai
un confronto testuale diretto su una stringa scritta a mano: i nomi non sono
scritti in modo coerente in tutte le stagioni.
`.trim();
