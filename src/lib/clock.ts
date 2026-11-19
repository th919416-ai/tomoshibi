/**
 * 現在時刻（CLAUDE.md §3）。
 * - 判定はすべてサーバーで行う。ここは表示（残り時間・日付）用。
 * - サーバーの時刻との差を覚えておき、端末時計がずれていても表示が狂わないようにする。
 * - テストでは setClockOverride で時刻を固定できる。
 */
let overrideMs: number | null = null;
let serverOffsetMs = 0;

export function now(): Date {
  if (overrideMs !== null) return new Date(overrideMs);
  return new Date(Date.now() + serverOffsetMs);
}

/**
 * サーバーが返した現在時刻で端末時計のずれを補正する。
 * 通信にかかった時間の半分を往路とみなす。
 */
export function syncWithServer(serverNow: Date, requestStartedAtMs: number, receivedAtMs: number) {
  const midpoint = (requestStartedAtMs + receivedAtMs) / 2;
  serverOffsetMs = serverNow.getTime() - midpoint;
}

export function getServerOffsetMs(): number {
  return serverOffsetMs;
}

/** テスト用: 時刻を固定する（null で解除） */
export function setClockOverride(date: Date | null): void {
  overrideMs = date ? date.getTime() : null;
}

/** テスト用 */
export function resetClock(): void {
  overrideMs = null;
  serverOffsetMs = 0;
}
