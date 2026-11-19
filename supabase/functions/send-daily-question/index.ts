// お題配信の通知（CLAUDE.md §8）。毎朝 7:00 JST に Cron から呼ぶ（設定は docs/operations.md）。
// 通知の文面にお題そのものは含めない。
import { createClient } from 'npm:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100; // Expo Push API の1回あたりの上限
const MESSAGE = { title: 'おいと間', body: '今日の問いが届きました' };

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return new Response('Forbidden', { status: 403 });
  }
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    {
      auth: { persistSession: false },
    },
  );

  const { data, error } = await admin
    .from('push_tokens')
    .select('token, profiles!inner(notify_question, is_banned)')
    .eq('profiles.notify_question', true)
    .eq('profiles.is_banned', false);
  if (error) return new Response(error.message, { status: 500 });

  const tokens = (data ?? []).map((r) => r.token as string);
  let sent = 0;
  const invalid: string[] = [];
  for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
    const chunk = tokens.slice(i, i + CHUNK_SIZE);
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(
        chunk.map((to) => ({ to, ...MESSAGE, sound: null, priority: 'normal' })),
      ),
    });
    if (!res.ok) continue;
    const json = (await res.json()) as {
      data?: { status: string; details?: { error?: string } }[];
    };
    json.data?.forEach((ticket, j) => {
      if (ticket.status === 'ok') sent++;
      else if (ticket.details?.error === 'DeviceNotRegistered') invalid.push(chunk[j]!);
    });
  }
  if (invalid.length) await admin.from('push_tokens').delete().in('token', invalid);
  return Response.json({ sent, removed: invalid.length });
});
