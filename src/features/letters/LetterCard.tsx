import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useReduceMotion } from '@/ui/useReduceMotion';
import { Glow } from '@/ui/components/Glow';
import { AppText, colors, letterGlow, radius, space } from '@/ui';

import type { Letter } from './api';

const GLOW_BASE = 340;
/** 灯りが最大のときでも切れないだけの高さ */
const WRAP_HEIGHT = Math.ceil(GLOW_BASE * letterGlow[letterGlow.length - 1]!.size);
const GLOW_MS = 1400;

/** 手紙のカード。背景の灯りが、共感の段階に合わせて大きく温かくなる（数字は出さない。§7.3） */
export function LetterCard({ letter, position }: { letter: Letter; position: string }) {
  const { t } = useTranslation();
  const reduceMotion = useReduceMotion();
  const glow = letterGlow[letter.lightLevel] ?? letterGlow[0];
  const size = useSharedValue(glow.size);
  const opacity = useSharedValue(glow.opacity);

  useEffect(() => {
    const d = reduceMotion ? 0 : GLOW_MS;
    size.value = withTiming(glow.size, { duration: d });
    opacity.value = withTiming(glow.opacity, { duration: d });
  }, [glow.size, glow.opacity, opacity, reduceMotion, size]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: size.value }],
  }));
  const glowLabels = t('letters.glowA11y', { returnObjects: true }) as readonly string[];

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.glow, glowStyle]}>
        <Glow size={GLOW_BASE} intensity={2} />
      </Animated.View>
      <View
        style={styles.card}
        accessible
        accessibilityLabel={`${letter.body}　${glowLabels[letter.lightLevel] ?? ''}`}
      >
        <AppText variant="letter" style={styles.body}>
          {letter.body}
        </AppText>
        <View style={styles.footer}>
          <AppText variant="caption" style={styles.from}>
            {t('letters.from')}
          </AppText>
          <AppText variant="caption" style={styles.from}>
            {position}
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { justifyContent: 'center', minHeight: WRAP_HEIGHT },
  glow: { position: 'absolute', alignSelf: 'center' },
  card: {
    backgroundColor: colors.text.paper,
    borderRadius: radius.sm,
    padding: space.lg,
    minHeight: 260,
    gap: space.md,
  },
  body: { color: colors.text.onCandle, flex: 1 },
  footer: { flexDirection: 'row', justifyContent: 'space-between' },
  from: { color: colors.text.onCandle, opacity: 0.7 },
});
