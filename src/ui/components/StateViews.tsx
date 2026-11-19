import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, space } from '../tokens';
import { AppText } from './AppText';
import { Button } from './Button';
import { Screen } from './Screen';

export function LoadingView({ label }: { label?: string }) {
  const { t } = useTranslation();
  const text = label ?? t('common.loading');
  return (
    <Screen>
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent.candle} accessibilityLabel={text} />
        <AppText tone="muted">{text}</AppText>
      </View>
    </Screen>
  );
}

export function MessageView({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Screen>
      <View style={styles.center}>
        <AppText style={styles.message}>{message}</AppText>
        {actionLabel && onAction ? (
          <Button label={actionLabel} variant="ghost" onPress={onAction} />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  message: { textAlign: 'center' },
});
