/**
 * デザイントークン（CLAUDE.md §11）。ダークテーマのみ。
 * 色はここ以外に直接書かない。
 */
export const colors = {
  bg: {
    night: '#0E1420',
    charcoal: '#1C1F26',
  },
  accent: {
    candle: '#F2A65A',
    ember: '#E07B39',
  },
  text: {
    paper: '#F3EDE2',
    muted: '#A8A29A',
    /** アクセント色のボタン上に載せる文字 */
    onCandle: '#1A1209',
  },
  line: '#2C3240',
  /** ろうそくの周りの光（半透明） */
  glow: 'rgba(224,123,57,0.16)',
  /** シートの後ろの暗幕 */
  backdrop: 'rgba(0,0,0,0.55)',
} as const;

/** 手紙の灯り（light_level 0〜4）ごとの光の大きさと濃さ（§7.3） */
export const letterGlow = [
  { size: 0.7, opacity: 0.25 },
  { size: 0.82, opacity: 0.45 },
  { size: 0.94, opacity: 0.65 },
  { size: 1.06, opacity: 0.82 },
  { size: 1.18, opacity: 1 },
] as const;

export const fontFamily = {
  /** 本文（お題・手紙）: 明朝 */
  serif: 'NotoSerifJP_400Regular',
  serifBold: 'NotoSerifJP_600SemiBold',
  /** UI: ゴシック */
  sans: 'NotoSansJP_400Regular',
  sansMedium: 'NotoSansJP_500Medium',
} as const;

/** 本文は大きめ・行間は広め（§11）。lineHeight は fontSize に対する倍率 */
export const typography = {
  question: { fontSize: 24, lineHeightRatio: 1.7, family: fontFamily.serif },
  letter: { fontSize: 17, lineHeightRatio: 2.0, family: fontFamily.serif },
  body: { fontSize: 15, lineHeightRatio: 1.8, family: fontFamily.sans },
  label: { fontSize: 13, lineHeightRatio: 1.6, family: fontFamily.sansMedium },
  caption: { fontSize: 12, lineHeightRatio: 1.6, family: fontFamily.sans },
} as const;
export type TypographyVariant = keyof typeof typography;

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 14,
  pill: 999,
} as const;

/** 動きは「ゆっくり、控えめに」（§11） */
export const motion = {
  fadeMs: 700,
  flickerMs: 2400,
} as const;

/** タップ領域の最小サイズ（アクセシビリティ） */
export const MIN_TOUCH_TARGET = 44;
