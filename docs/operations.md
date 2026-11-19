# 運用・リリース手順

アカウントや鍵が必要な作業をまとめたものです。上から順に進めてください。
コマンドはリポジトリのルートで実行します。

---

## 1. 本番の Supabase

1. Supabase で本番用のプロジェクトを作り、リポジトリと結び付けてマイグレーションを適用する。
   ```bash
   npx supabase link --project-ref <プロジェクトの ref>
   npx supabase db push
   ```
   `db push` は `supabase/seed.sql` を流しません（seed は開発用）。
2. ダッシュボードの **Authentication** で次を設定する。
   - Anonymous sign-ins: 有効
   - Manual linking: 有効（匿名アカウントに Apple / Google を連携するため）
   - Apple / Google プロバイダ: 各社の開発者コンソールで作った ID とシークレットを登録
   - Redirect URLs: `tomoshibi://auth-callback` を追加
   - 匿名サインインのレート制限: 必要に応じて調整
3. `app_settings.allow_clock_override` が **false** のままであることを確認する（時刻の差し替えはテスト専用）。
   ```sql
   select allow_clock_override from public.app_settings;
   ```

### 設定値の変更

時間・通数・閾値などのサーバー側の値は `public.app_settings`（1行だけ）にあります。【仮決定】の値はここで変えられます。

| 列 | 意味 | 初期値 |
|---|---|---|
| `timer_options` | 選べる思考時間（分） | `{10,60,360}` |
| `timer_start_cutoff_minutes` | 締め切りの何分前から新規タイマー不可 | 10 |
| `answer_grace_minutes` | タイマー終了後の投稿猶予 | 30 |
| `allow_timer_cancel` | タイマーの取り消しを許可 | false |
| `answer_min_length` / `answer_max_length` | 文字数 | 20 / 400 |
| `letters_per_day` / `letters_random_slots` / `letters_glowing_slots` | 手紙の通数と内訳 | 10 / 7 / 3 |
| `light_thresholds` | 共感数 → 灯りの段階の閾値 | `{1,3,6,10}` |
| `glow_exposure_cap` | 灯り枠で同じ手紙を配る上限 | 30 |
| `report_hide_threshold` | 自動で非表示にする通報人数 | 3 |

アプリ側の表示用の値は `src/config/constants.ts` にあります。両方を合わせて変えてください。

---

## 2. お題と初期回答の入稿

Supabase Studio の Table Editor か SQL Editor で入れます。お題は前日までに入れておきます（当日 7:00 から見えるようになります）。

```sql
insert into public.questions (day_key, genre, body) values
  ('2026-12-01', 'discovery', '最近あった、ちょっとうれしかったことは？');
-- genre: discovery / memory / values / imagine / senses
```

手紙が足りない日のための運営の回答（seed）:

```sql
insert into public.answers (user_id, question_id, day_key, body, status, is_seed)
select null, q.id, q.day_key, '（20〜400字の回答）', 'approved', true
from public.questions q where q.day_key = '2026-12-01';
```

---

## 3. Edge Functions

```bash
npx supabase functions deploy moderate-answer
npx supabase functions deploy send-daily-question
npx supabase secrets set CRON_SECRET=<長いランダム文字列> MODERATION_AI_PROVIDER=none
```

- `moderate-answer`: 回答の自動審査。アプリが投稿直後に呼ぶほか、定期実行で審査待ちをまとめて処理する。
- `send-daily-question`: 毎朝 7:00 のお題通知。
- AI による審査は、使うサービスが決まったら `supabase/functions/_shared/aiJudge.ts` に分岐を足し、`MODERATION_AI_PROVIDER` と API キーを secrets に入れる（未決定事項 §14）。

---

## 4. 定期実行（Cron）

ダッシュボードの **Database → Extensions** で `pg_cron` と `pg_net` を有効にし、**Vault** に次の2つを保存してから、SQL Editor で実行します。

- `cron_secret`: 上で設定した `CRON_SECRET` と同じ値
- `anon_key`: プロジェクトの anon key（`moderate-answer` は JWT の検証が有効なため）

```sql
-- 毎朝 7:00 JST（= 22:00 UTC）にお題の通知
select cron.schedule('daily-question-push', '0 22 * * *', $$
  select net.http_post(
    url := 'https://<プロジェクトの ref>.supabase.co/functions/v1/send-daily-question',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{}'::jsonb)
$$);

-- 5分ごとに審査待ちの回答を処理
select cron.schedule('moderation-sweep', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://<プロジェクトの ref>.supabase.co/functions/v1/moderate-answer',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{"sweep": true}'::jsonb)
$$);
```

---

## 5. 運営の作業（MVP は Supabase Studio で行う）

| やること | 方法 |
|---|---|
| 通報の確認 | `select * from public.admin_report_queue;` |
| 非表示を解除 | `update public.answers set status = 'approved' where id = '…';` |
| 通報を確認済みにする | `update public.reports set reviewed_at = now() where answer_id = '…';` |
| 利用停止（BAN） | `update public.profiles set is_banned = true where id = '…';` |
| 相談窓口の更新 | `src/features/moderation/supportResources.ts` を編集してアプリを更新 |
| NG ワードの更新 | `supabase/functions/_shared/ngwords.ts` を編集して `moderate-answer` を再デプロイ |

---

## 6. AdMob

1. AdMob でアプリ（iOS / Android）と広告ユニット（インタースティシャル・バナー）を作る。
2. **ブロックするカテゴリ**（§9）: ゲーム、出会い系、ギャンブル、刺激の強い動画広告。
3. **プライバシーとメッセージ** で GDPR / 米国州法の同意メッセージを作る（UMP）。
4. 次の値を EAS の環境変数に入れる（下の 7 を参照）。開発ビルドでは常にテスト ID が使われます。

---

## 7. EAS（ビルドと配信）

```bash
npx eas-cli@latest login
npx eas-cli@latest init          # 表示された projectId を EAS_PROJECT_ID に入れる
```

EAS の環境変数（development / preview / production それぞれ）:

| 変数 | 内容 |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | 本番（または検証用）Supabase |
| `EXPO_PUBLIC_SUPPORT_EMAIL` | お問い合わせ先 |
| `EAS_PROJECT_ID` | `eas init` の projectId（プッシュ通知に必要） |
| `ADMOB_APP_ID_IOS` / `ADMOB_APP_ID_ANDROID` | AdMob のアプリ ID |
| `EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS` / `_ANDROID` | 全画面広告のユニット ID |
| `EXPO_PUBLIC_ADMOB_BANNER_IOS` / `_ANDROID` | バナーのユニット ID |
| `EXPO_PUBLIC_ADS_ENABLED` | `false` で広告を出さない |

```bash
npx eas-cli@latest build --profile development --platform ios   # 実機確認用（広告などネイティブ機能を含む）
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --platform ios      # TestFlight へ
npx eas-cli@latest submit --platform android  # Google Play の内部テストへ
```

広告ライブラリを含むため、Expo Go では動きません。実機確認は開発ビルドで行ってください。

---

## 8. リリース前チェックリスト

- [ ] アプリ名を確定し、`app.json` の `name`・バンドル ID（`app.tomoshibi`）・URL スキームを更新（§14）
- [ ] `src/content/legal.ts` の【運営者名】を埋め、専門家の確認後に `LEGAL_DOCS_ARE_DRAFT = false`
- [ ] `npm run legal:export` で `docs/legal/` を更新し、Web で公開（ストアにプライバシーポリシーの URL を登録）
- [ ] `src/features/moderation/supportResources.ts` の番号・受付時間を各窓口の公式サイトで確認し、最終確認日を記入
- [ ] 本番 Supabase で `allow_clock_override = false` を確認
- [ ] 30日分以上のお題と、初期回答（seed）を入稿
- [ ] Cron（お題の通知・審査の定期実行）が動いていることを確認
- [ ] App Store Connect の「App のプライバシー」と Google Play の「データセーフティ」を、プライバシーポリシーの内容に合わせて回答
- [ ] 利用できる年齢の下限を決め、年齢区分を申請（§14）
- [ ] ストア用スクリーンショット（`docs/store-screenshots/`）を確認・差し替え
- [ ] TestFlight / 内部テストで、通知（タイマー終了・朝のお題）、広告の同意 → ATT の順番、アカウント連携、アカウント削除を実機で確認
