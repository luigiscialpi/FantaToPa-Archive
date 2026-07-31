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
    if (error.code === 'email_not_confirmed') {
      return { error: 'Email non ancora confermata: controlla la posta (anche lo spam) e clicca il link di conferma ricevuto in fase di registrazione.' };
    }
    return { error: 'Credenziali non valide.' };
  }

  redirect('/');
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export type RegisterFormState = { error: string | null; success: boolean };

export async function signUp(_prevState: RegisterFormState, formData: FormData): Promise<RegisterFormState> {
  const email = formData.get('email');
  const password = formData.get('password');
  const confirmPassword = formData.get('confirmPassword');
  const firstName = formData.get('firstName');
  const lastName = formData.get('lastName');
  const requestedTeamId = formData.get('requestedTeamId');

  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    typeof confirmPassword !== 'string' ||
    typeof firstName !== 'string' ||
    typeof lastName !== 'string' ||
    !email ||
    !password ||
    !firstName.trim() ||
    !lastName.trim()
  ) {
    return { error: 'Compila tutti i campi obbligatori.', success: false };
  }

  if (password !== confirmPassword) {
    return { error: 'Le password non coincidono.', success: false };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        // handle_new_user (schema_iniziale.sql) fa nullif('') -> null:
        // stringa vuota qui equivale a "nessuna squadra".
        requested_team_id: typeof requestedTeamId === 'string' ? requestedTeamId : '',
      },
    },
  });

  if (error) {
    const message = error.message.includes('already registered')
      ? 'Esiste già un account con questa email.'
      : error.message.includes('Password')
        ? 'La password deve avere almeno 6 caratteri.'
        : 'Registrazione non riuscita. Riprova.';
    return { error: message, success: false };
  }

  // Se le conferme email sono disabilitate, signUp crea subito una sessione:
  // in quel caso si passa dal layout protetto, che mostra già lo stato
  // "in attesa di approvazione" per un profilo appena creato (status pending).
  if (data.session) {
    redirect('/');
  }

  return { error: null, success: true };
}
