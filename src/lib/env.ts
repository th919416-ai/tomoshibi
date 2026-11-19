/**
 * 公開してよい設定値のみ（EXPO_PUBLIC_*）。秘密情報はクライアントに置かない（§13）。
 * Expo は EXPO_PUBLIC_ 変数をビルド時に静的に埋め込むため、process.env.X の形で直接参照する。
 */
export type PublicEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export class MissingEnvError extends Error {
  constructor(public readonly keys: string[]) {
    super(`Missing environment variables: ${keys.join(', ')}`);
    this.name = 'MissingEnvError';
  }
}

export function readPublicEnv(): PublicEnv {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const missing = [
    !supabaseUrl && 'EXPO_PUBLIC_SUPABASE_URL',
    !supabaseAnonKey && 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  ].filter((k): k is string => Boolean(k));
  if (missing.length) throw new MissingEnvError(missing);
  return { supabaseUrl, supabaseAnonKey };
}
