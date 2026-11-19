import { Text, type TextProps } from 'react-native';

import { colors, typography, type TypographyVariant } from '../tokens';

type Props = TextProps & {
  variant?: TypographyVariant;
  tone?: 'paper' | 'muted' | 'candle';
};

const toneColor = {
  paper: colors.text.paper,
  muted: colors.text.muted,
  candle: colors.accent.candle,
} as const;

/**
 * 文字はすべてこのコンポーネントで表示する。
 * OS の文字サイズ設定に追従させるため allowFontScaling は無効にしない（§11）。
 */
export function AppText({ variant = 'body', tone = 'paper', style, ...rest }: Props) {
  const t = typography[variant];
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: t.family,
          fontSize: t.fontSize,
          lineHeight: Math.round(t.fontSize * t.lineHeightRatio),
          color: toneColor[tone],
        },
        style,
      ]}
    />
  );
}
