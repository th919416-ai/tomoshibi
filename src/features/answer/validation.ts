import { ANSWER_MAX_LENGTH, ANSWER_MIN_LENGTH } from '@/config/constants';

/**
 * 文字数の検証（§6-1）。前後の空白（全角スペース・改行を含む）を除き、
 * 絵文字なども1文字として数える（サーバーの char_length と同じ数え方）。
 */
export function countAnswerLength(text: string): number {
  return [...text.trim()].length;
}

export type LengthCheck =
  { ok: true; length: number } | { ok: false; reason: 'too_short' | 'too_long'; length: number };

export function checkAnswerLength(
  text: string,
  min: number = ANSWER_MIN_LENGTH,
  max: number = ANSWER_MAX_LENGTH,
): LengthCheck {
  const length = countAnswerLength(text);
  if (length < min) return { ok: false, reason: 'too_short', length };
  if (length > max) return { ok: false, reason: 'too_long', length };
  return { ok: true, length };
}
