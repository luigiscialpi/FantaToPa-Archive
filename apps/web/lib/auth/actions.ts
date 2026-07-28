// apps/web/lib/auth/actions.ts
'use server';

import { redirect } from 'next/navigation';
import { createClient } from '../supabase/server';

export type LoginFormState = { error: string | null };

export async function signIn(_prevState: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const email = formData.get('email');
  const password = formData.get('password');

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return { error: 'Inserisci email e password.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: 'Credenziali non valide.' };
  }

  redirect('/');
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
