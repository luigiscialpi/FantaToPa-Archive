// apps/web/lib/notifications/telegram.ts
//
// Notifica best-effort via Telegram Bot API quando arriva una nuova richiesta
// di registrazione (alternativa gratuita, senza dominio, al piano originale
// via Resend/Edge Function — sezione 9 del piano di sviluppo). Se le env var
// non sono configurate (es. dev locale), la notifica viene silenziosamente
// saltata; un eventuale errore non deve mai bloccare la registrazione stessa.
export async function notifyAdminNewRegistration(details: {
  firstName: string;
  lastName: string;
  teamName: string | null;
}): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) {
    // Next.js legge .env.local solo all'avvio: se il dev server era già
    // acceso prima di aggiungere queste variabili, va riavviato.
    console.warn('Notifica Telegram saltata: TELEGRAM_BOT_TOKEN o TELEGRAM_ADMIN_CHAT_ID non impostate.');
    return;
  }

  const team = details.teamName ?? 'nessuna squadra';
  const text = `Nuova richiesta di registrazione: ${details.firstName} ${details.lastName} (${team}).`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!response.ok) {
      console.error('Notifica Telegram registrazione fallita:', await response.text());
    }
  } catch (error) {
    console.error('Notifica Telegram registrazione fallita:', error);
  }
}
