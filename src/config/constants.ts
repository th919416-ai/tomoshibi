/**
 * 時間・文字数・通数・閾値はすべてここに集約する（CLAUDE.md §13: マジックナンバー禁止）。
 * DB 側で使う値はサーバーの設定テーブルが正。ここはクライアント表示・事前検証用。
 * 【仮決定】の値はオーナーの最終判断で変わる可能性がある。
 */

/** 1日の区切り（§3）。【仮決定】MVP は日本時間固定 */
export const APP_TIME_ZONE = 'Asia/Tokyo';
export const DAY_START_HOUR = 7;
/** Asia/Tokyo の UTC からのずれ（分）。日本は夏時間が無いため固定値で扱える */
export const APP_TIME_ZONE_UTC_OFFSET_MINUTES = 9 * 60;

/** 選べる思考時間（分）（§3.1） */
export const TIMER_OPTIONS = [10, 60, 360] as const;
export type TimerMinutes = (typeof TIMER_OPTIONS)[number];

/** 締め切りの何分前から新規タイマー開始を不可にするか（§3.1） */
export const TIMER_START_CUTOFF_MINUTES = 10;

/** 【仮決定】タイマー終了後、締め切りを過ぎても投稿できる猶予（§3.1） */
export const ANSWER_GRACE_MINUTES = 30;

/** 【仮決定】タイマーのキャンセル・選び直しを許可するか（§4） */
export const TIMER_CANCEL_ALLOWED = false;

/** 回答の文字数（前後の空白を除く）（§6） */
export const ANSWER_MIN_LENGTH = 20;
export const ANSWER_MAX_LENGTH = 400;

/** 1日に届く手紙（§7.1）。【仮決定】内訳 */
export const LETTERS_PER_DAY = 10;
export const LETTERS_RANDOM_SLOTS = 7;
export const LETTERS_GLOWING_SLOTS = 3;

/** 灯りの段階（§7.3）。クライアントは段階（0〜4）だけを受け取る */
export const LIGHT_LEVEL_MAX = 4;

/** 既読とみなすカードの表示時間（§7.5） */
export const LETTER_SEEN_DWELL_MS = 2000;

/** 自動で非表示にする通報数（異なるユーザー数）（§6） */
export const REPORT_HIDE_THRESHOLD = 3;

/** お問い合わせ先（運営が設定する。未設定ならお問い合わせ画面で準備中と表示） */
export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? '';
