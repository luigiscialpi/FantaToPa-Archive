// apps/web/lib/navigation/top-level-routes.ts
//
// Route top-level di GlobalNav (Home, Albo d'Oro, Statistiche, Profilo
// Squadra): non scoped a una singola stagione. Condivisa da SiteBrand (nome
// esteso) e SeasonSwitcher (nessuna stagione attiva da mostrare/cambiare lì),
// per non tenere due liste di route allineate a mano.
export const TOP_LEVEL_ROUTES = [
  { href: '/', exact: true },
  { href: '/albo-doro', exact: false },
  { href: '/statistiche', exact: false },
  { href: '/profilo-squadra', exact: false },
];

export function isTopLevelRoute(pathname: string): boolean {
  return TOP_LEVEL_ROUTES.some((route) => (route.exact ? pathname === route.href : pathname.startsWith(route.href)));
}
