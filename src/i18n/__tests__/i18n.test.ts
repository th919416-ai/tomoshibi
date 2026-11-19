import i18n from '../index';
import { ja } from '../locales/ja';

function leaves(obj: object, prefix = ''): [string, unknown][] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? leaves(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]],
  );
}

describe('i18n', () => {
  it('日本語で初期化される', () => {
    expect(i18n.language).toBe('ja');
    expect(i18n.t('common.appName')).toBe('おいと間');
  });

  it('すべての文言が空でない文字列', () => {
    for (const [key, value] of leaves(ja)) {
      expect({ key, ok: typeof value === 'string' && value.length > 0 }).toEqual({ key, ok: true });
    }
  });
});
