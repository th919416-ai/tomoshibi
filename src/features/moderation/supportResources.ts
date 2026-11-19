/**
 * 相談窓口（§6-5）。運営が更新する。
 * 番号・受付時間は変わることがあるため、リリース前と定期的に、各窓口の公式サイトで最新の情報を確認すること。
 * 最終確認日: 未確認（要確認）
 */
export type SupportResource = {
  name: string;
  description: string;
  /** 電話番号（ハイフン区切り）。無い窓口は null */
  phone: string | null;
  hours: string;
  url: string | null;
};

export const SUPPORT_RESOURCES: readonly SupportResource[] = [
  {
    name: 'よりそいホットライン',
    description: 'どんなひとの、どんな悩みにもよりそって、一緒に解決する方法を探します。',
    phone: '0120-279-338',
    hours: '24時間',
    url: 'https://www.since2011.net/yorisoi/',
  },
  {
    name: 'いのちの電話',
    description: '孤独の中で悩んでいる人の話を、ボランティアの相談員が聴きます。',
    phone: '0570-783-556',
    hours: '午前10時〜午後10時',
    url: 'https://www.inochinodenwa.org/',
  },
  {
    name: 'こころの耳（厚生労働省）',
    description: '働く人のメンタルヘルス・ポータルサイト。電話・SNS・メールで相談できます。',
    phone: '0120-565-455',
    hours: '月・火 17時〜22時、土・日 10時〜16時',
    url: 'https://kokoro.mhlw.go.jp/',
  },
];
