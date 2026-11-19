import { getServerOffsetMs, now, resetClock, setClockOverride, syncWithServer } from '../clock';

afterEach(resetClock);

describe('clock', () => {
  it('差し替えた時刻を返す', () => {
    setClockOverride(new Date('2026-11-19T22:00:00Z'));
    expect(now().toISOString()).toBe('2026-11-19T22:00:00.000Z');
  });

  it('サーバー時刻との差を補正する（往復時間の半分を考慮）', () => {
    jest.spyOn(Date, 'now').mockReturnValue(10_000);
    // 端末で 9_000 に送信し 11_000 に受信。サーバーは 15_000 と答えた → 端末は 5 秒遅れている
    syncWithServer(new Date(15_000), 9_000, 11_000);
    expect(getServerOffsetMs()).toBe(5_000);
    expect(now().getTime()).toBe(15_000);
    jest.restoreAllMocks();
  });
});
