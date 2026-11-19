import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { TIMER_START_CUTOFF_MINUTES } from '@/config/constants';
import { now } from '@/lib/clock';

import { fetchTodayState } from './api';
import { nextBoundary, type TodayState } from './types';

export const todayQueryKey = ['today'] as const;

/** 新規タイマーを受け付ける最後の瞬間の直後（締め切り 6:59:59 の 10 分前を過ぎた時刻） */
export function timerStartClosesAt(t: TodayState): Date {
  return new Date(t.endsAt.getTime() - TIMER_START_CUTOFF_MINUTES * 60_000);
}

const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/**
 * 今日の状態。状態が変わりうる時刻（タイマー終了・締め切り・7:00）になったら取り直す。
 * アプリが前面に戻ったときも取り直す（再起動・復帰後に正しく復元する。§4）。
 */
export function useToday() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: todayQueryKey, queryFn: fetchTodayState });
  const data = query.data;

  useEffect(() => {
    if (!data) return;
    const next = nextBoundary(data, now(), timerStartClosesAt(data));
    if (!next) return;
    const ms = Math.min(next.getTime() - now().getTime() + 300, MAX_TIMEOUT_MS);
    const id = setTimeout(() => void client.invalidateQueries({ queryKey: todayQueryKey }), ms);
    return () => clearTimeout(id);
  }, [client, data]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void client.invalidateQueries({ queryKey: todayQueryKey });
    });
    return () => sub.remove();
  }, [client]);

  return query;
}
