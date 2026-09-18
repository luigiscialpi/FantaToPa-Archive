import { NextResponse } from 'next/server';
import { getSessionState } from '../../../../lib/auth/session';
import { createClient } from '../../../../lib/supabase/server';

export async function GET(request: Request): Promise<NextResponse> {
  const session = await getSessionState();
  if (session.kind === 'anonimo' || session.profile.role !== 'admin') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  const url = new URL(request.url);
  const limite = Math.min(Number(url.searchParams.get('limite') ?? '500') || 500, 2000);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('query_assistant_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limite);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="assistente-logs-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
