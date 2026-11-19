# ともしび（仮称）

1日1回届く「問い」に、スマホから離れて考えてから答え、同じ問いに向き合った人の手紙を10通だけ静かに読むアプリ。

- 仕様: [CLAUDE.md](./CLAUDE.md)
- 実装時に決めたこと: [docs/decisions.md](./docs/decisions.md)
- 本番の準備・運用・リリース手順: [docs/operations.md](./docs/operations.md)

## 必要なもの

- Node.js 22 以上
- Docker（ローカルの Supabase を動かすため）
- 実機での確認には開発ビルド（広告などのネイティブ機能を含むため Expo Go では動きません）

## はじめかた

```bash
npm install
npx supabase start          # ローカル Supabase（マイグレーションと開発用 seed が入る）
cp .env.example .env        # supabase start の出力にある API_URL と ANON_KEY を書く
npm start                   # Expo の開発サーバー
```

ローカルの seed には、今日の3日前から30日分のお題と、最初の5日分の運営の手紙が入っています。

## よく使うコマンド

| コマンド | 内容 |
|---|---|
| `npm run check` | 型チェック・Lint・整形チェック・単体テスト |
| `npm test` | 単体テスト・画面のテスト（Jest + React Native Testing Library） |
| `npm run test:db` | DB のテスト（pgTAP。時刻の境界・RLS・手紙の配信など） |
| `npm run test:integration` | ローカル Supabase への HTTP の結合テスト（`SUPABASE_TEST_ANON_KEY` が必要） |
| `npm run db:types` | DB から TypeScript の型を生成 |
| `npm run legal:export` | 規約類を `docs/legal/` に Markdown で書き出す |

## 構成

```
app/                 画面（expo-router）
src/features/        機能ごとのロジック（today, answer, letters, archive, settings, moderation, ads, auth）
src/lib/             Supabase・時計・日付・通知など
src/ui/              デザイントークンと共通コンポーネント
src/i18n/            文言（日本語）
src/content/         規約類
supabase/migrations/ DB（ステップごと）
supabase/functions/  Edge Functions（審査・朝の通知）
supabase/tests/      DB のテスト（pgTAP）
```
