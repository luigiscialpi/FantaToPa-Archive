// apps/web/components/shared/SubmitButton.tsx
//
// Pulsante di submit che si disabilita e cambia etichetta mentre la server
// action del form è in esecuzione. useFormStatus() legge lo stato del <form>
// antenato e funziona solo da un componente figlio: per questo è un client
// component a sé e non un attributo sul <button>, che nell'header e nelle
// pagine admin è renderizzato lato server. Stesso feedback testuale già
// usato da LoginForm/ResendConfirmationForm, non una variante nuova.
'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

type SubmitButtonProps = {
  children: ReactNode;
  pendingLabel: string;
  className?: string;
};

export function SubmitButton({ children, pendingLabel, className }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}
