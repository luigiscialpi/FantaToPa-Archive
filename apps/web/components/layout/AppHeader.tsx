// apps/web/components/layout/AppHeader.tsx
//
// Sticky (sezione 10 del piano) e con selettore stagione (SeasonSwitcher)
// integrato: è il posto persistente in ogni pagina protetta, a differenza
// della toolbar tab/competizione che vive solo sotto /stagioni/[season]/**.
// Su mobile il nome utente + Admin + Esci + un sottomenu stagione si
// spostano dentro un menu hamburger (MobileMenu, client component per il
// tap-fuori-per-chiudere e il sottomenu — vedi lì), posizionato a sinistra
// (pattern mobile standard: azioni di navigazione a sinistra, brand accanto)
// per lasciare il resto della riga al brand; su desktop restano visibili
// inline e l'hamburger sparisce del tutto. Il selettore stagione compatto
// resta ANCHE nella riga principale (variant="compact", troncato) accanto al
// brand su mobile — scelta esplicita dell'utente di tenere entrambi i punti
// di accesso invece di spostarlo solo nell'hamburger. Su desktop resta nella
// stessa riga (variant="full"), dove lo spazio non manca.
// Seconda riga (GlobalNav, Home/Albo d'Oro/Statistiche): unico blocco sticky
// dell'header, invece di un'ulteriore barra sticky indipendente — chi
// consuma l'altezza dell'header (sticky offset di stagioni/[season]/layout.tsx)
// aggiorna un solo valore, non ne inserisce uno nuovo da coordinare.
import type { SessionProfile } from '../../lib/auth/session';
import type { SeasonOption } from '../../lib/queries/seasons';
import { AccountActions } from './AccountActions';
import { GlobalNav } from './GlobalNav';
import { MobileMenu } from './MobileMenu';
import { SeasonSwitcher } from './SeasonSwitcher';
import { SiteBrand } from './SiteBrand';

export function AppHeader({ profile, seasons }: { profile: SessionProfile; seasons: SeasonOption[] }) {
  const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.email || 'Membro';

  return (
    <header className="bg-brand-700 text-stone-50 sticky top-0 z-20 lg:rounded-t-xl">
      <div className="px-4 py-3 flex items-center gap-3 border-b border-brand-800/40">
        <MobileMenu profile={profile} seasons={seasons} />

        <div className="min-w-0 flex-1">
          <SiteBrand />
        </div>

        <div className="sm:hidden shrink-0">
          <SeasonSwitcher seasons={seasons} variant="compact" />
        </div>

        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <SeasonSwitcher seasons={seasons} />
          <details className="relative">
            <summary
              aria-label="Account"
              className="list-none [&::-webkit-details-marker]:hidden cursor-pointer inline-flex items-center gap-1.5 text-xs font-medium tracking-wide text-brand-100 hover:text-white hover:bg-brand-600/60 px-2.5 py-1.5 rounded-md transition-colors"
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
              <span className="max-w-[10rem] truncate">{displayName}</span>
            </summary>
            <div className="absolute right-0 top-full mt-2 w-48 rounded-lg bg-white text-brand-950 shadow-xl border border-stone-200 py-1.5 z-30">
              <AccountActions
                profile={profile}
                itemClassName="block w-full text-left px-3 py-2 text-sm font-medium text-brand-900 hover:bg-stone-100 transition-colors"
              />
            </div>
          </details>
        </div>
      </div>

      <div className="px-4 bg-brand-800/30 border-b border-brand-800/40">
        <GlobalNav />
      </div>
    </header>
  );
}
