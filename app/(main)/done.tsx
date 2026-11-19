import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { showInterstitial } from '@/features/ads/ads';
import { TodayGate } from '@/features/today/TodayGate';
import type { TodayState } from '@/features/today/types';
import { formatMonthDay } from '@/lib/format';
import { useUiStore } from '@/store/uiStore';
import { AppText, Button, Candle, Screen, space } from '@/ui';

/** 「今日の思考の時間は終わりです」（§7.5, §10-5） */
export default function DoneScreen() {
  return <TodayGate route="done">{(today) => <Done today={today} />}</TodayGate>;
}

function Done({ today }: { today: TodayState }) {
  const { t } = useTranslation();
  const shownDay = useUiStore((s) => s.interstitialShownDay);
  const markShown = useUiStore((s) => s.markInterstitialShown);
  const [closed, setClosed] = useState(false);

  const close = async () => {
    // 全画面広告は「閉じる」の後に、1日1回まで（§9）
    if (shownDay !== today.dayKey) {
      markShown(today.dayKey);
      await showInterstitial();
    }
    setClosed(true);
  };

  return (
    <Screen>
      <View style={styles.center}>
        <Candle progress={0.9} dim />
        <AppText variant="question" style={styles.text} accessibilityRole="header">
          {t('done.title')}
        </AppText>
        <AppText tone="muted" style={styles.text}>
          {closed ? t('done.goodnight') : t('done.body')}
        </AppText>
        <AppText variant="caption" tone="muted" style={styles.text}>
          {t('done.next', { date: formatMonthDay(today.endsAt) })}
        </AppText>
      </View>
      {closed ? (
        <Button
          label={t('common.archive')}
          variant="ghost"
          onPress={() => router.push('/archive')}
        />
      ) : (
        <Button label={t('done.close')} onPress={() => void close()} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', gap: space.lg },
  text: { textAlign: 'center' },
});
