import { neighborMonths } from '../api';

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
