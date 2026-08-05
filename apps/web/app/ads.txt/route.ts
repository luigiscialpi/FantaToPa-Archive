// apps/web/app/ads.txt/route.ts
// Richiesto da AdSense per dichiarare i venditori autorizzati (Authorized
// Sellers), verificato separatamente dal tag di script — derivato dallo
// stesso client ID invece di duplicarlo qui a mano.
import { NextResponse } from 'next/server';
import { ADSENSE_CLIENT_ID } from '../../lib/ads/config';

export function GET(): NextResponse {
  const pubId = ADSENSE_CLIENT_ID?.replace(/^ca-/, '');
  const body = pubId ? `google.com, ${pubId}, DIRECT, f08c47fec0942fa0\n` : '';

  return new NextResponse(body, { headers: { 'Content-Type': 'text/plain' } });
}
