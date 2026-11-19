-- ステップ7: アーカイブ・設定・オンボーディング・通知の登録・アカウント削除（CLAUDE.md §7.6, §8, §10）

alter table public.profiles
  -- 「昨日のあなたの手紙に、灯りがともりました」を表示済みの day_key（1度だけ表示する。§7.6）
  add column glow_notice_day date;

-- ---------------------------------------------------------------------------
-- Expo Push のトークン（お題配信の通知用。§8）
-- ---------------------------------------------------------------------------
create table public.push_tokens (
  token text primary key,
  -- profiles 経由で auth.users に連鎖する（通知の送信時に profiles と結合するため）
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 今日の状態に「昨日の手紙に灯りがともった」を加える（数は出さない）
-- ---------------------------------------------------------------------------
create or replace function public.today_state_extras(uid uuid, day date)
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
    ),
    'show_glow_notice', exists (
      select 1
      from public.answers a
      join public.profiles p on p.id = uid
      where a.user_id = uid and a.day_key = day - 1
        and a.deleted_at is null and a.status = 'approved'
        and (p.glow_notice_day is null or p.glow_notice_day < day - 1)
        and exists (select 1 from public.reactions r where r.answer_id = a.id)
    )
  )
$$;

create function public.ack_glow_notice()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
begin
  update public.profiles p set glow_notice_day = public.active_day_key(uid) - 1 where p.id = uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- アーカイブ（月単位。無限スクロールにしない。§10-6）
-- 自分の回答とお題だけ。他者の反応は残さない（§7.6）
-- ---------------------------------------------------------------------------
create function public.get_my_archive(p_month text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  month_start date;
begin
  if p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'invalid_month' using errcode = 'P0001';
  end if;
  month_start := to_date(p_month || '-01', 'YYYY-MM-DD');

  return jsonb_build_object(
    'month', p_month,
    'months', coalesce((
      select jsonb_agg(m order by m desc)
      from (select distinct to_char(a.day_key, 'YYYY-MM') m
            from public.answers a where a.user_id = uid and a.deleted_at is null) months), '[]'),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
               'answer_id', a.id,
               'day_key', a.day_key,
               'genre', q.genre,
               'question', q.body,
               'body', a.body,
               'status', a.status,
               'timer_minutes', d.timer_minutes) order by a.day_key desc)
      from public.answers a
      join public.questions q on q.id = a.question_id
      left join public.daily_progress d on d.user_id = a.user_id and d.day_key = a.day_key
      where a.user_id = uid and a.deleted_at is null
        and a.day_key >= month_start and a.day_key < (month_start + interval '1 month')::date), '[]')
  );
end;
$$;

-- 自分の回答を削除する（配信済みの手紙からも消える。【仮決定】§6-8）
create function public.delete_my_answer(p_answer_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
begin
  update public.answers a set deleted_at = public.app_now()
   where a.id = p_answer_id and a.user_id = uid and a.deleted_at is null;
  if not found then
    raise exception 'answer_not_found' using errcode = 'P0001';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 設定・オンボーディング
-- ---------------------------------------------------------------------------
create function public.get_my_profile()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'notify_question', p.notify_question,
    'notify_timer', p.notify_timer,
    'onboarded', p.onboarded_at is not null)
  from public.profiles p
  where p.id = public.require_user()
$$;

create function public.update_my_settings(p_notify_question boolean default null,
                                          p_notify_timer boolean default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
begin
  update public.profiles p
     set notify_question = coalesce(p_notify_question, p.notify_question),
         notify_timer = coalesce(p_notify_timer, p.notify_timer)
   where p.id = uid;
  return public.get_my_profile();
end;
$$;

create function public.complete_onboarding()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
begin
  update public.profiles p set onboarded_at = coalesce(p.onboarded_at, now()) where p.id = uid;
  return public.get_my_profile();
end;
$$;

create function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
begin
  if p_token !~ '^ExponentPushToken\[.+\]$' then
    raise exception 'invalid_push_token' using errcode = 'P0001';
  end if;
  insert into public.push_tokens (token, user_id, platform) values (p_token, uid, p_platform)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform,
                                    updated_at = now();
end;
$$;

-- アカウント削除: 認証ユーザーを消すと、回答・共感・通報・進行などはすべて連鎖して消える
create function public.delete_my_account()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  delete from auth.users u where u.id = uid;
end;
$$;

revoke execute on function public.ack_glow_notice() from public, anon;
revoke execute on function public.get_my_archive(text) from public, anon;
revoke execute on function public.delete_my_answer(uuid) from public, anon;
revoke execute on function public.get_my_profile() from public, anon;
revoke execute on function public.update_my_settings(boolean, boolean) from public, anon;
revoke execute on function public.complete_onboarding() from public, anon;
revoke execute on function public.register_push_token(text, text) from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.ack_glow_notice() to authenticated;
grant execute on function public.get_my_archive(text) to authenticated;
grant execute on function public.delete_my_answer(uuid) to authenticated;
grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.update_my_settings(boolean, boolean) to authenticated;
grant execute on function public.complete_onboarding() to authenticated;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
