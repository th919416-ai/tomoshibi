import { router } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SUPPORT_RESOURCES } from '@/features/moderation/supportResources';
import { TodayGate } from '@/features/today/TodayGate';
import type { TodayState } from '@/features/today/types';
import { useUiStore } from '@/store/uiStore';
import { AppText, Button, colors, radius, Screen, space } from '@/ui';

/** 相談窓口の案内（§6-5, §10-8）。責めない文面で、静かに */
export default function SupportScreen() {
  return <TodayGate route="support">{(today) => <Support today={today} />}</TodayGate>;
}

function Support({ today }: { today: TodayState }) {
  const { t } = useTranslation();
  const acknowledge = useUiStore((s) => s.acknowledgeSupport);

  return (
    <Screen scroll>
      <View style={styles.head}>
        <AppText variant="question" accessibilityRole="header">
          {t('support.title')}
        </AppText>
        <AppText>{t('support.body')}</AppText>
      </View>

      {SUPPORT_RESOURCES.map((r) => (
        <View key={r.name} style={styles.card}>
          <AppText variant="label">{r.name}</AppText>
          <AppText variant="caption" tone="muted">
            {r.description}
          </AppText>
          <AppText variant="caption" tone="muted">
            {t('support.hours', { hours: r.hours })}
          </AppText>
          <View style={styles.actions}>
            {r.phone ? (
              <Button
                label={`${t('support.call')}　${r.phone}`}
                onPress={() => void Linking.openURL(`tel:${r.phone?.replace(/-/g, '')}`)}
              />
            ) : null}
            {r.url ? (
              <Button
                label={t('support.open')}
                variant="ghost"
                accessibilityHint={r.url}
                onPress={() => r.url && void Linking.openURL(r.url)}
              />
            ) : null}
          </View>
        </View>
      ))}

      <AppText variant="caption" tone="muted">
        {t('support.note')}
      </AppText>
      <Button
        label={t('support.continue')}
        variant="ghost"
        onPress={() => {
          acknowledge(today.dayKey);
          router.replace('/letters');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.md, paddingTop: space.lg },
  card: {
    gap: space.xs,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.bg.charcoal,
  },
  actions: { gap: space.sm, paddingTop: space.sm },
});
