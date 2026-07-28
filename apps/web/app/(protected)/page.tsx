import { notFound, redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { getSeasons } from '../../lib/queries/classifica';

export default async function HomePage() {
  const supabase = await createClient();
  const seasons = await getSeasons(supabase);
  const latestSeason = seasons[0];

  if (!latestSeason) {
    notFound();
  }

  redirect(`/stagioni/${latestSeason.slug}/classifica`);
}
