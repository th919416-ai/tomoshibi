import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { TodayGate } from '@/features/today/TodayGate';
import type { TodayState } from '@/features/today/types';
import { now } from '@/lib/clock';
import { formatRemaining } from '@/lib/format';
import { AppText, Candle, Screen, space } from '@/ui';

/**
 * タイマー待機（§4, §10-2）。キャンドルとメッセージだけ。残り時間は小さく。
 * 時間になると useToday が状態を取り直し、回答入力へ切り替わる。
 */
export default function TimerScreen() {
  return <TodayGate route="timer">{(today) => <Waiting today={today} />}</TodayGate>;
}

const TICK_MS = 1000;

function Waiting({ today }: { today: TodayState }) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(now());

  useEffect(() => {
    const id = setInterval(() => setCurrent(now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const timer = today.timer;
  if (!timer) return null;
  const total = timer.endsAt.getTime() - timer.startedAt.getTime();
  const progress = (current.getTime() - timer.startedAt.getTime()) / total;
  const remaining = timer.endsAt.getTime() - current.getTime();

  return (
    <Screen>
      <View style={styles.center}>
        {today.question ? (
          <AppText variant="body" tone="muted" style={styles.text}>
            {today.question.body}
          </AppText>
        ) : null}
        <Candle progress={progress} accessibilityLabel={t('timer.a11yCandle')} />
        <AppText style={styles.text}>{t('timer.message')}</AppText>
        <AppText variant="caption" tone="muted" style={styles.remaining}>
          {t('timer.remaining', { time: formatRemaining(remaining) })}
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', gap: space.xl },
  text: { textAlign: 'center' },
  remaining: { textAlign: 'center', fontVariant: ['tabular-nums'] },
});
