import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { getSupabase } from '@/lib/supabase';

export type LinkProvider = 'apple' | 'google';

/**
 * 匿名アカウントに Apple / Google を連携して、機種変更でも引き継げるようにする（§2 認証）。
 * Supabase 側で各プロバイダの設定と「手動リンク（manual linking）」の有効化が必要。
 */
export async function linkAccount(provider: LinkProvider): Promise<boolean> {
  const supabase = getSupabase();
  const redirectTo = AuthSession.makeRedirectUri({ path: 'auth-callback' });
  const { data, error } = await supabase.auth.linkIdentity({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data?.url) throw error ?? new Error('No auth url');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return false;

  const params = parseAuthParams(result.url);
  if (params.error) throw new Error(params.error_description ?? params.error);
  if (params.code) {
    const { error: e } = await supabase.auth.exchangeCodeForSession(params.code);
    if (e) throw e;
  } else if (params.access_token && params.refresh_token) {
    const { error: e } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (e) throw e;
  }
  return true;
}

/** リダイレクト URL のクエリとフラグメントからパラメータを取り出す */
export function parseAuthParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const [, rest = ''] = url.split('?');
  const [query = '', fragment = ''] = rest.includes('#')
    ? rest.split('#')
    : [rest, url.split('#')[1] ?? ''];
  for (const part of [query, fragment]) {
    for (const [k, v] of new URLSearchParams(part)) out[k] = v;
  }
  return out;
}

/** 連携済みのプロバイダ（匿名のみなら空） */
export async function linkedProviders(): Promise<string[]> {
  const { data } = await getSupabase().auth.getUser();
  return (data.user?.identities ?? []).map((i) => i.provider).filter((p) => p !== 'anonymous');
}
