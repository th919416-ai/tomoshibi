import type { SupabaseClient } from '@supabase/supabase-js';

import { ensureAnonymousSession } from '../session';

const session = { access_token: 'token', user: { id: 'user-1', is_anonymous: true } };

function fakeClient(opts: {
  existing?: unknown;
  getError?: Error;
  signIn?: { session: unknown; error?: Error };
}) {
  const signInAnonymously = jest.fn().mockResolvedValue({
    data: { session: opts.signIn?.session ?? null, user: null },
    error: opts.signIn?.error ?? null,
  });
  const getSession = jest.fn().mockResolvedValue({
    data: { session: opts.existing ?? null },
    error: opts.getError ?? null,
  });
  const client = { auth: { getSession, signInAnonymously } } as unknown as SupabaseClient;
  return { client, getSession, signInAnonymously };
}

describe('ensureAnonymousSession', () => {
  it('保存済みのセッションがあれば、新しくログインしない（再起動後も同じユーザー）', async () => {
    const { client, signInAnonymously } = fakeClient({ existing: session });
    await expect(ensureAnonymousSession(client)).resolves.toBe(session);
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it('セッションが無ければ匿名でログインする', async () => {
    const { client, signInAnonymously } = fakeClient({ signIn: { session } });
    await expect(ensureAnonymousSession(client)).resolves.toBe(session);
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
    expect(signInAnonymously).toHaveBeenCalledWith(); // 個人情報を渡さない
  });

  it('匿名ログインの失敗を呼び出し元に伝える', async () => {
    const { client } = fakeClient({ signIn: { session: null, error: new Error('disabled') } });
    await expect(ensureAnonymousSession(client)).rejects.toThrow('disabled');
  });

  it('セッションが返らなければエラー', async () => {
    const { client } = fakeClient({ signIn: { session: null } });
    await expect(ensureAnonymousSession(client)).rejects.toThrow('no session');
  });

  it('セッション読み出しの失敗を伝える', async () => {
    const { client, signInAnonymously } = fakeClient({ getError: new Error('storage') });
    await expect(ensureAnonymousSession(client)).rejects.toThrow('storage');
    expect(signInAnonymously).not.toHaveBeenCalled();
  });
});
