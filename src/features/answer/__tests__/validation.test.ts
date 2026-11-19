import { checkAnswerLength, countAnswerLength } from '../validation';

describe('回答の文字数（20〜400字、前後の空白を除く）', () => {
  it.each([
    [19, false],
    [20, true],
    [400, true],
    [401, false],
  ])('%i 文字 → %s', (n, ok) => {
    expect(checkAnswerLength('あ'.repeat(n)).ok).toBe(ok);
  });

  it('前後の空白・全角スペース・改行は数えない', () => {
    expect(countAnswerLength(`　\n ${'あ'.repeat(20)} \n　`)).toBe(20);
    expect(checkAnswerLength(`　${'あ'.repeat(19)}　`)).toEqual({
      ok: false,
      reason: 'too_short',
      length: 19,
    });
  });

  it('文中の改行は数える', () => {
    expect(countAnswerLength('あ\nい')).toBe(3);
  });

  it('絵文字も1文字（サーバーと同じ数え方）', () => {
    expect(countAnswerLength('🕯️')).toBe(2); // ろうそく + 異体字セレクタ
    expect(countAnswerLength('🔥')).toBe(1);
  });
});
