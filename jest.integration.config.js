/**
 * ローカル Supabase に対する結合テスト用。React Native の環境を使わず Node の fetch で通信する。
 * 実行前に `npx supabase start` が必要。
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.integration.test.ts'],
  testTimeout: 20000,
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  testPathIgnorePatterns: ['/node_modules/'],
};
