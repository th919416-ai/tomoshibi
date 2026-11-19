import {
  ANSWER_MAX_LENGTH,
  ANSWER_MIN_LENGTH,
  LETTERS_GLOWING_SLOTS,
  LETTERS_PER_DAY,
  LETTERS_RANDOM_SLOTS,
  TIMER_OPTIONS,
} from '../constants';

describe('定数の整合性', () => {
  it('手紙の内訳の合計は1日の通数と一致する（§7.1）', () => {
    expect(LETTERS_RANDOM_SLOTS + LETTERS_GLOWING_SLOTS).toBe(LETTERS_PER_DAY);
  });

  it('タイマーの選択肢は DB の check 制約（10,60,360）と一致する（§5）', () => {
    expect([...TIMER_OPTIONS]).toEqual([10, 60, 360]);
  });

  it('文字数は DB の check 制約（20〜400）と一致する（§5）', () => {
    expect([ANSWER_MIN_LENGTH, ANSWER_MAX_LENGTH]).toEqual([20, 400]);
  });
});
