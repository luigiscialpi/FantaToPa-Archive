import { z } from 'zod';

const schema = z.object({
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY mancante'),
  // Impostare a gemini-3.5-flash o al modello preferito. Per un elenco
  // aggiornato dei modelli disponibili sulla chiave:
  //   for await (const m of await ai.models.list()) console.log(m.name)
  GEMINI_MODEL: z.string().min(1).default('gemini-3.5-flash'),
});

export const aiAssistenteEnv = schema.parse({
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
});
