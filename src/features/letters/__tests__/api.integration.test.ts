/**
 * ローカル Supabase に HTTP で接続して、§5.1 / §12-6 の完了条件を API から確かめる。
 * 「未投稿のユーザーが API を直接叩いても他者の回答を取得できない」
 * 実行: `npx supabase start` のあと SUPABASE_TEST_ANON_KEY=<anon key> npm run test:integration
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const enabled = process.env.SUPABASE_INTEGRATION === '1';
const url = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321';
const key = process.env.SUPABASE_TEST_ANON_KEY ?? '';
const run = enabled ? describe : describe.skip;

async function anonymousClient(): Promise<SupabaseClient> {
  const c = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInAnonymously();
  if (error) throw error;
  return c;
}

run('未投稿ユーザーの API 直接アクセス（ローカル Supabase）', () => {
  let c: SupabaseClient;
  beforeAll(async () => {
    c = await anonymousClient();
  });

  it('get_today_letters は answer_required で拒否される', async () => {
    const { data, error } = await c.rpc('get_today_letters');
    expect(data).toBeNull();
    expect(error?.message).toBe('answer_required');
  });

  it('answers を直接読んでも他人の回答（seed を含む）は0件', async () => {
    const { data, error } = await c.from('answers').select('id, body');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it.each(['feed_assignments', 'reactions', 'reports', 'blocks', 'push_tokens', 'app_settings'])(
    '%s は読めない',
    async (table) => {
      const { data, error } = await c.from(table).select('*');
      expect(data).toBeNull();
      expect(error).not.toBeNull();
    },
  );

  it('answers の配信回数の列は読めない', async () => {
    const { error } = await c.from('answers').select('exposure_count');
    expect(error).not.toBeNull();
  });

  it.each([
    ['assign_letters', { uid: '00000000-0000-0000-0000-000000000000', day: '2026-11-19' }],
    ['letter_candidates', { uid: '00000000-0000-0000-0000-000000000000', day: '2026-11-19' }],
    ['light_level', { p_answer_id: '00000000-0000-0000-0000-000000000000' }],
  ])('内部関数 %s は呼べない', async (fn, args) => {
    const { data, error } = await c.rpc(fn, args);
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it('未来のお題は見えない', async () => {
    const { data: state } = await c.rpc('get_today_state');
    const { data } = await c.from('questions').select('day_key').gt('day_key', state.day_key);
    expect(data).toEqual([]);
  });

  it('タイマー中は投稿できない（入力ロックはサーバーで強制）', async () => {
    const started = await c.rpc('start_timer', { p_minutes: 10 });
    expect(started.data?.state).toBe('TIMER_RUNNING');
    const { error } = await c.rpc('submit_answer', { p_body: 'あ'.repeat(30) });
    expect(error?.message).toBe('not_writable_yet');
  });

  it('ログインしていなければ何も呼べない', async () => {
    const anon = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await anon.rpc('get_today_state');
    expect(error).not.toBeNull();
  });
});
