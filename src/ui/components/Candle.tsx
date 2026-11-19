import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors, motion } from '../tokens';
import { useReduceMotion } from '../useReduceMotion';
import { Glow } from './Glow';

/**
 * ゆらめくろうそく（§4 タイマー待機、§10-2）。
 * progress（0〜1）が進むほどろうそくが短くなる。dim で灯りを弱くする。
 * OS の「視差効果を減らす」がオンなら静止画にする（§11）。
 */
const GLOW_SIZE = 240;

export function Candle({
  progress = 0,
  dim = false,
  accessibilityLabel,
}: {
  progress?: number;
  dim?: boolean;
  accessibilityLabel?: string;
}) {
  const reduceMotion = useReduceMotion();
  const flicker = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    const d = motion.flickerMs / 4;
    flicker.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: d, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.95, { duration: d * 1.3, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.04, { duration: d * 0.8, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: d, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
  }, [flicker, reduceMotion]);

  const flameStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: flicker.value }, { scaleX: 2 - flicker.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: (dim ? 0.35 : 0.7) * flicker.value }));

  const p = Math.min(1, Math.max(0, progress));
  const bodyHeight = 120 - 80 * p;

  return (
    <View
      style={styles.stage}
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[styles.glow, glowStyle]}>
        <Glow size={GLOW_SIZE} intensity={1.6} />
      </Animated.View>
      <View style={styles.column}>
        <Animated.View style={[styles.flame, dim && styles.flameDim, flameStyle]}>
          <View style={styles.flameCore} />
        </Animated.View>
        <View style={styles.wick} />
        <View style={[styles.body, { height: bodyHeight }]} />
        <View style={styles.plate} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { height: 260, alignItems: 'center', justifyContent: 'flex-end' },
  glow: { position: 'absolute', top: 0 },
  column: { alignItems: 'center' },
  flame: {
    width: 18,
    height: 42,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    backgroundColor: colors.accent.candle,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
  flameDim: { opacity: 0.6, height: 30 },
  flameCore: { width: 8, height: 16, borderRadius: 4, backgroundColor: colors.text.paper },
  wick: { width: 2, height: 6, backgroundColor: colors.bg.charcoal },
  body: {
    width: 34,
    backgroundColor: colors.text.paper,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  plate: { width: 110, height: 8, borderRadius: 4, backgroundColor: colors.line },
});
