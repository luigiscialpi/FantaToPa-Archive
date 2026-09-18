// apps/web/lib/ai-assistente/settings.ts
//
// Gestione della sequenza ordinata di modelli Gemini per l'assistente IA.
// Memorizzata su Supabase nella tabella assistant_settings, con fallback
// sui modelli predefiniti in env.ts.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@fantatopa/shared-types/database';
import { MODELLI_GEMINI_DEFAULT } from './env';

export async function getCatenaModelliAttiva(
  supabase: SupabaseClient<Database>
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('assistant_settings')
      .select('models')
      .eq('id', 'default')
      .maybeSingle();

    if (error || !data || !Array.isArray(data.models) || data.models.length === 0) {
      return [...MODELLI_GEMINI_DEFAULT];
    }

    return data.models;
  } catch {
    return [...MODELLI_GEMINI_DEFAULT];
  }
}

export async function salvaCatenaModelli(
  supabase: SupabaseClient<Database>,
  models: string[],
  userId: string
): Promise<void> {
  const modelsValidi = Array.from(new Set(models.map((m) => m.trim()).filter(Boolean)));
  if (modelsValidi.length === 0) {
    throw new Error('La configurazione deve contenere almeno un modello');
  }

  const { error } = await supabase
    .from('assistant_settings')
    .upsert({
      id: 'default',
      models: modelsValidi,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    });

  if (error) {
    throw new Error(`Errore durante il salvataggio dei modelli: ${error.message}`);
  }
}
