/**
 * AI 判定の差し替え口（§6-2）。使うサービスと費用の上限はオーナーの判断待ち（§14）。
 * 環境変数 MODERATION_AI_PROVIDER で選ぶ。未設定・'none' のときは AI 判定を使わない。
 * 新しいサービスを足すときは、ここに分岐を1つ追加する。API キーは環境変数（Supabase Secrets）で渡す。
 */
import type { AiJudge } from './moderation.ts';

export function createAiJudge(env: (key: string) => string | undefined): AiJudge | undefined {
  const provider = env('MODERATION_AI_PROVIDER') ?? 'none';
  switch (provider) {
    case 'none':
      return undefined;
    default:
      throw new Error(`Unknown MODERATION_AI_PROVIDER: ${provider}`);
  }
}
