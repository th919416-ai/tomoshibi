// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  expoConfig,
  prettierRecommended,
  {
    ignores: ['dist/*', '.expo/*', 'supabase/functions/*', 'coverage/*'],
  },
  {
    rules: {
      // CLAUDE.md §13: i18n 化の徹底。画面のテキストは src/i18n から取得する。
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXText[value=/[\\u3040-\\u30ff\\u4e00-\\u9fff]/]',
          message: '画面の文字列は i18n（src/i18n/locales）に置いてください。',
        },
      ],
    },
  },
]);
