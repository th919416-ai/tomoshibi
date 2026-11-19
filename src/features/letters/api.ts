import { callRpc } from '@/lib/rpc';

export const REACTION_TYPES = ['wakaru', 'hokkori', 'hatto'] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];
export type ReportReason = 'offensive' | 'personal_info' | 'self_harm' | 'spam' | 'other';
export const REPORT_REASONS: readonly ReportReason[] = [
  'offensive',
  'personal_info',
  'self_harm',
  'spam',
  'other',
];

/** 届いた手紙。数や送り主は含まれない（§5.1） */
export type Letter = {
  slot: number;
  answerId: string;
  body: string;
  /** 0〜4 の灯りの段階 */
  lightLevel: number;
  myReactions: ReactionType[];
  seen: boolean;
};

export type LettersResult = {
  dayKey: string;
  letters: Letter[];
  isFull: boolean;
  completed: boolean;
};

type RawLetter = {
  slot: number;
  answer_id: string;
  body: string;
  light_level: number;
  my_reactions: ReactionType[];
  seen: boolean;
};

export function parseLetters(raw: {
  day_key: string;
  letters: RawLetter[];
  is_full: boolean;
  completed: boolean;
}): LettersResult {
  return {
    dayKey: raw.day_key,
    isFull: raw.is_full,
    completed: raw.completed,
    letters: raw.letters.map((l) => ({
      slot: l.slot,
      answerId: l.answer_id,
      body: l.body,
      lightLevel: Math.max(0, Math.min(4, l.light_level)),
      myReactions: l.my_reactions,
      seen: l.seen,
    })),
  };
}

export const lettersQueryKey = ['letters'] as const;

export const fetchLetters = async () => parseLetters(await callRpc('get_today_letters'));

export async function setReaction(answerId: string, type: ReactionType, on: boolean) {
  const r = await callRpc<{ light_level: number; my_reactions: ReactionType[] }>('set_reaction', {
    p_answer_id: answerId,
    p_type: type,
    p_on: on,
  });
  return { lightLevel: r.light_level, myReactions: r.my_reactions };
}

export async function markSeen(answerId: string): Promise<{ completed: boolean }> {
  return callRpc('mark_letter_seen', { p_answer_id: answerId });
}

export const reportLetter = (answerId: string, reason: ReportReason) =>
  callRpc<void>('report_letter', { p_answer_id: answerId, p_reason: reason });

export const blockLetterAuthor = (answerId: string) =>
  callRpc<void>('block_letter_author', { p_answer_id: answerId });
