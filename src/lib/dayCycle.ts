import { APP_TIME_ZONE_UTC_OFFSET_MINUTES, DAY_START_HOUR } from '@/config/constants';

/**
 * 「1日」の計算（表示用）。正はサーバーの app_day_key()。ここは同じ定義をクライアントで再現したもの。
 * day_key = (現在時刻 JST − 7時間) の日付。
 */
const OFFSET_MS = APP_TIME_ZONE_UTC_OFFSET_MINUTES * 60_000;
const DAY_START_MS = DAY_START_HOUR * 3_600_000;
const DAY_MS = 86_400_000;

const pad = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' */
export type DayKey = string;

export function dayKeyOf(date: Date): DayKey {
  const shifted = new Date(date.getTime() + OFFSET_MS - DAY_START_MS);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

function parseDayKey(key: DayKey): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) throw new Error(`Invalid day key: ${key}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** その日が始まる時刻（7:00 JST） */
export function dayStartsAt(key: DayKey): Date {
  return new Date(parseDayKey(key) - OFFSET_MS + DAY_START_MS);
}

/** その日が終わる時刻（排他的。翌 7:00 JST）。締め切り 6:59:59 はこの直前 */
export function dayEndsAt(key: DayKey): Date {
  return new Date(dayStartsAt(key).getTime() + DAY_MS);
}

export function addDays(key: DayKey, days: number): DayKey {
  const d = new Date(parseDayKey(key) + days * DAY_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 日本時間での日付・時刻の要素（表示用） */
export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 = 日曜 */
  weekday: number;
};

export function zonedParts(date: Date): ZonedParts {
  const z = new Date(date.getTime() + OFFSET_MS);
  return {
    year: z.getUTCFullYear(),
    month: z.getUTCMonth() + 1,
    day: z.getUTCDate(),
    hour: z.getUTCHours(),
    minute: z.getUTCMinutes(),
    weekday: z.getUTCDay(),
  };
}

/** day_key の暦日（表示用）。'2026-11-19' → 11月19日（木） の要素 */
export function dayKeyParts(key: DayKey): ZonedParts {
  return zonedParts(new Date(parseDayKey(key) - OFFSET_MS));
}
