import { fetchArchive, neighborMonths } from '../api';

describe('neighborMonths（月の切り替え）', () => {
  const months = ['2026-11', '2026-09', '2026-08'];
  it('記録のある月の中で前後を返す', () => {
    expect(neighborMonths(months, '2026-09')).toEqual({ prev: '2026-08', next: '2026-11' });
  });
  it('記録の無い月からでも辿れる', () => {
    expect(neighborMonths(months, '2026-10')).toEqual({ prev: '2026-09', next: '2026-11' });
  });
  it('端では null', () => {
    expect(neighborMonths(months, '2026-11')).toEqual({ prev: '2026-09', next: null });
  });
});

jest.mock('@/lib/rpc', () => ({
  callRpc: jest.fn().mockResolvedValue({
    month: '2026-11',
    months: ['2026-11'],
    entries: [
      {
        answer_id: 'a',
        day_key: '2026-11-19',
        genre: 'memory',
        question: 'q',
        body: 'b',
        status: 'approved',
        timer_minutes: 10,
        reactions: null,
      },
      {
        answer_id: 'c',
        day_key: '2026-11-18',
        genre: 'values',
        question: 'q',
        body: 'b',
        status: 'approved',
        timer_minutes: 60,
        reactions: { wakaru: 3, hokkori: 0, hatto: 1 },
      },
    ],
  }),
}));

describe('fetchArchive', () => {
  it('当日の分は共感数なし、翌日以降は種類ごとの数', async () => {
    const r = await fetchArchive('2026-11');
    expect(r.entries[0]?.reactions).toBeNull();
    expect(r.entries[1]?.reactions).toEqual({ wakaru: 3, hokkori: 0, hatto: 1 });
  });
});
