import { getSupabase } from './supabase';

/**
 * サーバー（RPC）が返す理由コード。i18n の errors.* と対応する。
 * サーバーは `raise exception '<code>'` で理由を返す。
 */
export const KNOWN_ERROR_CODES = [
  'not_authenticated',
  'banned',
  'previous_day_in_progress',
  'question_not_ready',
  'invalid_timer_option',
  'day_closed',
  'timer_already_started',
  'timer_exceeds_deadline',
  'timer_cancel_not_allowed',
  'timer_not_running',
  'not_writable_yet',
  'answer_deadline_passed',
  'already_answered',
  'answer_too_short',
  'answer_too_long',
  'answer_required',
  'not_assigned',
  'invalid_reaction',
  'invalid_month',
  'answer_not_found',
  'invalid_push_token',
] as const;
export type ErrorCode = (typeof KNOWN_ERROR_CODES)[number] | 'unknown';

export class RpcError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RpcError';
  }
}

export function toErrorCode(message: string | undefined): ErrorCode {
  return (KNOWN_ERROR_CODES as readonly string[]).includes(message ?? '')
    ? (message as ErrorCode)
    : 'unknown';
}

export async function callRpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().rpc(fn, args);
  if (error) throw new RpcError(toErrorCode(error.message), error.message);
  return data as T;
}
