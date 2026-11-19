import type { TimerMinutes } from '@/config/constants';

/** §4 の状態 */
export type DayState =
  'NOT_STARTED' | 'TIMER_RUNNING' | 'WRITABLE' | 'ANSWERED' | 'MISSED' | 'COMPLETED' | 'CLOSED';

export type Genre = 'discovery' | 'memory' | 'values' | 'imagine' | 'senses';
export type AnswerStatus = 'pending' | 'approved' | 'rejected' | 'crisis' | 'hidden';
export type RejectionReason = 'personal_info' | 'inappropriate' | 'other';

export type TodayState = {
  dayKey: string;
  startsAt: Date;
  endsAt: Date;
  serverNow: Date;
  state: DayState;
  question: { id: string; genre: Genre; body: string; sponsorName: string | null } | null;
  timer: { minutes: TimerMinutes; startedAt: Date; endsAt: Date } | null;
  writableUntil: Date | null;
  availableTimerOptions: TimerMinutes[];
  answer: {
    id: string;
    body: string;
    status: AnswerStatus;
    rejectionReason: RejectionReason | null;
  } | null;
  answerMinLength: number;
  answerMaxLength: number;
  showGlowNotice: boolean;
};

type Raw = Record<string, unknown>;
const date = (v: unknown) => new Date(String(v));
const obj = (v: unknown) => (v && typeof v === 'object' ? (v as Raw) : null);

/** get_today_state() の JSON を画面で使う形にする */
export function parseTodayState(json: unknown): TodayState {
  const r = obj(json);
  if (!r || typeof r.state !== 'string' || typeof r.day_key !== 'string') {
    throw new Error('Invalid today state');
  }
  const q = obj(r.question);
  const t = obj(r.timer);
  const a = obj(r.answer);
  return {
    dayKey: r.day_key,
    startsAt: date(r.starts_at),
    endsAt: date(r.ends_at),
    serverNow: date(r.server_now),
    state: r.state as DayState,
    question: q
      ? {
          id: String(q.id),
          genre: q.genre as Genre,
          body: String(q.body),
          sponsorName: (q.sponsor_name as string | null) ?? null,
        }
      : null,
    timer: t
      ? {
          minutes: Number(t.minutes) as TimerMinutes,
          startedAt: date(t.started_at),
          endsAt: date(t.ends_at),
        }
      : null,
    writableUntil: r.writable_until ? date(r.writable_until) : null,
    availableTimerOptions: ((r.available_timer_options as number[] | null) ?? []).map(
      (m) => m as TimerMinutes,
    ),
    answer: a
      ? {
          id: String(a.id),
          body: String(a.body),
          status: a.status as AnswerStatus,
          rejectionReason: (a.rejection_reason as RejectionReason | null) ?? null,
        }
      : null,
    answerMinLength: Number(r.answer_min_length ?? 20),
    answerMaxLength: Number(r.answer_max_length ?? 400),
    showGlowNotice: r.show_glow_notice === true,
  };
}

/** 状態ごとに開く画面（ホームはこれを見て切り替える） */
export type TodayRoute = 'home' | 'timer' | 'write' | 'support' | 'letters' | 'done';

export function routeForState(t: TodayState, supportAcknowledged: boolean): TodayRoute {
  switch (t.state) {
    case 'TIMER_RUNNING':
      return 'timer';
    case 'WRITABLE':
      return 'write';
    case 'ANSWERED':
      if (t.answer?.status === 'rejected') return 'write';
      if (t.answer?.status === 'crisis' && !supportAcknowledged) return 'support';
      return 'letters';
    case 'COMPLETED':
      return 'done';
    default:
      return 'home';
  }
}

/**
 * 次に状態が変わりうる時刻（この時刻に取り直す）。
 * タイマー終了・回答の受付終了・新規タイマーの受付終了・日付の切り替わり のうち最も早い未来。
 */
export function nextBoundary(t: TodayState, now: Date, closesAt: Date): Date | null {
  const candidates = [t.timer?.endsAt, t.writableUntil, closesAt, t.endsAt]
    .filter((d): d is Date => d instanceof Date)
    .filter((d) => d.getTime() > now.getTime());
  if (!candidates.length) return null;
  return new Date(Math.min(...candidates.map((d) => d.getTime())));
}
