// apps/web/app/(protected)/doc/page.tsx
//
// /doc senza tab esplicita -> prima tab di default (Storia), stesso pattern
// di /stagioni/[season] che non esiste come pagina propria.
import { redirect } from 'next/navigation';

export default function DocIndexPage() {
  redirect('/doc/storia');
}
