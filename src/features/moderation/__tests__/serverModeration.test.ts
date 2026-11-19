// Edge Function `moderate-answer` の判定ロジック（supabase/functions/_shared/moderation.ts）のテスト
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  detectPersonalInfo,
  detectWords,
  moderate,
  normalize,
} from '../../../../supabase/functions/_shared/moderation.ts';
import { CRISIS_WORDS } from '../../../../supabase/functions/_shared/ngwords.ts';

const ok = '祖母の家の縁側で、足をぶらぶらさせながらスイカを食べた夏の午後を思い出しました。';

describe('normalize', () => {
  it('全角英数・カタカナを揃える', () => {
    expect(normalize('ＬＩＮＥ　ＩＤ：ＡＢＣ　シニタイ')).toBe('line id:abc しにたい');
  });
});

describe('個人情報の検出（§6-2）', () => {
  it.each([
    ['090-1234-5678 に連絡ください', 'phone'],
    ['０９０（１２３４）５６７８', 'phone'],
    ['03 1234 5678', 'phone'],
    ['+81 90 1234 5678', 'phone'],
    ['mail: hello.world@example.com', 'email'],
    ['https://example.com を見て', 'url'],
    ['www.example.jp', 'url'],
    ['tomoshibi.jp/abc', 'url'],
    ['フォローしてね @my_account', 'sns_id'],
    ['LINE ID: tomo1234', 'sns_id'],
    ['インスタ @hello.world', 'sns_id'],
    ['ラインは tomo_1234 です', 'sns_id'],
  ])('%s → %s', (text, kind) => {
    expect(detectPersonalInfo(text)).toContain(kind);
  });

  it.each([
    ok,
    '10年後の自分へ。2036年の春に、また桜を見ていますか。',
    '朝7時30分に起きて、20分だけ散歩しました。',
    '1,000円のケーキを買った。',
  ])('普通の文章は検出しない: %s', (text) => {
    expect(detectPersonalInfo(text)).toEqual([]);
  });
});

describe('自傷・希死念慮の兆候', () => {
  it.each(['もう死にたいと思う夜がある', 'シニタイ', '消え た い'])('%s を検出する', (text) => {
    expect(detectWords(text, CRISIS_WORDS).length).toBeGreaterThan(0);
  });

  it.each(['リスカをしてしまった', '昨日ODした'])('%s は crisis', async (text) => {
    await expect(moderate(text)).resolves.toMatchObject({ status: 'crisis' });
  });
});

describe('moderate（判定の順番）', () => {
  it('問題が無ければ承認', async () => {
    await expect(moderate(ok)).resolves.toEqual({ status: 'approved', signals: [] });
  });

  it('自傷の兆候は crisis（他の理由より優先）', async () => {
    const v = await moderate('死にたい。090-1234-5678');
    expect(v.status).toBe('crisis');
  });

  it('個人情報は rejected（personal_info）', async () => {
    await expect(moderate(`${ok} @someone`)).resolves.toMatchObject({
      status: 'rejected',
      reason: 'personal_info',
    });
  });

  it('NG ワードは rejected（inappropriate）', async () => {
    await expect(moderate(`${ok}うざい`)).resolves.toMatchObject({
      status: 'rejected',
      reason: 'inappropriate',
    });
  });

  it('AI 判定を差し込める', async () => {
    await expect(moderate(ok, async () => 'reject')).resolves.toMatchObject({ status: 'rejected' });
    await expect(moderate(ok, async () => 'crisis')).resolves.toMatchObject({ status: 'crisis' });
  });

  it('AI 判定が失敗したら審査待ちのまま（あとで再審査）', async () => {
    const failing = async (): Promise<'ok'> => {
      throw new Error('timeout');
    };
    await expect(moderate(ok, failing)).resolves.toMatchObject({ status: 'pending' });
  });
});

describe('普通の文章は弾かない（誤検知の防止）', () => {
  it.each([
    'そろそろ家に帰ろう、と思った夕方。かえろうかな、と独り言を言った。',
    '風がかすかに吹いて、カーテンが揺れていた。',
    '積み上げた本がくずれる音で目が覚めた日のこと。',
    'カスタムしたノートを、カステラを食べながら眺めていた。',
    'こころすっきりした朝だった。久しぶりによく眠れた気がする。',
    '最近、副業を始めた友人の話を聞いて、少し勇気をもらった。',
    'アリスかわいいね、と娘が絵本を見ながら言った夜のこと。',
    'ブースの前で待っていたら、知らない人が席をゆずってくれた。',
    '死ぬほど笑った日のことを、ときどき思い出す。',
    'エロール・フリンの古い映画を、祖父と一緒に観た記憶がある。',
  ])('%s', async (text) => {
    await expect(moderate(text)).resolves.toEqual({ status: 'approved', signals: [] });
  });

  it('運営が用意した手紙（seed）は、すべて自動審査を通る', async () => {
    const root = join(__dirname, '../../../../supabase');
    const seed = ['seed.sql', 'content/002_letters_2026-11-21_to_12-15.sql']
      .map((f) => readFileSync(join(root, f), 'utf8'))
      .join('\n');
    const bodies = [...seed.matchAll(/\('[^']+', '([^']{20,})'\)/g)].map((m) => m[1]!);
    expect(bodies.length).toBe(60 + 250);
    for (const body of bodies) {
      const v = await moderate(body);
      expect({ body, status: v.status }).toEqual({ body, status: 'approved' });
    }
  });
});

describe('悪口・性的な語は弾く', () => {
  it.each([
    'お前はほんとうにカスだな。何をやってもだめだと思う。',
    'あいつはクズ。もう二度と顔も見たくないし話したくもない。',
    'エロ画像を集めるのが趣味です。誰か一緒に見ませんか。',
    'うざい人ばかりの職場で、毎日が本当にしんどいです。',
    '死ねと思うくらい、あの人のことが許せなかった日がある。',
    'シネ、と書いた紙を机に入れられたことがある。ひどいと思う。',
  ])('%s', async (text) => {
    await expect(moderate(text)).resolves.toMatchObject({
      status: 'rejected',
      reason: 'inappropriate',
    });
  });
});
