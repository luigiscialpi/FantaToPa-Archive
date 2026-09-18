import { z } from 'zod';

// Modelli gratuiti supportati da Google AI Studio per structured JSON e chat.
// Ogni modello ha quote indipendenti nel Free tier (RPM e RPD).
export const MODELLI_GEMINI_DEFAULT = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
] as const;

/**
 * Risolve la catena di fallback dei modelli da provare in ordine.
 * Mette per primi quelli configurati via env (GEMINI_MODEL o GEMINI_MODELS),
 * seguiti dagli altri modelli gratuiti di default, deduplicando.
 */
export function risolviCatenaModelli(modelEnv?: string, modelsEnv?: string): string[] {
  const custom = (modelsEnv || modelEnv || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const tutti = [...custom, ...MODELLI_GEMINI_DEFAULT];
  return Array.from(new Set(tutti));
}

const schema = z.object({
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY mancante'),
  GEMINI_MODEL: z.string().optional(),
  GEMINI_MODELS: z.string().optional(),
});

function caricaEnv() {
  const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
  const apiKey = process.env.GEMINI_API_KEY || (isTest ? 'dummy-test-key' : '');
  const model = process.env.GEMINI_MODEL;
  const models = process.env.GEMINI_MODELS;

  if (!isTest) {
    schema.parse({
      GEMINI_API_KEY: apiKey,
      GEMINI_MODEL: model,
      GEMINI_MODELS: models,
    });
  }

  const catena = risolviCatenaModelli(model, models);

  return {
    GEMINI_API_KEY: apiKey,
    GEMINI_MODEL: model || catena[0],
    CATENA_MODELLI: catena,
  };
}

export const aiAssistenteEnv = caricaEnv();

