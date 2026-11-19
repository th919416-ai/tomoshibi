import { contrastRatio, MIN_CONTRAST_RATIO } from '../contrast';
import { colors } from '../tokens';

// §11: 文字と背景のコントラスト比 4.5:1 以上
describe('色トークンのコントラスト', () => {
  const pairs: [string, string, string][] = [
    ['text.paper / bg.night', colors.text.paper, colors.bg.night],
    ['text.paper / bg.charcoal', colors.text.paper, colors.bg.charcoal],
    ['text.muted / bg.night', colors.text.muted, colors.bg.night],
    ['text.muted / bg.charcoal', colors.text.muted, colors.bg.charcoal],
    ['accent.candle / bg.night', colors.accent.candle, colors.bg.night],
    ['text.onCandle / accent.candle', colors.text.onCandle, colors.accent.candle],
  ];

  it.each(pairs)('%s は 4.5:1 以上', (_name, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(MIN_CONTRAST_RATIO);
  });

  it('白と黒は 21:1', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
  });

  it('不正な色はエラー', () => {
    expect(() => contrastRatio('red', '#000000')).toThrow();
  });
});
