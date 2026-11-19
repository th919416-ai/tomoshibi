import { MissingEnvError, readPublicEnv } from '../env';

describe('readPublicEnv', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('設定値を返す', () => {
    expect(readPublicEnv()).toEqual({
      supabaseUrl: 'http://127.0.0.1:54321',
      supabaseAnonKey: 'test-anon-key',
    });
  });

  it('欠けている変数名をすべて示す', () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    expect(() => readPublicEnv()).toThrow(MissingEnvError);
    try {
      readPublicEnv();
    } catch (e) {
      expect((e as MissingEnvError).keys).toEqual([
        'EXPO_PUBLIC_SUPABASE_URL',
        'EXPO_PUBLIC_SUPABASE_ANON_KEY',
      ]);
    }
  });
});
