import i18n from '@/i18n';

import { dayKeyParts, zonedParts } from './dayCycle';

const pad = (n: number) => String(n).padStart(2, '0');

function weekday(n: number): string {
  const days = i18n.t('date.weekdays', { returnObjects: true }) as readonly string[];
  return days[n] ?? '';
}

/** 11月19日（木）。日本時間で表示する */
export function formatMonthDay(date: Date): string {
  const p = zonedParts(date);
  return i18n.t('date.monthDay', { month: p.month, day: p.day, weekday: weekday(p.weekday) });
}

export function formatDayKey(dayKey: string): string {
  const p = dayKeyParts(dayKey);
  return i18n.t('date.monthDay', { month: p.month, day: p.day, weekday: weekday(p.weekday) });
}

/** 6:59 */
export function formatTime(date: Date): string {
  const p = zonedParts(date);
  return i18n.t('date.time', { hour: p.hour, minute: pad(p.minute) });
}

/** 残り時間（1:02:03 / 12:34） */
export function formatRemaining(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
}

export function formatYearMonth(month: string): string {
  const [y = 0, m = 0] = month.split('-').map(Number);
  return i18n.t('date.yearMonth', { year: y, month: m });
}
