// apps/web/components/shared/SaveButton.tsx
//
// Bottone "Salva" per righe in modifica (Classifica/Calendario/Rose/
// Formazioni/Utenti): disattivo finché nessun campo del form differisce dal
// suo valore iniziale, e con etichetta/loader mentre la richiesta è in
// corso. A differenza di SubmitButton (useFormStatus, per azioni one-shot
// tipo "Aggiungi"/"Elimina"), qui non possiamo sempre usare useFormStatus:
// alcune righe (Classifica/Rose) associano gli input a un <form> con
// l'attributo HTML `form={id}` invece di annidarli — un <form> non può
// avvolgere <td> sole di una stessa <tr> — e useFormStatus richiede che il
// bottone sia un discendente REACT del <form>, non solo associato via
// attributo. Tracciamo quindi "dirty"/"pending" a mano con listener DOM
// (che funzionano indipendentemente dall'annidamento, perché `element.form`
// risolve l'associazione reale del browser).
'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function isFormDirty(form: HTMLFormElement): boolean {
  for (const element of Array.from(form.elements)) {
    if (element instanceof HTMLInputElement) {
      if (element.type === 'checkbox' || element.type === 'radio') {
        if (element.checked !== element.defaultChecked) return true;
      } else if (element.value !== element.defaultValue) {
        return true;
      }
    } else if (element instanceof HTMLSelectElement) {
      for (const option of Array.from(element.options)) {
        if (option.selected !== option.defaultSelected) return true;
      }
    } else if (element instanceof HTMLTextAreaElement) {
      if (element.value !== element.defaultValue) return true;
    }
  }
  return false;
}

function belongsToForm(target: EventTarget | null, form: HTMLFormElement): boolean {
  return target instanceof HTMLElement && 'form' in target && (target as FormControl).form === form;
}

type SaveButtonProps = {
  // id del <form> a cui il bottone è associato (via `form={formId}` o
  // annidamento diretto, entrambi supportati).
  formId: string;
  // Valore che cambia quando il server restituisce dati aggiornati per
  // questa riga (es. JSON.stringify(row)): unico segnale disponibile per
  // sapere che il salvataggio è andato a buon fine e spegnere il loader,
  // dato che useFormStatus non è utilizzabile per il motivo sopra.
  resetKey: string;
  children: ReactNode;
  pendingLabel: string;
  className?: string;
  // Condizioni aggiuntive di disattivazione indipendenti da dirty/pending
  // (es. "non toccare il proprio ruolo admin").
  forceDisabled?: boolean;
};

export function SaveButton({ formId, resetKey, children, pendingLabel, className, forceDisabled = false }: SaveButtonProps) {
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const lastResetKey = useRef(resetKey);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return undefined;

    function recomputeDirty() {
      setDirty(isFormDirty(form as HTMLFormElement));
    }
    function handleFieldEvent(event: Event) {
      if (belongsToForm(event.target, form as HTMLFormElement)) {
        recomputeDirty();
      }
    }
    function handleSubmit(event: Event) {
      if (event.target === form) {
        setPending(true);
      }
    }

    document.addEventListener('input', handleFieldEvent);
    document.addEventListener('change', handleFieldEvent);
    form.addEventListener('submit', handleSubmit);
    return () => {
      document.removeEventListener('input', handleFieldEvent);
      document.removeEventListener('change', handleFieldEvent);
      form.removeEventListener('submit', handleSubmit);
    };
  }, [formId]);

  // Il server ha restituito dati freschi per questa riga (revalidatePath ha
  // completato il giro): il salvataggio è concluso, si spegne il loader e si
  // torna disattivi finché non c'è una nuova modifica.
  useEffect(() => {
    if (lastResetKey.current !== resetKey) {
      lastResetKey.current = resetKey;
      setPending(false);
      setDirty(false);
    }
  }, [resetKey]);

  return (
    <button type="submit" form={formId} disabled={forceDisabled || pending || !dirty} aria-busy={pending} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}
