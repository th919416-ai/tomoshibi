# CLAUDE.md — 「ともしび」（仮称）開発ガイド

このファイルは Claude Code がこのリポジトリで作業するときの仕様書兼ルール集です。
実装前に必ず全体を読み、ここに書かれていない仕様を推測で決めた場合は、その内容を
`docs/decisions.md` に1行で追記してください。

> 【仮決定】と書かれた項目は、オーナーがまだ最終決定していない推奨案です。
> 実装はこの案で進め、変更しやすい作り（定数・設定値として外出し）にしてください。

---

## 1. プロダクト概要

- **一言で:** 1日1回届く「問い」に、スマホから離れて考えてから答え、同じ問いに向き合った他者の回答を10通だけ静かに読むアプリ。
- **目的:** 無限スクロールや承認欲求から離れた「思考の余白」を習慣にすること。
- **収益:** App Store / Google Play で無料配布。広告（控えめ）＋ 将来の有料プラン（広告非表示・アーカイブ書き出しなど）。
- **初期ターゲット:** SNS疲れを感じている日本の20〜30代（将来は全世代）。
- **初期リリース地域:** 日本のみ。UI 言語は日本語のみ（ただし文字列は i18n 化しておく）。

### 1.1 絶対に守る設計原則（アンチパターン禁止）

以下を実装・提案してはいけない。迷ったらこのリストに照らして判断すること。

1. 無限スクロール（どの画面でも、件数上限のないリストを作らない）
2. いいね・共感の**数値**の表示（API レスポンスにも数値を含めない）
3. ランキング、順位、人気順ソートの表示
4. フォロー／フォロワー、プロフィールページ
5. リプライ・コメント・DM
6. 投稿のワンクリック SNS 拡散ボタン（※お題だけを画像で共有する機能は可。§7.6）
7. 通知の乱発（通知は §8 に定義した2種類のみ）
8. タイマー中・お題表示中・回答入力中・カード閲覧中の広告表示

---

## 2. 技術スタック

| 領域            | 採用技術                                                              |
| --------------- | --------------------------------------------------------------------- |
| アプリ          | Expo（最新 SDK）+ React Native + TypeScript（strict）                 |
| ルーティング    | expo-router                                                           |
| 状態管理 / 通信 | TanStack Query + Zustand（UI ローカル状態のみ）                       |
| バックエンド    | Supabase（Postgres / Auth / Edge Functions / Cron）                   |
| 認証            | Supabase 匿名認証 → 任意で Apple / Google アカウントに引き継ぎ        |
| 通知            | expo-notifications（タイマー終了＝ローカル通知、お題配信＝Expo Push） |
| アニメーション  | react-native-reanimated + Lottie（キャンドル・焚き火）                |
| 広告            | react-native-google-mobile-ads（AdMob）※Expo Go 不可、Dev Build 必須  |
| ATT / 同意      | expo-tracking-transparency、AdMob UMP（同意管理）                     |
| ビルド・配信    | EAS Build / EAS Submit                                                |
| テスト          | Jest + React Native Testing Library、DB は pgTAP または SQL テスト    |
| Lint / 整形     | ESLint + Prettier                                                     |

### 2.1 ディレクトリ構成

```
app/                    # expo-router の画面
  (onboarding)/
  (main)/
    index.tsx           # ホーム（状態に応じて表示を切り替え）
    timer.tsx
    write.tsx
    letters.tsx         # 共感の広場
    done.tsx            # 今日の思考の時間は終わりです
    archive/
  settings/
src/
  features/             # 機能ごと（question, timer, answer, feed, reaction, archive, moderation, ads）
  lib/                  # supabase クライアント、clock、notifications
  ui/                   # デザインシステム（トークン・共通コンポーネント）
  i18n/
supabase/
  migrations/
  functions/            # Edge Functions
  seed.sql
docs/
  decisions.md
```

---

## 3. 「1日」と時刻のルール（最重要）

- **時刻の正はサーバー。** 端末時計は表示用にのみ使う。判定はすべて DB / Edge Function で行う。
- **タイムゾーン:** 【仮決定】MVP は日本時間（Asia/Tokyo）固定。
- **day_key の定義:** `day_key = (現在時刻 JST − 7時間) の日付`。
  つまり 7:00:00 〜 翌 6:59:59 が同じ day_key。
- テストのため、現在時刻は `src/lib/clock.ts` と DB 関数 `app_now()` から取得し、差し替え可能にする。

### 3.1 締め切りとタイマー

- 選べるタイマー: 10分 / 60分 / 360分（定数 `TIMER_OPTIONS`）。
- タイマーを開始できるのは `開始時刻 + 選択時間 ≦ その日の締め切り（翌 6:59:59）` の選択肢のみ。
- 【仮決定】**回答の猶予:** タイマー終了後 30 分間は、締め切りを過ぎていても前日分として投稿できる（`ANSWER_GRACE_MINUTES = 30`）。
- 締め切り10分前（6:49:59）を過ぎたら新規のタイマー開始は不可。「今日の問いは締め切りました。また明日の朝7時に」と表示する。
- タイマー終了後、猶予を過ぎても未投稿なら、その日は「未回答」で終了。

---

## 4. ユーザーの1日の状態遷移

各ユーザー・各 day_key ごとに、次のどれか1つの状態を持つ。ホーム画面は状態を見て表示を切り替える。

```
NOT_STARTED ──(タイマー選択)──▶ TIMER_RUNNING ──(終了時刻到達)──▶ WRITABLE
                                                                    │
                                                         (投稿)     │   (猶予切れ)
                                                                    ▼        ▼
                                                                ANSWERED   MISSED
                                                                    │
                                                         (10通すべて既読)
                                                                    ▼
                                                                COMPLETED

NOT_STARTED ──(締め切り)──▶ CLOSED
```

- 状態は保存せず、`daily_progress` の各タイムスタンプから導出する（関数 `get_today_state()`）。
- アプリを終了・再起動しても状態が正しく復元されること。
- タイマー中にアプリを開いた場合: キャンドルのアニメーションと「まだ火が育っています。スマホを置いて、問いと過ごしてください」とだけ表示する。残り時間は大きく出さない（小さく表示）。
- 【仮決定】タイマーのキャンセル・選び直しは不可（約束を守る体験を重視）。ただし設定で変更しやすい作りにする。

---

## 5. データモデル（Supabase / Postgres）

```sql
-- ユーザー設定（個人情報は持たない）
profiles (
  id uuid pk references auth.users,
  created_at timestamptz,
  notify_question boolean default false,
  notify_timer boolean default true,
  is_banned boolean default false,
  onboarded_at timestamptz
)

-- お題（運営が事前に入稿）
questions (
  id uuid pk,
  day_key date unique not null,
  genre text check (genre in ('discovery','memory','values','imagine','senses')),
  body text not null,
  sponsor_name text null          -- 将来の協賛お題用
)

-- 1日の進行
daily_progress (
  user_id uuid, day_key date,
  timer_minutes int check (timer_minutes in (10,60,360)),
  timer_started_at timestamptz,
  timer_ends_at timestamptz,
  answered_at timestamptz,
  feed_completed_at timestamptz,
  primary key (user_id, day_key)
)

-- 回答
answers (
  id uuid pk,
  user_id uuid, question_id uuid, day_key date,
  body text check (char_length(body) between 20 and 400),
  status text check (status in ('pending','approved','rejected','crisis','hidden')) default 'pending',
  is_seed boolean default false,   -- 運営が用意した初期回答
  exposure_count int default 0,    -- 配信された回数（サーバー内部のみ）
  created_at timestamptz,
  deleted_at timestamptz,
  unique (user_id, day_key)
)

-- その日に配られた手紙（最大10通、追加のみで入れ替えない）
feed_assignments (
  user_id uuid, day_key date, slot smallint check (slot between 1 and 10),
  answer_id uuid,
  kind text check (kind in ('random','glowing','seed')),
  seen_at timestamptz,
  primary key (user_id, day_key, slot)
)

-- 共感（1回答に対し種類ごとに1回、取り消し可）
reactions (
  user_id uuid, answer_id uuid,
  type text check (type in ('wakaru','hokkori','hatto')),
  created_at timestamptz,
  primary key (user_id, answer_id, type)
)

reports (id, reporter_id, answer_id, reason, created_at, unique(reporter_id, answer_id))
blocks  (blocker_id, blocked_user_id, created_at, primary key(blocker_id, blocked_user_id))
```

### 5.1 アクセス制御（RLS）— 必ずサーバー側で強制

- `answers`: 本人の行のみ SELECT 可能。**他者の回答は直接 SELECT できない。**
- 他者の回答は RPC `get_today_letters()`（security definer）経由でのみ取得する。この関数は
  1. 本人がその day_key に投稿済みか確認する（未投稿ならエラー）
  2. `feed_assignments` に割り当てられた回答だけを返す
  3. 返す項目は `answer_id, body, light_level(0〜4), my_reactions` のみ。**user_id や共感数は返さない。**
- `reactions`: 自分に割り当てられた回答にのみ INSERT / DELETE 可能。他人の reaction は SELECT 不可。
- `questions`: 当日以前のものだけ SELECT 可能（未来のお題は見えない）。

---

## 6. 回答の投稿とモデレーション

1. クライアントで文字数を検証（20〜400字、前後の空白は除く）。
2. INSERT 時は `status = 'pending'`。Edge Function `moderate-answer` が非同期で判定する。
   - NG ワード辞書（`supabase/functions/_shared/ngwords.ts`）
   - 個人情報の検出: 電話番号、メールアドレス、URL、SNS ID（@xxx）、LINE ID などの正規表現 → `rejected`
   - AI による判定（攻撃性・性的内容・自傷他害）。API キーは環境変数で管理し、関数として差し替え可能にする
   - 自傷・希死念慮の兆候 → `crisis`（他者には配信しない）
3. `approved` になった回答だけが配信対象になる。
4. 本人には常に自分の回答が表示される（審査中でも）。`rejected` の場合は理由を穏やかに伝え、書き直しを許可する。
5. `crisis` の場合は、本人に相談窓口（よりそいホットライン、いのちの電話、こころの耳 など）を静かに案内する画面を表示する。責めない文面にすること。窓口の一覧は `src/features/moderation/supportResources.ts` に定数で持ち、運営が更新できるようにする。
6. 通報: 異なる3人から通報されたら自動で `hidden` にし、運営の確認待ちにする。
7. ブロック: 回答カードの「…」メニューから「この人の手紙を今後受け取らない」を選べる。以後、その人の回答はその人に配信されない。
8. 投稿の編集はできない。【仮決定】削除はアーカイブから可能（配信済みの手紙からも消える）。

---

## 7. 手紙の配信（共感の広場）

### 7.1 配信ロジック（Edge Function / RPC `assign_letters()`）

- 投稿後、初めて広場を開いたときに実行する。
- 目標は 10 通。内訳は【仮決定】
  - **ランダム枠 7通:** `exposure_count` が少ない回答を優先して抽選する（まだ誰にも読まれていない手紙を届けるため）
  - **灯り枠 3通:** 共感を集めている回答から抽選する。ただし同じ回答の配信回数に上限を設け（`GLOW_EXPOSURE_CAP`）、人気が一部に集中しないようにする
- 除外: 自分の回答、ブロックした人・された人の回答、`approved` 以外、削除済み
- 割り当ては**追加のみ**。開き直しても入れ替わらない（無限スクロールの防止）。

### 7.2 手紙が足りない場合（コールドスタート対策）

- 当日の回答が足りない場合は、`is_seed = true` の運営回答で補う（kind = 'seed'）。
- それでも 10 通に満たない場合は届いた分だけ表示し、「残りの手紙は、まだ誰かが考えているところです。また後で来てみてください」と表示する。後で開いたときに追加で割り当てる（上限は10通まで）。

### 7.3 灯り（光）の表現

- サーバーで共感数を 0〜4 の段階（`light_level`）に変換し、クライアントには段階だけを返す。閾値は定数 `LIGHT_THRESHOLDS`。
- 段階が上がるほど、カード背景の光が大きく暖かい色になる。数字や「多い／少ない」といった言葉は一切表示しない。

### 7.4 共感ボタン

- 「わかる」「ほっこり」「ハッとした」の3種類。1通につき各種類1回まで押せて、取り消しもできる。
- 押したときは小さな光の粒のアニメーションを出すだけで、数は出さない。

### 7.5 読了

- カードは1枚ずつ横にめくる形式（縦の連続スクロールにしない）。
- 2秒以上表示されたカードを `seen_at` 記録の対象にする。
- 割り当てられた全通（最大10通）が既読になったら `feed_completed_at` を記録し、「今日の思考の時間は終わりです」画面に遷移する。

### 7.6 自分の回答への反応（承認欲求を煽らない還元）

- 【仮決定】翌日のホーム画面に1度だけ「昨日のあなたの手紙に、灯りがともりました」と表示する（共感が1つ以上あった場合のみ、数は出さない）。
- アーカイブには他者の反応を残さない。

### 7.7 シェア

- 共有できるのは「今日のお題」の画像カードだけ（アプリ名とストアへのリンクつき）。自分の回答は含めない。

---

## 8. 通知（この2種類のみ）

| 種類         | 方式                                 | 初期値                               | 内容                                               |
| ------------ | ------------------------------------ | ------------------------------------ | -------------------------------------------------- |
| お題配信     | Expo Push（Cron で毎朝 7:00 JST）    | オフ（オンボーディングで任意に許可） | 「今日の問いが届きました」                         |
| タイマー終了 | ローカル通知（タイマー開始時に予約） | オン                                 | 「考える時間が終わりました。言葉にしてみませんか」 |

- 通知の文面にお題そのものは含めない（ロック画面で考え始めずに、アプリを開いてから向き合ってもらうため）。
- 設定画面で種類ごとにオン・オフできる。

---

## 9. 広告（フェーズ 7 で実装。それまでは枠だけ用意）

- 表示してよい場所:
  1. 「今日の思考の時間は終わりです」画面で「閉じる」を押した後の全画面広告（1日1回まで）
  2. アーカイブ画面下部のバナー
- それ以外の画面には絶対に出さない（§1.1-8）。
- AdMob の管理画面でブロックするカテゴリ（運用メモ）: ゲーム、出会い系、ギャンブル、刺激の強い動画広告。
- 起動時の初回に、同意管理（UMP）→ iOS の ATT の順に表示する。拒否されても非パーソナライズ広告で動作すること。
- 広告の表示可否は `ads.enabled` のフラグで制御し、将来の「広告非表示プラン」で切れるようにする。
- 広告 ID は環境変数で管理し、開発中は必ずテスト ID を使う。

---

## 10. 画面一覧（MVP）

| #   | 画面                    | 主な内容                                                                                                                 |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 0   | オンボーディング（3枚） | コンセプト説明、「すぐには書けない理由」、お題通知の許可（任意）                                                         |
| 1   | ホーム                  | 状態（§4）に応じて表示を切り替え。お題表示とタイマー選択。締め切り後の表示                                               |
| 2   | タイマー待機            | キャンドルのアニメーション、控えめな残り時間表示                                                                         |
| 3   | 回答入力                | お題、テキスト入力（20〜400字、残り文字数）、投稿ボタン                                                                  |
| 4   | 共感の広場              | 1枚ずつめくるカード、共感ボタン3種、灯りの表現、「…」メニュー（通報・ブロック）                                          |
| 5   | 終了画面                | 「今日の思考の時間は終わりです」、閉じるボタン                                                                           |
| 6   | アーカイブ              | 自分の過去の回答をカレンダーまたは月ごとのリストで表示（月単位でページ切り替え。無限スクロールにしない）、削除           |
| 7   | 設定                    | 通知、アカウント連携、アカウント削除、利用規約、プライバシーポリシー、外部送信に関する公表事項、お問い合わせ、ライセンス |
| 8   | 相談窓口案内            | crisis 判定時に表示                                                                                                      |
| 9   | 運営用（MVP）           | Supabase Studio と SQL ビューで代用（お題入稿、通報確認、BAN）。Web の管理画面はフェーズ 8 以降                          |

---

## 11. デザインシステム

- **モチーフ:** 夜の焚き火、ともしび、手紙。
- **色トークン**（`src/ui/tokens.ts`）:
  - `bg.night` #0E1420（深いネイビー）／ `bg.charcoal` #1C1F26
  - `accent.candle` #F2A65A ／ `accent.ember` #E07B39
  - `text.paper` #F3EDE2（生成り）／ `text.muted` #A8A29A
- **フォント:** 本文は明朝系（Noto Serif JP）、UI は Noto Sans JP。本文は大きめ、行間は広め。
- **動き:** ゆっくり、控えめに。OS の「視差効果を減らす」設定がオンなら、アニメーションを静止画にする。
- **アクセシビリティ:** 文字と背景のコントラスト比 4.5:1 以上、OS の文字サイズ変更に追従、スクリーンリーダー用のラベルをすべてのボタンに付ける。
- ダークテーマのみ（ライトテーマは作らない）。

---

## 12. 開発ステップ（この順に、1ステップずつ完了させる）

各ステップの終わりに、テストが通ること・動作確認の手順を報告し、オーナーの確認を待つこと。

1. **土台:** Expo プロジェクト、TypeScript strict、ESLint/Prettier、expo-router、デザイントークン、i18n、Supabase 接続、匿名ログイン。
2. **お題と1日のサイクル:** `questions` テーブル、`app_now()` / day_key、お題の表示、`seed.sql` にお題30件。
   - 完了条件: 時刻を差し替えるテストで 6:59 / 7:00 の境界が正しく動く。
3. **タイマー:** `daily_progress`、締め切りによる選択肢の制御、サーバー時刻での残り時間、ローカル通知、再起動後の復元。
4. **回答の投稿:** 入力画面、文字数検証、`answers`、RLS、猶予30分のルール。
5. **モデレーション:** `moderate-answer` 関数、個人情報の検出、crisis 時の案内画面、通報・ブロック。
6. **手紙の配信と共感:** `assign_letters()`、`get_today_letters()`、seed 回答による補充、カード UI、共感、灯りの段階、読了、終了画面。
   - 完了条件: 未投稿のユーザーが API を直接叩いても他者の回答を取得できないことをテストで証明する。
7. **アーカイブ・設定・オンボーディング・アカウント削除・広告・ATT/同意。**
8. **リリース準備:** アイコン、スプラッシュ、ストア用スクリーンショット、プライバシーポリシーと利用規約のページ、EAS Build、TestFlight／内部テスト。

---

## 13. 実装時のルール

- 仕様に迷ったら、§1.1（禁止事項）→ 本ファイル → `docs/decisions.md` の順で確認し、それでも決まらなければ実装を止めて質問する。
- マジックナンバー禁止。時間・文字数・通数・閾値は `src/config/constants.ts`（DB 側は設定テーブル）に集約する。
- 時刻に関わるロジックには必ず境界値テストを書く（6:59:59 / 7:00:00、締め切りと猶予、日付またぎ）。
- 他者の回答・共感数・user_id がクライアントに漏れていないか、新しい API を追加するたびに確認する。
- 秘密情報（API キー、AdMob ID）はコードに書かず、`.env` と EAS Secrets で管理する。`.env` はコミットしない。
- 分析ログは最小限にする（継続率、タイマー完了率、投稿率、読了率）。回答の本文は分析ツールに送らない。

---

## 14. 未決定事項（オーナーの判断待ち）

- [ ] アプリ名（「ともしび」は仮称。商標・ストアでの重複を確認すること）
- [ ] 海外展開時のタイムゾーンの扱い（各国の現地時間で7時にするか）
- [ ] タイマーのキャンセルを許可するか
- [ ] 有料プランの内容と価格
- [ ] 協賛お題を受け付けるか
- [ ] 利用できる年齢の下限
- [ ] AI モデレーションに使うサービスと費用の上限
