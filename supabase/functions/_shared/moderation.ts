/**
 * 回答の自動審査（CLAUDE.md §6）。Deno（Edge Function）と Jest の両方から使えるよう、外部に依存しない。
 * 判定の順番: 自傷の兆候 → 個人情報 → NG ワード → AI 判定 → 承認
 */
import { CRISIS_KATAKANA_WORDS, CRISIS_WORDS, NG_KATAKANA_WORDS, NG_WORDS } from './ngwords.ts';

export type RejectionReason = 'personal_info' | 'inappropriate' | 'other';

export type Verdict =
  | { status: 'approved'; signals: string[] }
  | { status: 'crisis'; signals: string[] }
  | { status: 'rejected'; reason: RejectionReason; signals: string[] }
  /** AI 判定に失敗したときなど。あとで再審査する */
  | { status: 'pending'; signals: string[] };

/** AI による判定（攻撃性・性的内容・自傷他害）。サービスは差し替え可能（§6-2, §14 未決定） */
export type AiJudge = (text: string) => Promise<'ok' | 'reject' | 'crisis'>;

/** 全角英数→半角、小文字化、カタカナ→ひらがな、ゼロ幅文字の除去 */
export function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[​-‍﻿]/g, '')
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

/** 空白・記号を取り除く（「死 に た い」のような分かち書きにも反応させる） */
function compact(text: string): string {
  return text.replace(/[\s・.,、。_\-ー~〜!！?？]/g, '');
}

export type PersonalInfoKind = 'phone' | 'email' | 'url' | 'sns_id';

export function detectPersonalInfo(raw: string): PersonalInfoKind[] {
  const text = normalize(raw);
  const found = new Set<PersonalInfoKind>();

  // 電話番号: 区切り（ハイフン・空白・括弧）を除いて 10〜11 桁、0 または +81 で始まる
  for (const m of text.matchAll(/\+?\d[\d\s()-]{8,}\d/g)) {
    const digits = m[0].replace(/\D/g, '');
    if (/^(0\d{9,10}|81\d{9,10})$/.test(digits)) found.add('phone');
  }
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(text)) found.add('email');
  if (/https?:\/\/|www\.|[a-z0-9-]+\.(com|net|org|jp|io|me|ly|link|info|xyz)(\/|\b)/.test(text)) {
    found.add('url');
  }
  const withoutEmails = text.replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g, '');
  if (/(^|[^a-z0-9._%+-])@[a-z0-9_.]{3,30}/.test(withoutEmails)) found.add('sns_id');
  // 「line id: xxx」「らいん xxx」「いんすた @xxx」など
  if (
    /(line|らいん|instagram|insta|いんすた|twitter|ついったー|tiktok|てぃっくとっく|discord|でぃすこ|x)\s*(id|あいでぃー)?\s*[:：は]?\s*@?[a-z0-9._-]{4,}/.test(
      text,
    )
  ) {
    found.add('sns_id');
  }
  return [...found];
}

export function detectWords(raw: string, words: readonly string[]): string[] {
  const text = compact(normalize(raw));
  return words.filter((w) => text.includes(compact(normalize(w))));
}

const KATAKANA = '\\u30a0-\\u30ff\\uff66-\\uff9f';
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 短い語をカタカナ（または英字）のまま、前後がカタカナ・英字でない位置だけで探す。
 * 「カスだ」は一致し、「カスタム」「アリスカ」は一致しない。ひらがな表記は対象にしない。
 */
export function detectKatakanaWords(raw: string, words: readonly string[]): string[] {
  const text = raw.normalize('NFKC');
  return words.filter((w) =>
    new RegExp(`(^|[^${KATAKANA}A-Za-z])${escape(w)}($|[^${KATAKANA}A-Za-z])`, 'i').test(text),
  );
}

export async function moderate(text: string, ai?: AiJudge): Promise<Verdict> {
  const crisis = [
    ...detectWords(text, CRISIS_WORDS),
    ...detectKatakanaWords(text, CRISIS_KATAKANA_WORDS),
  ];
  if (crisis.length) return { status: 'crisis', signals: crisis.map((w) => `crisis:${w}`) };

  const pii = detectPersonalInfo(text);
  if (pii.length) {
    return { status: 'rejected', reason: 'personal_info', signals: pii.map((k) => `pii:${k}`) };
  }

  const ng = [...detectWords(text, NG_WORDS), ...detectKatakanaWords(text, NG_KATAKANA_WORDS)];
  if (ng.length)
    return { status: 'rejected', reason: 'inappropriate', signals: ng.map((w) => `ng:${w}`) };

  if (ai) {
    try {
      const v = await ai(text);
      if (v === 'crisis') return { status: 'crisis', signals: ['ai:crisis'] };
      if (v === 'reject')
        return { status: 'rejected', reason: 'inappropriate', signals: ['ai:reject'] };
    } catch {
      return { status: 'pending', signals: ['ai:error'] };
    }
  }
  return { status: 'approved', signals: [] };
}
