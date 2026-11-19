import { callRpc } from '@/lib/rpc';

import type { AnswerStatus, Genre } from '../today/types';

/** 自分の手紙に届いた共感の数（翌日以降のみ。当日は null） */
export type ReactionCounts = { wakaru: number; hokkori: number; hatto: number };

export type ArchiveEntry = {
  answerId: string;
  dayKey: string;
  genre: Genre;
  question: string;
  body: string;
  status: AnswerStatus;
  timerMinutes: number | null;
  reactions: ReactionCounts | null;
};

export type ArchiveMonth = { month: string; months: string[]; entries: ArchiveEntry[] };

type Raw = {
  month: string;
  months: string[];
  entries: {
    answer_id: string;
    day_key: string;
    genre: Genre;
    question: string;
    body: string;
    status: AnswerStatus;
    timer_minutes: number | null;
    reactions: ReactionCounts | null;
  }[];
};

export const archiveQueryKey = (month: string) => ['archive', month] as const;

export async function fetchArchive(month: string): Promise<ArchiveMonth> {
  const r = await callRpc<Raw>('get_my_archive', { p_month: month });
  return {
    month: r.month,
    months: r.months,
    entries: r.entries.map((e) => ({
      answerId: e.answer_id,
      dayKey: e.day_key,
      genre: e.genre,
      question: e.question,
      body: e.body,
      status: e.status,
      timerMinutes: e.timer_minutes,
      reactions: e.reactions ?? null,
    })),
  };
}

export const deleteMyAnswer = (answerId: string) =>
  callRpc<void>('delete_my_answer', { p_answer_id: answerId });

/** 前後の月（記録のある月の中で） */
export function neighborMonths(months: string[], month: string) {
  const sorted = [...months].sort();
  return {
    prev: sorted.filter((m) => m < month).at(-1) ?? null,
    next: sorted.find((m) => m > month) ?? null,
  };
}
