-- ステップ6: 手紙の配信と共感（CLAUDE.md §5.1, §7）
-- 他者の回答は get_today_letters() からのみ取得できる。user_id・共感数・配信回数は返さない。

alter table public.app_settings
  add column letters_per_day int not null default 10,
  -- 【仮決定】内訳
  add column letters_random_slots int not null default 7,
  add column letters_glowing_slots int not null default 3,
  -- 共感数 → 灯りの段階（0〜4）の閾値。共感数がこの値以上なら段階が1つ上がる
  add column light_thresholds int[] not null default '{1,3,6,10}',
  -- 灯り枠で同じ回答を配る回数の上限（人気が一部に集中しないように）
  add column glow_exposure_cap int not null default 30;

create table public.feed_assignments (
  user_id uuid not null references auth.users (id) on delete cascade,
  day_key date not null,
  slot smallint not null check (slot between 1 and 10),
  answer_id uuid not null references public.answers (id) on delete cascade,
  kind text not null check (kind in ('random', 'glowing', 'seed')),
  assigned_at timestamptz not null default now(),
  seen_at timestamptz,
  primary key (user_id, day_key, slot),
  unique (user_id, day_key, answer_id)
);

create table public.reactions (
  user_id uuid not null references auth.users (id) on delete cascade,
  answer_id uuid not null references public.answers (id) on delete cascade,
  type text not null check (type in ('wakaru', 'hokkori', 'hatto')),
  created_at timestamptz not null default now(),
  primary key (user_id, answer_id, type)
);

create index reactions_answer_idx on public.reactions (answer_id);

-- どちらもクライアントから直接は読めない（他人の共感・配信先を漏らさない）
alter table public.feed_assignments enable row level security;
alter table public.reactions enable row level security;
revoke all on public.feed_assignments from anon, authenticated;
revoke all on public.reactions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 内部関数
-- ---------------------------------------------------------------------------

-- 共感数を灯りの段階（0〜4）に変換する。数そのものは外に出さない（§7.3）
create function public.light_level(p_answer_id uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from unnest((select light_thresholds from public.app_settings)) t
  where t <= (select count(*) from public.reactions r where r.answer_id = p_answer_id)
$$;

-- 手紙を読める状態か（投稿済みで、却下・削除されていない）
create function public.has_posted(uid uuid, day date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.answers a
    where a.user_id = uid and a.day_key = day
      and a.deleted_at is null and a.status <> 'rejected'
  )
$$;

-- 配信してよい他者の回答
create function public.letter_candidates(uid uuid, day date)
returns setof public.answers
language sql
stable
security definer
set search_path = ''
as $$
  select a.*
  from public.answers a
  where a.day_key = day
    and a.status = 'approved'
    and a.deleted_at is null
    and not a.is_seed
    and a.user_id <> uid
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = uid and b.blocked_user_id = a.user_id)
         or (b.blocker_id = a.user_id and b.blocked_user_id = uid))
    and not exists (
      select 1 from public.feed_assignments f
      where f.user_id = uid and f.day_key = day and f.answer_id = a.id)
$$;

-- 手紙を割り当てる（追加のみ。入れ替えない。§7.1, §7.2）
create function public.assign_letters(uid uuid, day date)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s public.app_settings;
  have_total int;
  have_glow int;
  have_random int;
  want int;
  next_slot int;
  first_new_slot int;
  added int;
begin
  select * into s from public.app_settings;
  perform pg_advisory_xact_lock(hashtextextended('letters:' || uid::text || day::text, 0));

  select count(*), count(*) filter (where kind = 'glowing'), count(*) filter (where kind = 'random'),
         coalesce(max(slot), 0) + 1
    into have_total, have_glow, have_random, next_slot
    from public.feed_assignments f where f.user_id = uid and f.day_key = day;
  if have_total >= s.letters_per_day then
    return;
  end if;
  first_new_slot := next_slot;

  -- 灯り枠: 共感を集めた回答から抽選（配信回数に上限）
  want := least(greatest(s.letters_glowing_slots - have_glow, 0), s.letters_per_day - have_total);
  with picked as (
    select c.id from public.letter_candidates(uid, day) c
    where public.light_level(c.id) > 0 and c.exposure_count < s.glow_exposure_cap
    order by random() limit want
  ), ins as (
    insert into public.feed_assignments (user_id, day_key, slot, answer_id, kind)
    select uid, day, next_slot + row_number() over () - 1, p.id, 'glowing' from picked p
    returning answer_id
  )
  select count(*) into added from ins;
  have_total := have_total + added; next_slot := next_slot + added;

  -- ランダム枠: まだ読まれていない手紙を優先（灯り枠が埋まらなかった分もここで埋める）
  want := least(s.letters_per_day - have_total,
                greatest(s.letters_random_slots - have_random, 0)
                + greatest(s.letters_glowing_slots - have_glow - added, 0));
  with picked as (
    select c.id from public.letter_candidates(uid, day) c
    order by c.exposure_count, random() limit want
  ), ins as (
    insert into public.feed_assignments (user_id, day_key, slot, answer_id, kind)
    select uid, day, next_slot + row_number() over () - 1, p.id, 'random' from picked p
    returning answer_id
  )
  select count(*) into added from ins;
  have_total := have_total + added; next_slot := next_slot + added;

  -- 足りない分は運営が用意した手紙で補う（コールドスタート対策）
  want := s.letters_per_day - have_total;
  if want > 0 then
    with picked as (
      select a.id from public.answers a
      where a.day_key = day and a.is_seed and a.status = 'approved' and a.deleted_at is null
        and not exists (select 1 from public.feed_assignments f
                        where f.user_id = uid and f.day_key = day and f.answer_id = a.id)
      order by a.exposure_count, random() limit want
    )
    insert into public.feed_assignments (user_id, day_key, slot, answer_id, kind)
    select uid, day, next_slot + row_number() over () - 1, p.id, 'seed' from picked p;
  end if;

  -- 配信回数（内部のみ）
  update public.answers a set exposure_count = a.exposure_count + 1
   where a.id in (select f.answer_id from public.feed_assignments f
                  where f.user_id = uid and f.day_key = day and f.slot >= first_new_slot);
end;
$$;

-- 割り当てられた手紙のうち、いま表示してよいもの（削除・非表示になったものは消える）
create function public.visible_assignments(uid uuid, day date)
returns table (slot smallint, answer_id uuid, body text, seen_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select f.slot, a.id, a.body, f.seen_at
  from public.feed_assignments f
  join public.answers a on a.id = f.answer_id
  where f.user_id = uid and f.day_key = day
    and a.deleted_at is null and a.status = 'approved'
  order by f.slot
$$;

create function public.is_assigned(uid uuid, p_answer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.feed_assignments f
                 where f.user_id = uid and f.answer_id = p_answer_id)
$$;

-- ---------------------------------------------------------------------------
-- クライアント向け RPC
-- ---------------------------------------------------------------------------

-- 今日の手紙。未投稿ならエラー（§5.1-1）。返すのは answer_id, body, light_level, my_reactions と、
-- 自分の既読状態だけ。user_id・共感数は返さない（§5.1-3）。
create function public.get_today_letters()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  day date := public.active_day_key(uid);
  s public.app_settings;
  letters jsonb;
begin
  select * into s from public.app_settings;
  if not public.has_posted(uid, day) then
    raise exception 'answer_required' using errcode = '42501';
  end if;

  perform public.assign_letters(uid, day);

  select coalesce(jsonb_agg(jsonb_build_object(
           'slot', v.slot,
           'answer_id', v.answer_id,
           'body', v.body,
           'light_level', public.light_level(v.answer_id),
           'my_reactions', coalesce((select jsonb_agg(r.type order by r.type) from public.reactions r
                                     where r.user_id = uid and r.answer_id = v.answer_id), '[]'),
           'seen', v.seen_at is not null) order by v.slot), '[]')
    into letters
    from public.visible_assignments(uid, day) v;

  return jsonb_build_object(
    'day_key', day,
    'letters', letters,
    'is_full', (select count(*) from public.feed_assignments f
                where f.user_id = uid and f.day_key = day) >= s.letters_per_day,
    'completed', exists (select 1 from public.daily_progress d
                         where d.user_id = uid and d.day_key = day and d.feed_completed_at is not null)
  );
end;
$$;

-- 共感（1通につき各種類1回、取り消し可。§7.4）。返すのは段階と自分の共感だけ
create function public.set_reaction(p_answer_id uuid, p_type text, p_on boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
begin
  if p_type not in ('wakaru', 'hokkori', 'hatto') then
    raise exception 'invalid_reaction' using errcode = 'P0001';
  end if;
  if not public.is_assigned(uid, p_answer_id) then
    raise exception 'not_assigned' using errcode = '42501';
  end if;
  if p_on then
    insert into public.reactions (user_id, answer_id, type) values (uid, p_answer_id, p_type)
    on conflict do nothing;
  else
    delete from public.reactions r
     where r.user_id = uid and r.answer_id = p_answer_id and r.type = p_type;
  end if;
  return jsonb_build_object(
    'answer_id', p_answer_id,
    'light_level', public.light_level(p_answer_id),
    'my_reactions', coalesce((select jsonb_agg(r.type order by r.type) from public.reactions r
                              where r.user_id = uid and r.answer_id = p_answer_id), '[]'));
end;
$$;

-- 既読（2秒以上表示されたカード。判定はクライアント。§7.5）
-- 割り当て10通がすべて既読になったら feed_completed_at を記録する
create function public.mark_letter_seen(p_answer_id uuid)
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
  s public.app_settings;
  done boolean;
begin
  select * into s from public.app_settings;
  update public.feed_assignments f set seen_at = coalesce(f.seen_at, at)
   where f.user_id = uid and f.day_key = day and f.answer_id = p_answer_id;
  if not found then
    raise exception 'not_assigned' using errcode = '42501';
  end if;

  done := (select count(*) from public.feed_assignments f
           where f.user_id = uid and f.day_key = day) >= s.letters_per_day
      and not exists (select 1 from public.visible_assignments(uid, day) v where v.seen_at is null);
  if done then
    update public.daily_progress d set feed_completed_at = coalesce(d.feed_completed_at, at)
     where d.user_id = uid and d.day_key = day;
  end if;
  return jsonb_build_object('completed', done);
end;
$$;

-- 通報（§6-6）
create function public.report_letter(p_answer_id uuid, p_reason text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
begin
  if not public.is_assigned(uid, p_answer_id) then
    raise exception 'not_assigned' using errcode = '42501';
  end if;
  insert into public.reports (reporter_id, answer_id, reason)
  values (uid, p_answer_id, p_reason)
  on conflict (reporter_id, answer_id) do nothing;
end;
$$;

-- ブロック: 「この人の手紙を今後受け取らない」（§6-7）。相手の user_id はクライアントに渡さない
create function public.block_letter_author(p_answer_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_user();
  author uuid;
begin
  if not public.is_assigned(uid, p_answer_id) then
    raise exception 'not_assigned' using errcode = '42501';
  end if;
  select a.user_id into author from public.answers a where a.id = p_answer_id;
  if author is null then
    return; -- 運営の手紙はブロック対象外
  end if;
  insert into public.blocks (blocker_id, blocked_user_id) values (uid, author)
  on conflict do nothing;
end;
$$;

-- 権限
revoke execute on function public.light_level(uuid) from public, anon, authenticated;
revoke execute on function public.has_posted(uuid, date) from public, anon, authenticated;
revoke execute on function public.letter_candidates(uuid, date) from public, anon, authenticated;
revoke execute on function public.assign_letters(uuid, date) from public, anon, authenticated;
revoke execute on function public.visible_assignments(uuid, date) from public, anon, authenticated;
revoke execute on function public.is_assigned(uuid, uuid) from public, anon, authenticated;

revoke execute on function public.get_today_letters() from public, anon;
revoke execute on function public.set_reaction(uuid, text, boolean) from public, anon;
revoke execute on function public.mark_letter_seen(uuid) from public, anon;
revoke execute on function public.report_letter(uuid, text) from public, anon;
revoke execute on function public.block_letter_author(uuid) from public, anon;
grant execute on function public.get_today_letters() to authenticated;
grant execute on function public.set_reaction(uuid, text, boolean) to authenticated;
grant execute on function public.mark_letter_seen(uuid) to authenticated;
grant execute on function public.report_letter(uuid, text) to authenticated;
grant execute on function public.block_letter_author(uuid) to authenticated;
