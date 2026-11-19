-- 自分の手紙に届いた共感の数を、翌日以降に「自分の記録」で見られるようにする（2026-11-19 オーナー決定）
-- - 見られるのは自分の手紙の分だけ。他の人の手紙（get_today_letters）には今までどおり数を出さない
-- - 書いた当日（いま向き合っている日）の分は出さない
-- - 無料で全員が対象

alter table public.app_settings
  -- 自分の手紙の共感の数を記録画面に出すか
  add column show_own_reaction_counts boolean not null default true,
  -- 何日たってから出すか（1 = 翌日から）
  add column own_reaction_counts_delay_days int not null default 1 check (own_reaction_counts_delay_days >= 0);

-- 自分の手紙の種類ごとの共感数。出してよい条件を満たさなければ null
create function public.own_reaction_counts(uid uuid, p_answer_id uuid, p_day date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not s.show_own_reaction_counts then null
    when p_day > public.active_day_key(uid) - s.own_reaction_counts_delay_days then null
    else jsonb_build_object(
      'wakaru', (select count(*) from public.reactions r where r.answer_id = p_answer_id and r.type = 'wakaru'),
      'hokkori', (select count(*) from public.reactions r where r.answer_id = p_answer_id and r.type = 'hokkori'),
      'hatto', (select count(*) from public.reactions r where r.answer_id = p_answer_id and r.type = 'hatto'))
  end
  from public.app_settings s
  where exists (select 1 from public.answers a where a.id = p_answer_id and a.user_id = uid)
$$;

revoke execute on function public.own_reaction_counts(uuid, uuid, date) from public, anon, authenticated;

create or replace function public.get_my_archive(p_month text)
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
               'timer_minutes', d.timer_minutes,
               'reactions', public.own_reaction_counts(uid, a.id, a.day_key)) order by a.day_key desc)
      from public.answers a
      join public.questions q on q.id = a.question_id
      left join public.daily_progress d on d.user_id = a.user_id and d.day_key = a.day_key
      where a.user_id = uid and a.deleted_at is null
        and a.day_key >= month_start and a.day_key < (month_start + interval '1 month')::date), '[]')
  );
end;
$$;
