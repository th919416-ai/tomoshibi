import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '../tokens';

const LAYERS = 8;

/**
 * やわらかい光（同心円を重ねて放射状のグラデーションに見せる）。
 * 影のぼかしは Android や Web で効かないため、どの環境でも同じに見えるこの方法を使う。
 */
export function Glow({
  size,
  intensity = 1,
  style,
}: {
  size: number;
  intensity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width: size, height: size }, styles.center, style]}
    >
      {Array.from({ length: LAYERS }, (_, i) => {
        const d = size * (1 - i / LAYERS);
        return (
          <View
            key={i}
            style={[
              styles.layer,
              {
                width: d,
                height: d,
                borderRadius: d / 2,
                opacity: Math.min(1, 0.07 * intensity),
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  layer: { position: 'absolute', backgroundColor: colors.accent.ember },
});
