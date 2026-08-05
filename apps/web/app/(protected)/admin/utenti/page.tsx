// apps/web/app/(protected)/admin/utenti/page.tsx
import { createClient } from '../../../../lib/supabase/server';
import { getAllUsers } from '../../../../lib/queries/admin-users';
import { getAllTeams } from '../../../../lib/queries/teams';
import { getSessionState } from '../../../../lib/auth/session';
import { setUserRoleAction, setUserTeamAction } from '../../../../lib/admin/user-actions';
import { AdminNav } from '../../../../components/admin/AdminNav';
import { DeleteUserButton } from '../../../../components/admin/DeleteUserButton';

export default async function AdminUtentiPage() {
  const supabase = await createClient();
  const [users, teams, session] = await Promise.all([getAllUsers(supabase), getAllTeams(supabase), getSessionState()]);
  const currentUserId = session.kind === 'autenticato' ? session.profile.userId : null;

  return (
    <main className="p-4 space-y-4 max-w-3xl mx-auto">
      <h1 className="font-serif font-bold text-lg text-brand-950">Utenti</h1>
      <AdminNav />

      {users.length === 0 ? (
        <p className="text-sm text-stone-500">Nessun utente registrato.</p>
      ) : (
        <ul className="space-y-3">
          {users.map((user) => {
            const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Nome non indicato';
            const isSelf = user.id === currentUserId;

            return (
              <li key={user.id} className="bg-white rounded-lg border border-stone-200 p-4 space-y-3">
                <div className="min-w-0">
                  <p className="font-semibold text-stone-800 truncate">
                    {name}
                    {isSelf && <span className="ml-2 text-xs font-normal text-stone-400">(tu)</span>}
                  </p>
                  {user.email && <p className="text-sm text-stone-500 truncate">{user.email}</p>}
                  <p className="text-xs text-stone-400">
                    Stato: {user.status} · Registrato il{' '}
                    {new Date(user.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <form action={setUserRoleAction.bind(null, user.id)} className="flex items-end gap-2">
                    <label className="flex flex-col text-xs text-stone-500 gap-1">
                      Ruolo
                      <select
                        name="role"
                        defaultValue={user.role}
                        disabled={isSelf}
                        className="rounded border border-stone-300 text-sm px-2 py-1"
                      >
                        <option value="user">Utente</option>
                        <option value="admin">Admin</option>
                      </select>
                    </label>
                    <button
                      type="submit"
                      disabled={isSelf}
                      className="rounded-lg bg-brand-400 text-brand-950 text-sm font-semibold px-3 py-1.5 disabled:opacity-50"
                    >
                      Salva
                    </button>
                  </form>

                  <form action={setUserTeamAction.bind(null, user.id)} className="flex items-end gap-2">
                    <label className="flex flex-col text-xs text-stone-500 gap-1">
                      Squadra
                      <select name="teamId" defaultValue={user.teamId ?? ''} className="rounded border border-stone-300 text-sm px-2 py-1">
                        <option value="">Nessuna squadra</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit" className="rounded-lg bg-brand-400 text-brand-950 text-sm font-semibold px-3 py-1.5">
                      Salva
                    </button>
                  </form>

                  {!isSelf && <DeleteUserButton userId={user.id} userLabel={name} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
