import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  completeOnboarding,
  enableQuestionNotifications,
  profileQueryKey,
} from '@/features/settings/api';
import { AppText, Button, Candle, colors, Screen, space } from '@/ui';

type Page = { title: string; body: string };

/** オンボーディング（3枚 + お題通知の許可は任意。§10-0） */
export default function OnboardingScreen() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const pages = t('onboarding.pages', { returnObjects: true }) as readonly Page[];
  const [index, setIndex] = useState(0);
  const askNotify = index >= pages.length;
  const page = pages[index];

  const finish = useMutation({
    mutationFn: async (notify: boolean) => {
      if (notify) await enableQuestionNotifications().catch(() => false);
      return completeOnboarding();
    },
    onSuccess: (profile) => {
      client.setQueryData(profileQueryKey, profile);
      router.replace('/');
    },
  });

  return (
    <Screen>
      <View style={styles.center}>
        <Candle progress={0.2} />
        {askNotify ? (
          <>
            <AppText variant="question" style={styles.text} accessibilityRole="header">
              {t('onboarding.notifyAsk')}
            </AppText>
            <AppText tone="muted" style={styles.text}>
              {t('onboarding.notifyAskNote')}
            </AppText>
          </>
        ) : page ? (
          <>
            <AppText variant="question" style={styles.text} accessibilityRole="header">
              {page.title}
            </AppText>
            <AppText tone="muted" style={styles.text}>
              {page.body}
            </AppText>
          </>
        ) : null}
      </View>

      <View
        style={styles.dots}
        accessible
        accessibilityLabel={t('onboarding.pageA11y', {
          current: Math.min(index + 1, pages.length + 1),
          total: pages.length + 1,
        })}
      >
        {Array.from({ length: pages.length + 1 }, (_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotNow]} />
        ))}
      </View>

      {askNotify ? (
        <View style={styles.actions}>
          <Button
            label={t('onboarding.notifyYes')}
            disabled={finish.isPending}
            onPress={() => finish.mutate(true)}
          />
          <Button
            label={t('onboarding.notifyNo')}
            variant="ghost"
            disabled={finish.isPending}
            onPress={() => finish.mutate(false)}
          />
        </View>
      ) : (
        <Button label={t('onboarding.next')} onPress={() => setIndex(index + 1)} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', gap: space.lg },
  text: { textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.line },
  dotNow: { backgroundColor: colors.accent.candle },
  actions: { gap: space.sm },
});
