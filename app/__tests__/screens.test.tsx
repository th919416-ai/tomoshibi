import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { useState } from 'react';

import '@/i18n';
import { ja } from '@/i18n/locales/ja';

import MainLayout from '../(main)/_layout';
import Home from '../(main)/index';
import Letters from '../(main)/letters';
import Timer from '../(main)/timer';
import Write from '../(main)/write';
import Onboarding from '../(onboarding)/onboarding';

const mockRpc = jest.fn();
jest.mock('@/lib/rpc', () => ({
  ...jest.requireActual('@/lib/rpc'),
  callRpc: (fn: string, args?: unknown) => mockRpc(fn, args),
}));

function Root() {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}

const routes = {
  _layout: Root,
  '(main)/_layout': MainLayout,
  '(main)/index': Home,
  '(main)/timer': Timer,
  '(main)/write': Write,
  '(main)/letters': Letters,
  '(onboarding)/onboarding': Onboarding,
};

const base = {
  day_key: '2026-11-19',
  starts_at: '2026-11-18T22:00:00Z',
  ends_at: '2026-11-19T22:00:00Z',
  server_now: '2026-11-19T15:30:00Z',
  question: {
    id: 'q',
    genre: 'memory',
    body: '子どもの頃、一番好きだった場所は？',
    sponsor_name: null,
  },
  timer: null,
  writable_until: null,
  available_timer_options: [] as number[],
  timer_cancel_allowed: false,
  answer_min_length: 20,
  answer_max_length: 400,
  answer: null,
  show_glow_notice: false,
};

function serve(today: object, extra: Record<string, unknown> = {}, onboarded = true) {
  mockRpc.mockImplementation(async (fn: string) => {
    if (fn === 'get_my_profile') return { notify_question: false, notify_timer: true, onboarded };
    if (fn === 'get_today_state') return { ...base, ...today };
    if (fn in extra) return extra[fn];
    return null;
  });
}

beforeEach(() => mockRpc.mockReset());

describe('画面の切り替え（§4）', () => {
  it('はじめての人はオンボーディングへ', async () => {
    serve({ state: 'NOT_STARTED' }, {}, false);
    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByText(ja.onboarding.pages[0].title)).toBeOnTheScreen();
  });

  it('ホーム: お題と、締め切りに間に合う選択肢だけが押せる', async () => {
    serve({ state: 'NOT_STARTED', available_timer_options: [10, 60] });
    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByText(base.question.body)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '10分' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '1時間' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '6時間' })).toBeDisabled();
    expect(screen.getByText(ja.home.timerUnavailable)).toBeOnTheScreen();
  });

  it('ホーム: 締め切り後は「また明日の朝7時に」', async () => {
    serve({ state: 'CLOSED' });
    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByText(ja.home.closed)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: '10分' })).toBeNull();
  });

  it('タイマー中にホームを開くと、キャンドルとメッセージだけの画面へ', async () => {
    serve({
      state: 'TIMER_RUNNING',
      timer: { minutes: 60, started_at: '2026-11-19T15:00:00Z', ends_at: '2026-11-19T16:00:00Z' },
    });
    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByText(ja.timer.message)).toBeOnTheScreen();
    expect(screen.queryByLabelText(ja.write.inputLabel)).toBeNull();
  });

  it('タイマー中に回答画面を直接開いても、入力欄は出ない', async () => {
    serve({
      state: 'TIMER_RUNNING',
      timer: { minutes: 60, started_at: '2026-11-19T15:00:00Z', ends_at: '2026-11-19T16:00:00Z' },
    });
    await renderRouter(routes, { initialUrl: '/write' });
    expect(await screen.findByText(ja.timer.message)).toBeOnTheScreen();
    expect(screen.queryByLabelText(ja.write.inputLabel)).toBeNull();
  });

  it('回答: 20字に満たないと送れない', async () => {
    serve({
      state: 'WRITABLE',
      timer: { minutes: 10, started_at: '2026-11-19T15:00:00Z', ends_at: '2026-11-19T15:10:00Z' },
      writable_until: '2026-11-19T22:00:00Z',
    });
    await renderRouter(routes, { initialUrl: '/' });
    const input = await screen.findByLabelText(ja.write.inputLabel);
    await fireEvent.changeText(input, 'あ'.repeat(19));
    expect(screen.getByRole('button', { name: ja.write.submit })).toBeDisabled();
    await fireEvent.changeText(input, 'あ'.repeat(20));
    expect(screen.getByRole('button', { name: ja.write.submit })).toBeEnabled();
    expect(screen.getByText('あと380文字')).toBeOnTheScreen();
  });

  it('却下された回答は、理由を伝えて書き直せる', async () => {
    serve({
      state: 'ANSWERED',
      timer: { minutes: 10, started_at: '2026-11-19T15:00:00Z', ends_at: '2026-11-19T15:10:00Z' },
      writable_until: '2026-11-19T22:00:00Z',
      answer: {
        id: 'a',
        body: '090-1234-5678 に電話してね。今日の問いの答えです。',
        status: 'rejected',
        rejection_reason: 'personal_info',
      },
    });
    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByText(ja.write.rejected.personal_info)).toBeOnTheScreen();
  });

  it('共感の広場: 手紙と共感ボタン。共感の数は出さない', async () => {
    serve(
      {
        state: 'ANSWERED',
        answer: { id: 'mine', body: 'わたしの答え', status: 'pending', rejection_reason: null },
      },
      {
        get_today_letters: {
          day_key: '2026-11-19',
          is_full: true,
          completed: false,
          letters: [
            {
              slot: 1,
              answer_id: 'l1',
              body: '祖母の家の縁側。',
              light_level: 3,
              my_reactions: ['hokkori'],
              seen: false,
            },
            {
              slot: 2,
              answer_id: 'l2',
              body: '団地の裏の踊り場。',
              light_level: 0,
              my_reactions: [],
              seen: false,
            },
          ],
        },
      },
    );
    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByText('祖母の家の縁側。')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '「わかる」を伝える' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '「ほっこり」を取り消す' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '「ハッとした」を伝える' })).toBeOnTheScreen();
    // 画面に出る数字は「何通目」だけ
    expect(screen.queryAllByText(/^\d+$/)).toHaveLength(0);
  });
});
