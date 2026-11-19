import type { Session, SupabaseClient } from '@supabase/supabase-js';

/**
 * 保存済みのセッションがあればそれを使い、無ければ匿名ユーザーとして新規ログインする（§2 認証）。
 * 個人情報は一切求めない。
 */
export async function ensureAnonymousSession(supabase: SupabaseClient): Promise<Session> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session) return data.session;

  const signIn = await supabase.auth.signInAnonymously();
  if (signIn.error) throw signIn.error;
  if (!signIn.data.session) throw new Error('Anonymous sign-in returned no session');
  return signIn.data.session;
}
