// Jest 用の最小限の Reanimated。アプリが使う関数だけを、アニメーションせずに値をそのまま返す形で用意する。
// （Reanimated 同梱のモックは Jest 上でネイティブモジュールを読み込もうとして失敗するため）
import { View } from 'react-native';

const identity = <T,>(v: T) => v;

export const useSharedValue = <T,>(v: T) => ({ value: v });
export const useAnimatedStyle = (fn: () => object) => fn();
export const withTiming = identity;
export const withRepeat = identity;
export const withSequence = <T,>(...v: T[]) => v[v.length - 1];
export const Easing = { inOut: () => identity, sin: identity };

const Animated = { View, call: () => {} };
export default Animated;
