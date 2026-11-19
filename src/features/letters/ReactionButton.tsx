import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useReduceMotion } from '@/ui/useReduceMotion';
import { AppText, colors, MIN_TOUCH_TARGET, radius, space } from '@/ui';

import type { ReactionType } from './api';

const PARTICLES = [-14, 0, 14];
const PARTICLE_MS = 900;

/** 共感ボタン。押すと小さな光の粒が浮かぶだけで、数は出さない（§7.4） */
export function ReactionButton({
  type,
  on,
  disabled,
  onToggle,
}: {
  type: ReactionType;
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const reduceMotion = useReduceMotion();
  const burst = useSharedValue(0);
  const label = t(`letters.reaction.${type}`);

  useEffect(() => {
    if (on && !reduceMotion) {
      burst.value = 0;
      burst.value = withTiming(1, { duration: PARTICLE_MS });
    }
  }, [burst, on, reduceMotion]);

  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={
        on ? t('letters.reactionA11yOn', { label }) : t('letters.reactionA11y', { label })
      }
      accessibilityState={{ selected: on, disabled }}
      style={({ pressed }) => [styles.button, on && styles.on, pressed && styles.pressed]}
    >
      <View style={styles.particles} pointerEvents="none">
        {PARTICLES.map((x) => (
          <Particle key={x} x={x} progress={burst} />
        ))}
      </View>
      <AppText variant="label" tone={on ? 'candle' : 'muted'}>
        {label}
      </AppText>
    </Pressable>
  );
}

function Particle({ x, progress }: { x: number; progress: { value: number } }) {
  const style = useAnimatedStyle(() => ({
    opacity: progress.value > 0 && progress.value < 1 ? 1 - progress.value : 0,
    transform: [{ translateX: x * progress.value }, { translateY: -28 * progress.value }],
  }));
  return <Animated.View style={[styles.particle, style]} />;
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET + space.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg.charcoal,
  },
  on: { borderColor: colors.accent.ember, backgroundColor: colors.glow },
  pressed: { opacity: 0.8 },
  particles: { position: 'absolute', top: space.sm, alignItems: 'center', width: '100%' },
  particle: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.accent.candle,
  },
});
