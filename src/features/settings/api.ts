import { useQuery } from '@tanstack/react-query';

import { getPushToken, requestPermission } from '@/lib/notifications';
import { callRpc } from '@/lib/rpc';

export type Profile = { notifyQuestion: boolean; notifyTimer: boolean; onboarded: boolean };

type RawProfile = { notify_question: boolean; notify_timer: boolean; onboarded: boolean };
const parse = (r: RawProfile): Profile => ({
  notifyQuestion: r.notify_question,
  notifyTimer: r.notify_timer,
  onboarded: r.onboarded,
});

export const profileQueryKey = ['profile'] as const;

export const fetchProfile = async () => parse(await callRpc<RawProfile>('get_my_profile'));

export function useProfile() {
  return useQuery({ queryKey: profileQueryKey, queryFn: fetchProfile });
}

export async function updateSettings(patch: { notifyQuestion?: boolean; notifyTimer?: boolean }) {
  return parse(
    await callRpc<RawProfile>('update_my_settings', {
      p_notify_question: patch.notifyQuestion ?? null,
      p_notify_timer: patch.notifyTimer ?? null,
    }),
  );
}

export const completeOnboarding = async () =>
  parse(await callRpc<RawProfile>('complete_onboarding'));

/**
 * お題配信の通知をオンにする: 通知の許可 → トークン登録 → 設定を保存。
 * 許可されなかったら false（設定はオフのまま）。
 */
export async function enableQuestionNotifications(): Promise<boolean> {
  if (!(await requestPermission())) return false;
  const push = await getPushToken().catch(() => null);
  if (push)
    await callRpc('register_push_token', { p_token: push.token, p_platform: push.platform });
  await updateSettings({ notifyQuestion: true });
  return true;
}

export const deleteMyAccount = () => callRpc<void>('delete_my_account');
