// apps/web/app/(protected)/admin/layout.tsx
//
// Gate per ruolo, sopra qualsiasi pagina admin (registrazioni oggi, pannello
// import in futuro — sezione 10 del piano). Il layout (protected) più esterno
// garantisce già "autenticato e approvato"; qui si aggiunge il controllo
// specifico sul ruolo. notFound() invece di redirect: un utente approvato
// ma non admin non deve nemmeno sapere che questa sezione esiste (OWASP,
// controllo accessi — non distinguere 403 da 404 su aree riservate).
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { getSessionState } from '../../../lib/auth/session';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSessionState();

  if (session.kind !== 'autenticato' || session.profile.role !== 'admin') {
    notFound();
  }

  return <>{children}</>;
}
