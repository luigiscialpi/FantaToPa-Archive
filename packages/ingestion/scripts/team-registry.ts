// packages/ingestion/scripts/team-registry.ts
//
// `teams` è un'identità persistente nel tempo (vedi commento nella migration
// iniziale): una squadra che cambia nome da una stagione all'altra è la
// STESSA riga `teams`, con i nomi storici salvati come alias — stesso
// meccanismo già usato per i giocatori. Senza questo registro, un rename
// (es. "Hertha Rallo" -> "Los Cientoquattros Hertha Rallo") creerebbe due
// righe `teams` distinte e spezzerebbe la storia della squadra (rilevante
// per pagine cross-stagione come l'Albo d'Oro).
//
// Mappatura confermata dall'utente (2026-07-30) confrontando gli insiemi di
// nomi squadra reali su tutte le 6 stagioni — vedi
// `.agents`/memoria repo `legacy-seasons-compat.md` per il dettaglio
// stagione per stagione. Un solo anello (PSV BEETHOVEN -> adagio_andante_avanti,
// 2023-24 -> 2024-25) è dedotto per esclusione, non confermato esplicitamente:
// segnalato di nuovo qui nel caso emerga un'informazione diversa.
export interface TeamIdentity {
  /** Nome canonico attuale (stagione 2025-26): quello che finisce in teams.canonical_name. */
  canonicalName: string;
  /** Nomi con cui la stessa squadra/manager è comparsa in stagioni precedenti. */
  aliases: string[];
}

export const TEAM_REGISTRY: TeamIdentity[] = [
  // Stabili su tutte le stagioni disponibili (2020-21 -> 2025-26): nessun alias necessario.
  { canonicalName: 'Biancoceleste Athletic Club', aliases: [] },
  { canonicalName: 'Carloparola Fc', aliases: [] },
  { canonicalName: 'Monster', aliases: [] },
  { canonicalName: 'Prozalpi S.F.', aliases: [] },
  { canonicalName: 'Real Cocu 2003 Fc', aliases: [] },

  // Rename confermati dall'utente.
  {
    canonicalName: 'Los Cientoquattros Hertha Rallo',
    aliases: ['Hertha Rallo'],
  },
  {
    canonicalName: 'MR EKO - C&W F.C.',
    aliases: ['SKAJAHNNY 04 F.C.', 'BBSATLPR 22 F.C.', 'CIARFandWHITE 23 FC', 'Ciarf&White FC 23'],
  },
  {
    canonicalName: 'Associazione Sportiva via Roma',
    aliases: [
      'Herta Bellinu',
      'PSG - Paria San Giseppu',
      'PSV BEETHOVEN',
      // dedotto per esclusione (2023-24 -> 2024-25), non confermato esplicitamente
      'adagio_andante_avanti',
    ],
  },
  {
    canonicalName: 'Fantamerda',
    aliases: ['Deportivo La Carogna'],
  },
  {
    canonicalName: 'Unione Sportiva Neritina',
    aliases: ['Andreajax'],
  },
];
