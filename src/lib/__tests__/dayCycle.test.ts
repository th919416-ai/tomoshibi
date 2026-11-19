import { addDays, dayEndsAt, dayKeyOf, dayKeyParts, dayStartsAt, zonedParts } from '../dayCycle';

const jst = (s: string) => new Date(`${s}+09:00`);

// サーバーの supabase/tests/01_day_cycle.test.sql と同じ境界をクライアント側でも確認する
describe('dayKeyOf（6:59 / 7:00 の境界）', () => {
  it.each([
    ['2026-11-20T06:59:59', '2026-11-19', '6:59:59 は前日'],
    ['2026-11-20T07:00:00', '2026-11-20', '7:00:00 から新しい日'],
    ['2026-11-20T00:00:00', '2026-11-19', '0:00 はまだ前日'],
    ['2026-11-19T23:59:59', '2026-11-19', '23:59:59 は当日'],
    ['2027-01-01T06:59:59', '2026-12-31', '年またぎ'],
    ['2028-03-01T06:59:59', '2028-02-29', 'うるう年'],
  ])('%s → %s（%s）', (time, key) => {
    expect(dayKeyOf(jst(time))).toBe(key);
  });

  it('6:59:59.999 は前日、7:00:00.000 は当日（ミリ秒単位）', () => {
    expect(dayKeyOf(new Date('2026-11-19T21:59:59.999Z'))).toBe('2026-11-19');
    expect(dayKeyOf(new Date('2026-11-19T22:00:00.000Z'))).toBe('2026-11-20');
  });

  it('端末のタイムゾーンに関係なく日本時間で判定する', () => {
    // UTC 22:00 = JST 7:00
    expect(dayKeyOf(new Date(Date.UTC(2026, 10, 19, 22, 0, 0)))).toBe('2026-11-20');
  });
});

describe('時間枠', () => {
  it('開始は当日 7:00 JST、終了（排他的）は翌 7:00 JST', () => {
    expect(dayStartsAt('2026-11-19').toISOString()).toBe('2026-11-18T22:00:00.000Z');
    expect(dayEndsAt('2026-11-19').toISOString()).toBe('2026-11-19T22:00:00.000Z');
  });

  it('月末・年末をまたいで日を足せる', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('表示用の日付', () => {
  it('日本時間の要素を返す', () => {
    expect(zonedParts(jst('2026-11-20T06:59:00'))).toEqual({
      year: 2026,
      month: 11,
      day: 20,
      hour: 6,
      minute: 59,
      weekday: 5,
    });
  });

  it('day_key の暦日と曜日', () => {
    expect(dayKeyParts('2026-11-19')).toMatchObject({ month: 11, day: 19, weekday: 4 });
  });
});
