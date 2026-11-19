-- ステップ3: タイマーと1日の状態（CLAUDE.md §3.1, §4, §5）

-- ---------------------------------------------------------------------------
-- 設定値（§13: DB 側の定数はここに集約）
-- ---------------------------------------------------------------------------
alter table public.app_settings
  add column timer_options int[] not null default '{10,60,360}',
  -- 締め切りの何分前から新規タイマー開始を不可にするか
  add column timer_start_cutoff_minutes int not null default 10,
  -- 【仮決定】タイマー終了後、締め切りを過ぎても投稿できる猶予
  add column answer_grace_minutes int not null default 30,
  -- 【仮決定】タイマーのキャンセル・選び直し
  add column allow_timer_cancel boolean not null default false;

-- ---------------------------------------------------------------------------
-- プロフィール（個人情報は持たない）
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  notify_question boolean not null default false,
  notify_timer boolean not null default true,
  is_banned boolean not null default false,
  onboarded_at timestamptz
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select (id, created_at, notify_question, notify_timer, onboarded_at)
  on public.profiles to authenticated;

create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using (id = auth.uid());

-- 新しいユーザー（匿名を含む）ができたらプロフィールを作る
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 既存ユーザーの分も作る
insert into public.profiles (id) select id from auth.users on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 1日の進行（状態は保存せず、タイムスタンプから導出する。§4）
-- ---------------------------------------------------------------------------
create table public.daily_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  day_key date not null,
  timer_minutes int check (timer_minutes in (10, 60, 360)),
  timer_started_at timestamptz,
  timer_ends_at timestamptz,
  answered_at timestamptz,
  feed_completed_at timestamptz,
  primary key (user_id, day_key)
);

alter table public.daily_progress enable row level security;
revoke all on public.daily_progress from anon, authenticated;
grant select on public.daily_progress to authenticated;

create policy "daily_progress_select_own"
  on public.daily_progress for select to authenticated
  using (user_id = auth.uid());
-- 書き込みは RPC（security definer）からのみ

-- ---------------------------------------------------------------------------
-- 共通: 呼び出しユーザーの確認
-- ---------------------------------------------------------------------------
create function public.require_user()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.profiles p where p.id = uid and p.is_banned) then
    raise exception 'banned' using errcode = 'P0001';
  end if;
  return uid;
end;
$$;

-- 新規タイマーを開始できる最後の時刻（含む）。これを過ぎたら CLOSED。
--   締め切り（翌 6:59:59）− cutoff 分 = 6:49:59
create function public.timer_start_closes_at(day date)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select public.app_day_ends_at(day) - interval '1 second'
         - make_interval(mins => s.timer_start_cutoff_minutes)
  from public.app_settings s
$$;

-- 回答を受け付ける最後の時刻（排他的）: その日の終わり と タイマー終了＋猶予 の遅いほう
create function public.writable_until(day date, timer_ends_at timestamptz)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    public.app_day_ends_at(day),
    timer_ends_at + make_interval(mins => s.answer_grace_minutes)
  )
  from public.app_settings s
$$;

-- 進行状況から状態を導出する（§4 の状態遷移）
create function public.derive_day_state(p public.daily_progress, day date, at timestamptz)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p.timer_started_at is null then
    if at > public.timer_start_closes_at(day) then
      return 'CLOSED';
    end if;
    return 'NOT_STARTED';
  end if;
  if at < p.timer_ends_at then
    return 'TIMER_RUNNING';
  end if;
  if p.answered_at is null then
    if at < public.writable_until(day, p.timer_ends_at) then
      return 'WRITABLE';
    end if;
    return 'MISSED';
  end if;
  if p.feed_completed_at is null then
    return 'ANSWERED';
  end if;
  return 'COMPLETED';
end;
$$;

-- いま向き合っている日。
-- 7:00 を過ぎても、前日のタイマー終了から猶予時間内で、前日の手紙を読み終えていなければ前日を続ける。
create function public.active_day_key(uid uuid)
returns date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  at timestamptz := public.app_now();
  today date := public.app_day_key(at);
  prev public.daily_progress;
  grace int;
begin
  select answer_grace_minutes into grace from public.app_settings;
  select * into prev from public.daily_progress d where d.user_id = uid and d.day_key = today - 1;
  if found
     and prev.timer_ends_at is not null
     and prev.feed_completed_at is null
     and at < prev.timer_ends_at + make_interval(mins => grace) then
    return today - 1;
  end if;
  return today;
end;
$$;

-- ---------------------------------------------------------------------------
-- 今日の状態（ホーム画面はこれだけを見て表示を切り替える）
-- 後続のステップで項目を追加する（create or replace）。
-- ---------------------------------------------------------------------------
create function public.get_today_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  at timestamptz := public.app_now();
  day date := public.active_day_key(uid);
  p public.daily_progress;
  q public.questions;
  s public.app_settings;
  state text;
  options int[];
begin
  select * into s from public.app_settings;
  select * into p from public.daily_progress d where d.user_id = uid and d.day_key = day;
  select * into q from public.questions qq where qq.day_key = day;
  state := public.derive_day_state(p, day, at);

  -- 締め切りに間に合う選択肢だけ（お題が無い日は選べない）
  select coalesce(array_agg(m order by m), '{}') into options
  from unnest(s.timer_options) m
  where state = 'NOT_STARTED'
    and q.id is not null
    and at + make_interval(mins => m) <= public.app_day_ends_at(day) - interval '1 second';

  return jsonb_build_object(
    'day_key', day,
    'starts_at', public.app_day_starts_at(day),
    'ends_at', public.app_day_ends_at(day),
    'server_now', at,
    'state', state,
    'question', case when q.id is null then null else jsonb_build_object(
      'id', q.id, 'genre', q.genre, 'body', q.body, 'sponsor_name', q.sponsor_name) end,
    'timer', case when p.timer_started_at is null then null else jsonb_build_object(
      'minutes', p.timer_minutes,
      'started_at', p.timer_started_at,
      'ends_at', p.timer_ends_at) end,
    'writable_until', case when p.timer_ends_at is null then null
                           else public.writable_until(day, p.timer_ends_at) end,
    'available_timer_options', to_jsonb(options),
    'timer_cancel_allowed', s.allow_timer_cancel
  );
end;
$$;

-- タイマーを開始する。開始できない場合は理由のコードで例外を返す。
create function public.start_timer(p_minutes int)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  at timestamptz := public.app_now();
  day date := public.active_day_key(uid);
  p public.daily_progress;
  s public.app_settings;
begin
  select * into s from public.app_settings;

  if day <> public.app_day_key(at) then
    raise exception 'previous_day_in_progress' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.questions q where q.day_key = day) then
    raise exception 'question_not_ready' using errcode = 'P0001';
  end if;
  if not (p_minutes = any (s.timer_options)) then
    raise exception 'invalid_timer_option' using errcode = 'P0001';
  end if;

  -- 同時に2回押されても1回だけ有効にする
  perform pg_advisory_xact_lock(hashtextextended(uid::text || day::text, 0));
  select * into p from public.daily_progress d where d.user_id = uid and d.day_key = day;
  if public.derive_day_state(p, day, at) = 'CLOSED' then
    raise exception 'day_closed' using errcode = 'P0001';
  end if;
  if p.timer_started_at is not null then
    raise exception 'timer_already_started' using errcode = 'P0001';
  end if;
  if at + make_interval(mins => p_minutes) > public.app_day_ends_at(day) - interval '1 second' then
    raise exception 'timer_exceeds_deadline' using errcode = 'P0001';
  end if;

  insert into public.daily_progress as d (user_id, day_key, timer_minutes, timer_started_at, timer_ends_at)
  values (uid, day, p_minutes, at, at + make_interval(mins => p_minutes))
  on conflict (user_id, day_key) do update
    set timer_minutes = excluded.timer_minutes,
        timer_started_at = excluded.timer_started_at,
        timer_ends_at = excluded.timer_ends_at
    where d.timer_started_at is null;

  return public.get_today_state();
end;
$$;

-- タイマーの取り消し（【仮決定】既定では無効。app_settings.allow_timer_cancel で切り替え）
create function public.cancel_timer()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  at timestamptz := public.app_now();
  day date := public.active_day_key(uid);
begin
  if not (select allow_timer_cancel from public.app_settings) then
    raise exception 'timer_cancel_not_allowed' using errcode = 'P0001';
  end if;
  update public.daily_progress d
     set timer_minutes = null, timer_started_at = null, timer_ends_at = null
   where d.user_id = uid and d.day_key = day and d.timer_ends_at > at and d.answered_at is null;
  if not found then
    raise exception 'timer_not_running' using errcode = 'P0001';
  end if;
  return public.get_today_state();
end;
$$;

-- 内部用の関数はクライアントから呼べないようにする
revoke execute on function public.require_user() from public, anon, authenticated;
revoke execute on function public.timer_start_closes_at(date) from public, anon, authenticated;
revoke execute on function public.writable_until(date, timestamptz) from public, anon, authenticated;
revoke execute on function public.derive_day_state(public.daily_progress, date, timestamptz) from public, anon, authenticated;
revoke execute on function public.active_day_key(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

revoke execute on function public.get_today_state() from public, anon;
revoke execute on function public.start_timer(int) from public, anon;
revoke execute on function public.cancel_timer() from public, anon;
grant execute on function public.get_today_state() to authenticated;
grant execute on function public.start_timer(int) to authenticated;
grant execute on function public.cancel_timer() to authenticated;
