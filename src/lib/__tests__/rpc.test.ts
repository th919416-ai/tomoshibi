import { toErrorCode } from '../rpc';

describe('toErrorCode', () => {
  it('サーバーの理由コードをそのまま使う', () => {
    expect(toErrorCode('timer_exceeds_deadline')).toBe('timer_exceeds_deadline');
  });
  it('知らないメッセージは unknown（内部の文言を画面に出さない）', () => {
    expect(toErrorCode('duplicate key value violates unique constraint')).toBe('unknown');
    expect(toErrorCode(undefined)).toBe('unknown');
  });
});
