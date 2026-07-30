import { createClient } from '../../../../lib/supabase/server';
import { getPendingRegistrationRequests } from '../../../../lib/queries/registration';
import { approveRegistration, rejectRegistration } from '../../../../lib/admin/actions';

export default async function AdminRegistrazioniPage() {
  const supabase = await createClient();
  const requests = await getPendingRegistrationRequests(supabase);

  return (
    <main className="p-4 space-y-4 max-w-2xl mx-auto">
      <h1 className="font-serif font-bold text-lg text-brand-950">Richieste di registrazione</h1>

      {requests.length === 0 ? (
        <p className="text-sm text-stone-500">Nessuna richiesta in attesa.</p>
      ) : (
        <ul className="space-y-3">
          {requests.map((request) => {
            const name = [request.firstName, request.lastName].filter(Boolean).join(' ') || 'Nome non indicato';

            return (
              <li
                key={request.id}
                className="bg-white rounded-lg border border-stone-200 p-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-stone-800 truncate">{name}</p>
                  <p className="text-sm text-stone-500 truncate">{request.requestedTeamName ?? 'Nessuna squadra richiesta'}</p>
                  <p className="text-xs text-stone-400">
                    {new Date(request.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <form action={approveRegistration.bind(null, request.id)}>
                    <button
                      type="submit"
                      className="rounded-lg bg-brand-400 text-brand-950 text-sm font-semibold px-3 py-1.5"
                    >
                      Approva
                    </button>
                  </form>
                  <form action={rejectRegistration.bind(null, request.id)}>
                    <button
                      type="submit"
                      className="rounded-lg border border-red-300 text-red-700 text-sm font-semibold px-3 py-1.5"
                    >
                      Rifiuta
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
