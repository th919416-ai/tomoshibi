import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, MIN_TOUCH_TARGET, space } from '../tokens';
import { AppText } from './AppText';

type Link = { label: string; href: Href };

/** 画面上部の控えめなバー。左にアプリ名（または戻る）、右にリンク */
export function Header({ links = [], back = false }: { links?: Link[]; back?: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={styles.bar}>
      {back ? (
        <HeaderButton
          label={t('common.back')}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      ) : (
        <View
          style={styles.brand}
          accessible
          accessibilityRole="header"
          accessibilityLabel={t('common.appNameReading')}
        >
          <View style={styles.flame} />
          <AppText variant="label">{t('common.appName')}</AppText>
        </View>
      )}
      <View style={styles.links}>
        {links.map((l) => (
          <HeaderButton key={l.label} label={l.label} onPress={() => router.push(l.href)} />
        ))}
      </View>
    </View>
  );
}

function HeaderButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }]}
    >
      <AppText variant="label" tone="muted">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MIN_TOUCH_TARGET,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flame: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent.candle },
  links: { flexDirection: 'row', gap: space.md },
  button: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' },
});
