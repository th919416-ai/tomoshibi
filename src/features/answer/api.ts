import { getSupabase } from '@/lib/supabase';

/**
 * 投稿直後に審査を依頼する（失敗しても、サーバーの定期審査が拾う）。
 * 審査の結果は get_today_state() の answer.status で受け取る。
 */
export async function requestModeration(answerId: string): Promise<void> {
  await getSupabase()
    .functions.invoke('moderate-answer', { body: { answer_id: answerId } })
    .catch(() => {});
}
