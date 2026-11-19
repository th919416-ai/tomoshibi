import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import i18n from '@/i18n';

/**
 * 通知は §8 の2種類だけ。
 * - タイマー終了: ローカル通知（タイマー開始時に予約）
 * - お題配信: Expo Push（サーバーの Cron から）
 * 文面にお題そのものは含めない。
 */
const TIMER_NOTIFICATION_ID = 'timer-end';

let handlerSet = false;
export function configureNotificationHandler(): void {
  if (handlerSet || Platform.OS === 'web') return;
  handlerSet = true;
  // アプリを開いているときは通知を出さない（画面がすでに切り替わるため）
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function getPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (Platform.OS === 'web') return 'denied';
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

export async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  if (!current.canAskAgain) return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/** タイマー終了のお知らせを予約する（既存の予約は置き換える） */
export async function scheduleTimerEnd(endsAt: Date): Promise<void> {
  if (Platform.OS === 'web') return;
  await cancelTimerEnd();
  if (endsAt.getTime() <= Date.now()) return;
  if (!(await requestPermission())) return;
  await Notifications.scheduleNotificationAsync({
    identifier: TIMER_NOTIFICATION_ID,
    content: {
      title: i18n.t('notifications.timerTitle'),
      body: i18n.t('notifications.timerBody'),
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: endsAt },
  });
}

export async function cancelTimerEnd(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(TIMER_NOTIFICATION_ID).catch(() => {});
}

/** Expo Push のトークン（実機かつ EAS の projectId があるときだけ） */
export async function getPushToken(): Promise<{
  token: string;
  platform: 'ios' | 'android';
} | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;
  const projectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: AndroidImportance.DEFAULT,
    });
  }
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return { token: data, platform: Platform.OS === 'ios' ? 'ios' : 'android' };
}
