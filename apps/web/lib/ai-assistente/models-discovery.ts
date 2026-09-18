// apps/web/lib/ai-assistente/models-discovery.ts
//
// Interroga l'API di Google Gemini (ai.models.list()) per scoprire
// dinamicamente tutti i modelli di generazione testo disponibili per la chiave.
import { GoogleGenAI } from '@google/genai';
import { aiAssistenteEnv } from './env';

export interface ModelloScoperto {
  id: string;
  displayName: string;
  description: string;
  raccomandato: boolean;
  categoria: 'flash' | 'pro' | 'altro';
  gratuito: boolean;
}

const MODELLI_FLASH_RACCOMANDATI = new Set([
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite-preview',
  'gemini-3-flash-preview',
]);

const PATTERN_ESCLUSI = [
  'tts',
  'embedding',
  'transcribe',
  'robotics',
  'image',
  'computer-use',
  'native-audio',
  'customtools',
  'banana',
  'lyria',
  'omni',
  'gemini-2.5',
  'antigravity',
  'deep-research',
  'veo',
  'aqa',
];

export async function scopriModelliGoogle(): Promise<ModelloScoperto[]> {
  const ai = new GoogleGenAI({ apiKey: aiAssistenteEnv.GEMINI_API_KEY });
  const list = await ai.models.list();
  const modelli: ModelloScoperto[] = [];

  for await (const m of list) {
    if (!m.name) continue;
    const cleanId = m.name.replace(/^models\//, '');

    // Accettiamo solo modelli con prefisso gemini che supportano generazione contenuti
    if (!cleanId.startsWith('gemini-')) continue;
    if (!m.supportedActions?.includes('generateContent')) continue;

    // Filtra modelli audio, video, robotica, tts, embedding o ritirati
    if (PATTERN_ESCLUSI.some((pat) => cleanId.includes(pat))) continue;

    const isFlash = cleanId.includes('flash');
    const isPro = cleanId.includes('pro');
    const categoria: 'flash' | 'pro' | 'altro' = isFlash ? 'flash' : isPro ? 'pro' : 'altro';

    modelli.push({
      id: cleanId,
      displayName: m.displayName || cleanId,
      description: m.description || '',
      raccomandato: MODELLI_FLASH_RACCOMANDATI.has(cleanId),
      categoria,
      gratuito: true,
    });
  }

  // Ordina: prima i raccomandati (Flash recenti), poi Pro, poi per id
  modelli.sort((a, b) => {
    if (a.raccomandato && !b.raccomandato) return -1;
    if (!a.raccomandato && b.raccomandato) return 1;
    return b.id.localeCompare(a.id);
  });

  return modelli;
}
