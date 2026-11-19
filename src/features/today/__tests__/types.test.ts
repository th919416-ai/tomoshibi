import { nextBoundary, parseTodayState, routeForState, type TodayState } from '../types';

const raw = {
  day_key: '2026-11-19',
  starts_at: '2026-11-18T22:00:00Z',
  ends_at: '2026-11-19T22:00:00Z',
  server_now: '2026-11-19T00:00:00Z',
  state: 'NOT_STARTED',
  question: { id: 'q1', genre: 'memory', body: '問い', sponsor_name: null },
  timer: null,
  writable_until: null,
  available_timer_options: [10, 60, 360],
  timer_cancel_allowed: false,
  answer_min_length: 20,
  answer_max_length: 400,
  answer: null,
  show_glow_notice: false,
};

const make = (patch: Partial<TodayState>): TodayState => ({ ...parseTodayState(raw), ...patch });

describe('parseTodayState', () => {
  it('サーバーの JSON を画面用の形にする', () => {
    const s = parseTodayState(raw);
    expect(s.dayKey).toBe('2026-11-19');
    expect(s.endsAt.toISOString()).toBe('2026-11-19T22:00:00.000Z');
    expect(s.question?.genre).toBe('memory');
    expect(s.availableTimerOptions).toEqual([10, 60, 360]);
  });

  it('形が違えばエラー', () => {
    expect(() => parseTodayState({})).toThrow();
  });
});

describe('routeForState（状態ごとの画面）', () => {
  const answer = (status: 'pending' | 'rejected' | 'crisis') => ({
    id: 'a',
    body: 'x',
    status,
    rejectionReason: null,
  });

  it.each([
    ['NOT_STARTED', 'home'],
    ['CLOSED', 'home'],
    ['MISSED', 'home'],
    ['TIMER_RUNNING', 'timer'],
    ['WRITABLE', 'write'],
    ['COMPLETED', 'done'],
  ] as const)('%s → %s', (state, route) => {
    expect(routeForState(make({ state }), false)).toBe(route);
  });

  it('投稿済みなら広場へ（審査中でも）', () => {
    expect(routeForState(make({ state: 'ANSWERED', answer: answer('pending') }), false)).toBe(
      'letters',
    );
  });

  it('却下されたら書き直しへ', () => {
    expect(routeForState(make({ state: 'ANSWERED', answer: answer('rejected') }), false)).toBe(
      'write',
    );
  });

  it('crisis なら先に相談窓口の案内、確認後は広場へ', () => {
    const s = make({ state: 'ANSWERED', answer: answer('crisis') });
    expect(routeForState(s, false)).toBe('support');
    expect(routeForState(s, true)).toBe('letters');
  });
});

describe('nextBoundary（取り直す時刻）', () => {
  const now = new Date('2026-11-19T00:00:00Z');
  const closes = new Date('2026-11-19T21:50:00Z');

  it('タイマー中はタイマー終了時刻', () => {
    const s = make({
      timer: {
        minutes: 10,
        startedAt: now,
        endsAt: new Date('2026-11-19T00:10:00Z'),
      },
    });
    expect(nextBoundary(s, now, closes)?.toISOString()).toBe('2026-11-19T00:10:00.000Z');
  });

  it('開始前は新規タイマーの受付終了（6:50）', () => {
    expect(nextBoundary(make({}), now, closes)?.toISOString()).toBe('2026-11-19T21:50:00.000Z');
  });

  it('受付終了後は 7:00 の切り替わり', () => {
    const late = new Date('2026-11-19T21:55:00Z');
    expect(nextBoundary(make({}), late, closes)?.toISOString()).toBe('2026-11-19T22:00:00.000Z');
  });
});
