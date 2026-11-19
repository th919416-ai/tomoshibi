import { parseAuthParams } from '../linkAccount';

describe('parseAuthParams', () => {
  it('フラグメントのトークンを読む', () => {
    expect(
      parseAuthParams('tomoshibi://auth-callback#access_token=a&refresh_token=b&type=bearer'),
    ).toMatchObject({ access_token: 'a', refresh_token: 'b' });
  });
  it('クエリの code やエラーを読む', () => {
    expect(parseAuthParams('tomoshibi://auth-callback?code=xyz')).toEqual({ code: 'xyz' });
    expect(parseAuthParams('tomoshibi://auth-callback?error=access_denied')).toEqual({
      error: 'access_denied',
    });
  });
});
