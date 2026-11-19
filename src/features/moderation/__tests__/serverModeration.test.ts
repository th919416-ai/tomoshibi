// Edge Function `moderate-answer` の判定ロジック（supabase/functions/_shared/moderation.ts）のテスト
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
  it.each(['もう死にたいと思う夜がある', 'シニタイ', '消え た い', 'リスカをしてしまった'])(
    '%s を検出する',
    (text) => {
      expect(detectWords(text, CRISIS_WORDS).length).toBeGreaterThan(0);
    },
  );
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
