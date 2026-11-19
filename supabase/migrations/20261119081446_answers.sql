-- ステップ4: 回答の投稿（CLAUDE.md §5, §5.1, §6-1, §3.1 の猶予）

alter table public.app_settings
  add column answer_min_length int not null default 20,
  add column answer_max_length int not null default 400;

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade, -- seed 回答は null
  question_id uuid not null references public.questions (id) on delete cascade,
  day_key date not null,
  body text not null check (char_length(body) between 20 and 400),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'crisis', 'hidden')),
  rejection_reason text check (rejection_reason in ('personal_info', 'inappropriate', 'other')),
  is_seed boolean not null default false,  -- 運営が用意した初期回答
  exposure_count int not null default 0,   -- 配信された回数（サーバー内部のみ）
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, day_key),
  check (is_seed = (user_id is null))
);

create index answers_feed_idx on public.answers (day_key, status) where deleted_at is null;

alter table public.answers enable row level security;
revoke all on public.answers from anon, authenticated;
-- 本人の行のみ。配信回数（exposure_count）など内部の列は見せない（§5.1, §1.1-2）
grant select (id, question_id, day_key, body, status, rejection_reason, created_at, deleted_at)
  on public.answers to authenticated;

create policy "answers_select_own"
  on public.answers for select to authenticated
  using (user_id = auth.uid());
-- 書き込みは RPC からのみ。他者の回答は get_today_letters() 経由でのみ（ステップ6）

-- 前後の空白（全角スペース・改行を含む）を除く。クライアントの String.prototype.trim と同じ扱い
create function public.normalize_answer_body(body text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(coalesce(body, ''), '^[\s　﻿]+|[\s　﻿]+$', '', 'g')
$$;

-- ---------------------------------------------------------------------------
-- 今日の状態に、回答の情報を加える
-- ---------------------------------------------------------------------------
create function public.today_state_extras(uid uuid, day date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'answer', (
      select jsonb_build_object(
        'id', a.id, 'body', a.body, 'status', a.status, 'rejection_reason', a.rejection_reason)
      from public.answers a
      where a.user_id = uid and a.day_key = day and a.deleted_at is null
    )
  )
$$;

create or replace function public.get_today_state()
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
    'timer_cancel_allowed', s.allow_timer_cancel,
    'answer_min_length', s.answer_min_length,
    'answer_max_length', s.answer_max_length
  ) || public.today_state_extras(uid, day);
end;
$$;

-- ---------------------------------------------------------------------------
-- 回答を投稿する。
--   - WRITABLE のときだけ（締め切り後でもタイマー終了から猶予時間内なら前日分として）
--   - 審査で rejected になった回答は、受付時間内なら書き直せる（§6-4）
--   - 投稿の編集はできない（§6-8）
-- ---------------------------------------------------------------------------
create function public.submit_answer(p_body text)
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
  q_id uuid;
  v_body text := public.normalize_answer_body(p_body);
  len int := char_length(public.normalize_answer_body(p_body));
  existing public.answers;
  answer_id uuid;
begin
  select * into s from public.app_settings;
  perform pg_advisory_xact_lock(hashtextextended(uid::text || day::text, 0));
  select * into p from public.daily_progress d where d.user_id = uid and d.day_key = day;
  select * into existing from public.answers a where a.user_id = uid and a.day_key = day;

  if p.timer_ends_at is null or at < p.timer_ends_at then
    raise exception 'not_writable_yet' using errcode = 'P0001';
  end if;
  if at >= public.writable_until(day, p.timer_ends_at) then
    raise exception 'answer_deadline_passed' using errcode = 'P0001';
  end if;
  if existing.id is not null and (existing.status <> 'rejected' or existing.deleted_at is not null) then
    raise exception 'already_answered' using errcode = 'P0001';
  end if;
  if len < s.answer_min_length then
    raise exception 'answer_too_short' using errcode = 'P0001';
  end if;
  if len > s.answer_max_length then
    raise exception 'answer_too_long' using errcode = 'P0001';
  end if;

  select q.id into q_id from public.questions q where q.day_key = day;

  if existing.id is null then
    insert into public.answers (user_id, question_id, day_key, body)
    values (uid, q_id, day, v_body)
    returning id into answer_id;
  else
    update public.answers a
       set body = v_body, status = 'pending', rejection_reason = null,
           moderated_at = null, created_at = at
     where a.id = existing.id
    returning a.id into answer_id;
  end if;

  update public.daily_progress d set answered_at = coalesce(d.answered_at, at)
   where d.user_id = uid and d.day_key = day;

  return public.get_today_state();
end;
$$;

revoke execute on function public.today_state_extras(uuid, date) from public, anon, authenticated;
revoke execute on function public.submit_answer(text) from public, anon;
grant execute on function public.submit_answer(text) to authenticated;
