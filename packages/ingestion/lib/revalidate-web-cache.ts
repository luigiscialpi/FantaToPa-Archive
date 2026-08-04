// packages/ingestion/lib/revalidate-web-cache.ts
//
// Chiamata best-effort a fine import (da verify-import.ts, l'ultimo passo
// convenzionale dopo ogni import — vedi AGENTS.md) per svuotare subito la
// cache cross-richiesta delle query home in apps/web
// (lib/queries/home-cache.ts), invece di aspettare fino a un'ora che scada
// da sola. Mai lanciare un errore: un import riuscito non deve fallire solo
// perché il sito non è raggiungibile in quel momento (es. dev server non
// avviato, o import lanciato contro un ambiente senza deploy collegato).
export async function revalidateWebHomeCache(): Promise<void> {
  const url = process.env.WEB_REVALIDATE_URL;
  const secret = process.env.WEB_REVALIDATE_SECRET;
  if (!url || !secret) {
    console.log('Cache home saltata: WEB_REVALIDATE_URL/WEB_REVALIDATE_SECRET non configurati (si aggiornerà da sola entro un\'ora).');
    return;
  }

  try {
    const response = await fetch(`${url}/api/internal/revalidate-home-stats`, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      console.warn(`Cache home non invalidata (HTTP ${response.status}): si aggiornerà da sola entro un'ora.`);
      return;
    }
    console.log('Cache home invalidata: i dati aggiornati sono già visibili in Home.');
  } catch (err) {
    console.warn(`Cache home non invalidata (${err instanceof Error ? err.message : String(err)}): si aggiornerà da sola entro un'ora.`);
  }
}
