/**
 * ローカルの Supabase（`npx supabase start`）に対して実際に匿名ログインする結合テスト。
 * 実行: `npx supabase start` のあと SUPABASE_TEST_ANON_KEY=<anon key> npm run test:integration
 */
import { createClient } from '@supabase/supabase-js';

import { ensureAnonymousSession } from '../session';

const enabled = process.env.SUPABASE_INTEGRATION === '1';
const url = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321';
const key = process.env.SUPABASE_TEST_ANON_KEY ?? '';

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: async (k: string) => m.get(k) ?? null,
    setItem: async (k: string, v: string) => void m.set(k, v),
    removeItem: async (k: string) => void m.delete(k),
  };
}

const run = enabled ? describe : describe.skip;

run('匿名ログイン（ローカル Supabase）', () => {
  it('匿名ユーザーが作られ、同じ保存領域なら再起動後も同じユーザーになる', async () => {
    const storage = memoryStorage();
    const opts = { auth: { storage, persistSession: true, autoRefreshToken: false } };

    const first = await ensureAnonymousSession(createClient(url, key, opts));
    expect(first.user.is_anonymous).toBe(true);
    // 個人情報を持たない
    expect(first.user.email ?? '').toBe('');
    expect(first.user.phone ?? '').toBe('');

    // 「アプリ再起動」: 新しいクライアントで同じ保存領域を読む
    const second = await ensureAnonymousSession(createClient(url, key, opts));
    expect(second.user.id).toBe(first.user.id);

    // 別の端末（別の保存領域）なら別ユーザー
    const other = await ensureAnonymousSession(
      createClient(url, key, { auth: { ...opts.auth, storage: memoryStorage() } }),
    );
    expect(other.user.id).not.toBe(first.user.id);
  });
});
