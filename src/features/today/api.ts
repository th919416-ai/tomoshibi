import { syncWithServer } from '@/lib/clock';
import { callRpc } from '@/lib/rpc';

import type { TimerMinutes } from '@/config/constants';

import { parseTodayState, type TodayState } from './types';

async function withClockSync(fn: () => Promise<unknown>): Promise<TodayState> {
  const started = Date.now();
  const raw = await fn();
  const state = parseTodayState(raw);
  syncWithServer(state.serverNow, started, Date.now());
  return state;
}

export const fetchTodayState = () => withClockSync(() => callRpc('get_today_state'));

export const startTimer = (minutes: TimerMinutes) =>
  withClockSync(() => callRpc('start_timer', { p_minutes: minutes }));

export const submitAnswer = (body: string) =>
  withClockSync(() => callRpc('submit_answer', { p_body: body }));

export const ackGlowNotice = () => callRpc<void>('ack_glow_notice');
