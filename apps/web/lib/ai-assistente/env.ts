import { z } from 'zod';

const schema = z.object({
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY mancante'),
});

export const aiAssistenteEnv = schema.parse({
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
});
