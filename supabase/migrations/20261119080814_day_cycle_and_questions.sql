-- ステップ2: 1日のサイクルとお題（CLAUDE.md §3, §5）
-- 時刻の正はサーバー。day_key の判定はすべてここで定義する関数で行う。

-- ---------------------------------------------------------------------------
-- 設定テーブル（§13: DB 側の定数はここに集約する）。常に1行だけ。
-- ---------------------------------------------------------------------------
create table public.app_settings (
  id boolean primary key default true check (id),
  -- 【仮決定】MVP は日本時間固定（§3）
  time_zone text not null default 'Asia/Tokyo',
  day_start_hour smallint not null default 7 check (day_start_hour between 0 and 23),
  -- テスト用の時刻差し替え（app.now_override）を受け付けるか。本番では必ず false。
  allow_clock_override boolean not null default false
);

insert into public.app_settings (id) values (true);

alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 現在時刻（§3: テストのため差し替え可能にする）
--   テストでは `set local app.now_override = '2026-11-20 06:59:59+09';` で固定できる。
--   app_settings.allow_clock_override が false の環境では差し替えを無視する。
-- ---------------------------------------------------------------------------
create function public.app_now()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when s.allow_clock_override
      and nullif(current_setting('app.now_override', true), '') is not null
    then current_setting('app.now_override', true)::timestamptz
    else now()
  end
  from public.app_settings s
$$;

-- day_key = (現在時刻 JST − 7時間) の日付。7:00:00〜翌6:59:59 が同じ day_key。
create function public.app_day_key(ts timestamptz default null)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select ((coalesce(ts, public.app_now()) at time zone s.time_zone)
          - make_interval(hours => s.day_start_hour))::date
  from public.app_settings s
$$;

-- その day_key が始まる時刻（例: 2026-11-19 → 2026-11-19 07:00:00 JST）
create function public.app_day_starts_at(day date)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select (day + make_interval(hours => s.day_start_hour)) at time zone s.time_zone
  from public.app_settings s
$$;

-- その day_key が終わる時刻（排他的。翌日 7:00:00 JST）。締め切り 6:59:59 はこの直前の1秒。
create function public.app_day_ends_at(day date)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select public.app_day_starts_at(day + 1)
$$;

revoke execute on function public.app_now() from public, anon;
revoke execute on function public.app_day_key(timestamptz) from public, anon;
revoke execute on function public.app_day_starts_at(date) from public, anon;
revoke execute on function public.app_day_ends_at(date) from public, anon;
grant execute on function public.app_now() to authenticated;
grant execute on function public.app_day_key(timestamptz) to authenticated;
grant execute on function public.app_day_starts_at(date) to authenticated;
grant execute on function public.app_day_ends_at(date) to authenticated;

-- ---------------------------------------------------------------------------
-- お題（運営が事前に入稿する）
-- ---------------------------------------------------------------------------
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  day_key date unique not null,
  genre text not null check (genre in ('discovery', 'memory', 'values', 'imagine', 'senses')),
  body text not null check (char_length(btrim(body)) > 0),
  sponsor_name text null, -- 将来の協賛お題用
  created_at timestamptz not null default now()
);

alter table public.questions enable row level security;

-- 当日以前のお題だけ見える（未来のお題は見えない。§5.1）
create policy "questions_select_until_today"
  on public.questions
  for select
  to authenticated
  using (day_key <= public.app_day_key());

-- 入稿は運営（Supabase Studio / service_role）だけ
revoke all on public.questions from anon, authenticated;
grant select on public.questions to authenticated;

-- ---------------------------------------------------------------------------
-- 今日のお題と、その日の時間枠を返す。
-- お題が未入稿でも1行返す（question_id 以降が null）。クライアントは server_now で端末時計のずれを補正する。
-- ---------------------------------------------------------------------------
create function public.get_today_question()
returns table (
  day_key date,
  starts_at timestamptz,
  ends_at timestamptz,
  server_now timestamptz,
  question_id uuid,
  genre text,
  body text,
  sponsor_name text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with today as (select public.app_day_key() as d)
  select
    t.d,
    public.app_day_starts_at(t.d),
    public.app_day_ends_at(t.d),
    public.app_now(),
    q.id,
    q.genre,
    q.body,
    q.sponsor_name
  from today t
  left join public.questions q on q.day_key = t.d
$$;

revoke execute on function public.get_today_question() from public, anon;
grant execute on function public.get_today_question() to authenticated;
