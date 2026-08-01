import type { NextConfig } from 'next';

// Hostname Supabase diverso fra ambienti (staging in locale, un progetto
// separato in produzione — AGENTS.md): letto da env a build time, mai
// hardcodato, altrimenti next/image ottimizzerebbe le immagini solo
// nell'ambiente in cui è stato scritto l'hostname.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseUrl
      ? [
          {
            protocol: 'https',
            hostname: new URL(supabaseUrl).hostname,
            // Solo il bucket pubblico usato per loghi/maglie (vedi
            // uploadBrandingAsset in packages/ingestion/scripts/import-season.ts).
            pathname: '/storage/v1/object/public/team-branding/**',
          },
        ]
      : [],
    // Loghi/maglie di stagioni passate non cambiano quasi mai (solo un
    // re-import manuale con upsert può sostituirli): il default di Next
    // è pensato per contenuti che cambiano spesso, qui è troppo prudente.
    minimumCacheTTL: 60 * 60 * 24 * 30 * 11,
  },
};

export default nextConfig;
