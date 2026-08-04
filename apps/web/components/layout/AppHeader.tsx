// apps/web/components/layout/AppHeader.tsx
//
// Sticky (sezione 10 del piano) e con selettore stagione (SeasonSwitcher)
// integrato: è il posto persistente in ogni pagina protetta, a differenza
// della toolbar tab/competizione che vive solo sotto /stagioni/[season]/**.
// Su mobile il nome utente + Admin + Esci si spostano dentro un menu
// hamburger (<details>, nessun JS/stato React necessario), posizionato a
// sinistra (pattern mobile standard: azioni di navigazione a sinistra,
// brand accanto) per lasciare il resto della riga al brand; su desktop
// restano visibili inline e l'hamburger sparisce del tutto. Il selettore
// stagione condivide la riga principale (variant="compact", troncato) su
// mobile, accanto al brand ormai corto ("FantaTopa"): niente riga propria
// né condivisione con GlobalNav, che così resta solo Home/Albo d'Oro/
// Statistiche. Su desktop resta nella stessa riga (variant="full"), dove lo
// spazio non manca.
// Seconda riga (GlobalNav, Home/Albo d'Oro/Statistiche): unico blocco sticky
// dell'header, invece di un'ulteriore barra sticky indipendente — chi
// consuma l'altezza dell'header (sticky offset di stagioni/[season]/layout.tsx)
// aggiorna un solo valore, non ne inserisce uno nuovo da coordinare.
import Link from 'next/link';
import { signOut } from '../../lib/auth/actions';
import type { SessionProfile } from '../../lib/auth/session';
import type { SeasonOption } from '../../lib/queries/seasons';
import { GlobalNav } from './GlobalNav';
import { SeasonSwitcher } from './SeasonSwitcher';

function AccountActions({ profile, itemClassName }: { profile: SessionProfile; itemClassName: string }) {
  return (
    <>
      {profile.role === 'admin' && (
        <Link href="/admin/registrazioni" className={itemClassName}>
          Admin
        </Link>
      )}
      <form action={signOut} className="contents">
        <button type="submit" className={itemClassName}>
          Esci
        </button>
      </form>
    </>
  );
}

export function AppHeader({ profile, seasons }: { profile: SessionProfile; seasons: SeasonOption[] }) {
  const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.email || 'Membro';

  return (
    <header className="bg-brand-700 text-stone-50 sticky top-0 z-20 lg:rounded-t-xl">
      <div className="px-4 py-3 flex items-center gap-3 border-b border-brand-800/40">
        <details className="relative sm:hidden shrink-0">
          <summary
            aria-label="Menu"
            className="list-none [&::-webkit-details-marker]:hidden cursor-pointer p-1.5 -ml-1.5 rounded-md hover:bg-brand-600/60 transition-colors"
          >
            <svg className="w-5 h-5 fill-current" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" clipRule="evenodd" d="M3 5h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2z" />
            </svg>
          </summary>
          <div className="absolute left-0 top-full mt-2 w-48 rounded-lg bg-white text-brand-950 shadow-xl border border-stone-200 py-1.5 z-30">
            <div className="px-3 py-1.5 mb-1 border-b border-stone-100 text-xs text-stone-500 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
              <span className="truncate">{displayName}</span>
            </div>
            <AccountActions
              profile={profile}
              itemClassName="block w-full text-left px-3 py-2 text-sm font-medium text-brand-900 hover:bg-stone-100 transition-colors"
            />
          </div>
        </details>

        <div className="min-w-0 flex-1">
          <Link href="/" className="block font-serif font-bold tracking-tight text-base sm:text-lg truncate hover:text-stone-100 transition-colors">
            FantaTopa
          </Link>
          <div className="hidden sm:flex text-xs text-brand-200/90 truncate items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>{displayName}</span>
          </div>
        </div>

        <div className="sm:hidden shrink-0">
          <SeasonSwitcher seasons={seasons} variant="compact" />
        </div>

        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <SeasonSwitcher seasons={seasons} />
          <div className="flex items-center gap-1">
            <AccountActions
              profile={profile}
              itemClassName="inline-flex items-center text-xs font-medium tracking-wide text-brand-100 hover:text-white hover:bg-brand-600/60 px-2.5 py-1 rounded-md transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="px-4 bg-brand-800/30 border-b border-brand-800/40">
        <GlobalNav />
      </div>
    </header>
  );
}
