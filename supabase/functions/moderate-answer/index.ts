// 回答の自動審査（CLAUDE.md §6-2）。
// - アプリは投稿直後に { answer_id } を送る（ログイン中のユーザーの JWT 付き）。審査は冪等なので誰が呼んでも安全。
// - 定期実行（Cron）は { sweep: true } と x-cron-secret ヘッダーで、審査待ちをまとめて処理する。
import { createClient } from 'npm:@supabase/supabase-js@2';

import { createAiJudge } from '../_shared/aiJudge.ts';
import { moderate } from '../_shared/moderation.ts';

const SWEEP_LIMIT = 100;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const input = (await req.json().catch(() => ({}))) as { answer_id?: string; sweep?: boolean };

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    {
      auth: { persistSession: false },
    },
  );
  const ai = createAiJudge((k) => Deno.env.get(k));

  let query = admin
    .from('answers')
    .select('id, body')
    .eq('status', 'pending')
    .is('deleted_at', null);
  if (input.sweep) {
    const secret = Deno.env.get('CRON_SECRET');
    if (!secret || req.headers.get('x-cron-secret') !== secret) {
      return new Response('Forbidden', { status: 403 });
    }
    query = query.order('created_at').limit(SWEEP_LIMIT);
  } else if (input.answer_id) {
    query = query.eq('id', input.answer_id);
  } else {
    return new Response('answer_id or sweep is required', { status: 400 });
  }

  const { data, error } = await query;
  if (error) return new Response(error.message, { status: 500 });

  const results: { id: string; status: string }[] = [];
  for (const row of data ?? []) {
    const verdict = await moderate(row.body as string, ai);
    if (verdict.status === 'pending') continue;
    const { error: updateError } = await admin
      .from('answers')
      .update({
        status: verdict.status,
        rejection_reason: verdict.status === 'rejected' ? verdict.reason : null,
        moderated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('status', 'pending');
    if (!updateError) results.push({ id: row.id as string, status: verdict.status });
  }
  // 本文や判定の詳細は返さない・記録しない（§13）
  return Response.json({ processed: results.length });
});
