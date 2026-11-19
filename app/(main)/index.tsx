import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { TIMER_OPTIONS, type TimerMinutes } from '@/config/constants';
import { useProfile } from '@/features/settings/api';
import { ackGlowNotice, startTimer } from '@/features/today/api';
import { TodayGate } from '@/features/today/TodayGate';
import type { TodayState } from '@/features/today/types';
import { todayQueryKey } from '@/features/today/useToday';
import { formatMonthDay, formatTime } from '@/lib/format';
import { scheduleTimerEnd } from '@/lib/notifications';
import { RpcError } from '@/lib/rpc';
import { AppText, Button, colors, Header, radius, Screen, Sheet, space } from '@/ui';

/** ホーム（§10-1）: 今日のお題と、考える時間の選択 */
export default function HomeScreen() {
  return <TodayGate route="home">{(today) => <Home today={today} />}</TodayGate>;
}

function Home({ today }: { today: TodayState }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const profile = useProfile();
  const [pending, setPending] = useState<TimerMinutes | null>(null);
  const [glowVisible] = useState(today.showGlowNotice);

  // 「灯りがともりました」は1度だけ（表示したらサーバーに記録）
  useEffect(() => {
    if (today.showGlowNotice) void ackGlowNotice().catch(() => {});
  }, [today.showGlowNotice]);

  const start = useMutation({
    mutationFn: startTimer,
    onSuccess: (next) => {
      client.setQueryData(todayQueryKey, next);
      if (next.timer && profile.data?.notifyTimer) void scheduleTimerEnd(next.timer.endsAt);
      setPending(null);
      router.replace('/timer');
    },
    onError: () => {
      setPending(null);
      void client.invalidateQueries({ queryKey: todayQueryKey });
    },
  });

  const deadline = new Date(today.endsAt.getTime() - 1000);
  const label = (m: TimerMinutes) => t(`home.timerOption.${m}`);

  return (
    <Screen scroll>
      <Header
        links={[
          { label: t('common.archive'), href: '/archive' },
          { label: t('common.settings'), href: '/settings' },
        ]}
      />

      {glowVisible ? (
        <View style={styles.glowNotice} accessibilityLiveRegion="polite">
          <View style={styles.glowDot} />
          <AppText variant="caption" tone="candle">
            {t('home.glowNotice')}
          </AppText>
        </View>
      ) : null}

      {today.question ? (
        <View style={styles.question}>
          <AppText variant="caption" tone="candle">
            {t(`genre.${today.question.genre}`)}　{formatMonthDay(today.startsAt)}
          </AppText>
          <AppText variant="question" accessibilityRole="header">
            {today.question.body}
          </AppText>
        </View>
      ) : (
        <AppText tone="muted">{t('home.notReady')}</AppText>
      )}

      {today.state === 'CLOSED' ? (
        <AppText tone="muted">{t('home.closed')}</AppText>
      ) : today.question ? (
        <>
          <AppText tone="muted">{t('home.chooseTimeLead')}</AppText>
          <View style={styles.options}>
            {TIMER_OPTIONS.map((m) => {
              const available = today.availableTimerOptions.includes(m);
              return (
                <Pressable
                  key={m}
                  disabled={!available || start.isPending}
                  onPress={() => setPending(m)}
                  accessibilityRole="button"
                  accessibilityLabel={label(m)}
                  accessibilityHint={
                    available ? t('home.timerA11yHint') : t('home.timerUnavailable')
                  }
                  accessibilityState={{ disabled: !available }}
                  style={({ pressed }) => [
                    styles.option,
                    !available && styles.optionDisabled,
                    pressed && styles.optionPressed,
                  ]}
                >
                  <AppText variant="question" style={styles.optionLabel}>
                    {label(m)}
                  </AppText>
                  <AppText variant="caption" tone="muted" style={styles.optionNote}>
                    {available ? t(`home.timerNote.${m}`) : t('home.timerUnavailable')}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.lock}>
            <AppText variant="caption" tone="muted">
              {t('home.lockNote')}
            </AppText>
            <AppText variant="caption" tone="muted">
              {t('home.deadline', {
                date: formatMonthDay(deadline),
                time: formatTime(deadline),
              })}
            </AppText>
          </View>
        </>
      ) : null}

      {start.isError ? (
        <AppText tone="candle" accessibilityLiveRegion="polite">
          {t(`errors.${start.error instanceof RpcError ? start.error.code : 'unknown'}`)}
        </AppText>
      ) : null}

      <Sheet
        visible={pending !== null}
        title={pending ? t('home.confirmTitle', { label: label(pending) }) : undefined}
        body={t('home.confirmBody')}
        onClose={() => setPending(null)}
      >
        <Button
          label={t('home.confirmStart')}
          disabled={start.isPending}
          onPress={() => pending && start.mutate(pending)}
        />
        <Button label={t('common.cancel')} variant="ghost" onPress={() => setPending(null)} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  glowNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.glow,
  },
  glowDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent.candle },
  question: { gap: space.sm, paddingTop: space.md },
  options: { gap: space.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg.charcoal,
    minHeight: 64,
  },
  optionLabel: { width: 84 },
  optionNote: { flex: 1 },
  optionDisabled: { opacity: 0.45 },
  optionPressed: { borderColor: colors.accent.ember },
  lock: { gap: space.xs, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.md },
});
