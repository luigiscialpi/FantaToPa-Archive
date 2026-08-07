// apps/web/lib/queries/admin-seasons.ts
//
// Query di supporto per la sezione admin "Stagioni": stesso principio di
// getSeasons (AGENTS.md, query mai nei componenti), con in più quante
// squadre hanno già una riga di classifica Campionato — per capire a colpo
// d'occhio quali stagioni (es. le manuali 2004-05→2012-13) sono da
// completare invece di aprirle una per una.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@fantatopa/shared-types/database';
import { getSeasons, getCompetitions, type SeasonOption } from './seasons';

type TypedSupabaseClient = SupabaseClient<Database>;

export type SeasonAdminOverview = SeasonOption & {
  campionatoStandingsCount: number;
  // Non esposto da getSeasons (pagine pubbliche non ne hanno bisogno): serve
  // solo qui per precompilare il form "Modifica stagione".
  startsOn: string | null;
};

export async function getSeasonsAdminOverview(supabase: TypedSupabaseClient): Promise<SeasonAdminOverview[]> {
  const seasons = await getSeasons(supabase);

  const { data: startsOnRows, error: startsOnError } = await supabase.from('seasons').select('id, starts_on');
  if (startsOnError) {
    throw new Error(`Impossibile leggere le date di inizio: ${startsOnError.message}`);
  }
  const startsOnById = new Map(startsOnRows.map((row) => [row.id, row.starts_on]));

  return Promise.all(
    seasons.map(async (season): Promise<SeasonAdminOverview> => {
      const competitions = await getCompetitions(supabase, season.id);
      const campionato = competitions.find((competition) => competition.kindCode === 'campionato');
      if (!campionato) {
        return { ...season, campionatoStandingsCount: 0, startsOn: startsOnById.get(season.id) ?? null };
      }

      const { count, error } = await supabase
        .from('standings')
        .select('id', { count: 'exact', head: true })
        .eq('competition_id', campionato.id);

      if (error) {
        throw new Error(`Impossibile contare la classifica di ${season.slug}: ${error.message}`);
      }

      return { ...season, campionatoStandingsCount: count ?? 0, startsOn: startsOnById.get(season.id) ?? null };
    }),
  );
}

export type KnownTeamOwner = {
  ownerName: string;
  teamId: string;
  teamName: string;
};

// Proprietari già noti: un proprietario mantiene lo stesso team_id anche se
// rinomina la squadra da una stagione all'altra — usato in "Aggiungi squadra
// alla classifica"/"Aggiungi vincitore Coppa" per risolvere l'identità
// corretta selezionando la PERSONA invece del nome squadra (che può non
// combaciare più con nessuna riga esistente dopo una rinomina). Due fonti,
// non solo team_seasons.manager_name (che parte vuota finché nessun admin
// lo compila da questo stesso form — altrimenti la select resta vuota anche
// se la lega ha già utenti registrati e assegnati a una squadra):
// 1. team_managers() RPC: utente REGISTRATO oggi su quella squadra
//    (profiles.team_id) — la fonte più probabile di avere già dati reali.
// 2. team_seasons.manager_name: storico, per proprietari di stagioni passate
//    senza account registrato collegato.
export async function getKnownTeamOwners(supabase: TypedSupabaseClient): Promise<KnownTeamOwner[]> {
  const [managersResult, teamSeasonsResult] = await Promise.all([
    supabase.rpc('team_managers'),
    supabase.from('team_seasons').select('team_id, manager_name').not('manager_name', 'is', null),
  ]);

  if (managersResult.error) {
    throw new Error(`Impossibile leggere i responsabili squadra: ${managersResult.error.message}`);
  }
  if (teamSeasonsResult.error) {
    throw new Error(`Impossibile leggere i proprietari: ${teamSeasonsResult.error.message}`);
  }

  // Un solo team_id per nome proprietario (l'ultima riga letta vince, non
  // c'è un criterio di "più recente" affidabile senza un ulteriore join a
  // seasons per un caso limite — un proprietario che cambia squadra non è
  // previsto in questo dominio, vedi AGENTS.md sull'identità squadra stabile).
  // team_managers() ha la precedenza (utente registrato oggi, più affidabile
  // di un testo libero storico) quando lo stesso nome compare in entrambe.
  const teamIdByOwner = new Map<string, string>();
  for (const row of teamSeasonsResult.data) {
    if (row.manager_name) teamIdByOwner.set(row.manager_name, row.team_id);
  }
  for (const row of managersResult.data) {
    if (row.display_name) teamIdByOwner.set(row.display_name, row.team_id);
  }

  const teamIds = [...new Set(teamIdByOwner.values())];
  if (teamIds.length === 0) {
    return [];
  }

  const { data: teams, error: teamsError } = await supabase.from('teams').select('id, canonical_name').in('id', teamIds);
  if (teamsError) {
    throw new Error(`Impossibile leggere le squadre: ${teamsError.message}`);
  }
  const teamNameById = new Map(teams.map((team) => [team.id, team.canonical_name]));

  return [...teamIdByOwner.entries()]
    .map(([ownerName, teamId]) => ({ ownerName, teamId, teamName: teamNameById.get(teamId) ?? '—' }))
    .sort((a, b) => a.ownerName.localeCompare(b.ownerName));
}
