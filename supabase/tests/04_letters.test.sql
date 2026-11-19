-- ステップ6: 手紙の配信と共感（§5.1, §7）
-- 完了条件: 未投稿のユーザーが API を直接叩いても他者の回答を取得できないこと
begin;
select plan(33);

update public.app_settings set allow_clock_override = true;
select set_config('app.now_override', '2026-11-19 12:00:00+09', true);

create function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.u(n int) returns uuid language sql as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
-- n 番のユーザーが 19日に投稿済み（承認済み）の状態を作る
create function pg_temp.posted(n int, st text default 'approved') returns uuid language plpgsql as $$
declare aid uuid;
begin
  insert into public.daily_progress (user_id, day_key, timer_minutes, timer_started_at, timer_ends_at, answered_at)
  values (pg_temp.u(n), '2026-11-19', 10, '2026-11-19 08:00+09', '2026-11-19 08:10+09', '2026-11-19 08:20+09');
  insert into public.answers (user_id, question_id, day_key, body, status)
  values (pg_temp.u(n), (select id from public.questions where day_key = '2026-11-19'), '2026-11-19',
          n || '番の人の手紙です。今日の問いについて考えました。', st)
  returning id into aid;
  return aid;
end $$;

delete from public.questions where day_key between '2026-11-18' and '2026-11-21';
insert into public.questions (day_key, genre, body) values ('2026-11-19', 'memory', '19日の問い');
insert into auth.users (id, aud, role) select pg_temp.u(n), 'authenticated', 'authenticated' from generate_series(1, 30) n;

-- 他の人が 3 人だけ投稿している（足りない分は seed で補う）
select pg_temp.posted(n) from generate_series(11, 13) n;
insert into public.answers (user_id, question_id, day_key, body, status, is_seed)
select null, (select id from public.questions where day_key = '2026-11-19'), '2026-11-19',
       '運営が用意した手紙 ' || n || '。静かな一日でありますように。', 'approved', true
from generate_series(1, 4) n;

-- ===== 未投稿のユーザー 1 =====
select pg_temp.as_user(pg_temp.u(1));
select throws_ok('select public.get_today_letters()', '42501', 'answer_required', '未投稿では手紙を取得できない');
select is((select count(*)::int from public.answers), 0, '未投稿では answers を直接 SELECT しても0件');
select throws_ok('select * from public.feed_assignments', '42501', null, '配信表は直接読めない');
select throws_ok('select * from public.reactions', '42501', null, '他人の共感は直接読めない');
select throws_ok('select * from public.reports', '42501', null, '通報は直接読めない');
select throws_ok('select * from public.blocks', '42501', null, 'ブロックは直接読めない');
select throws_ok($$select public.letter_candidates('00000000-0000-0000-0000-000000000001', '2026-11-19')$$,
  '42501', null, '内部の候補関数は呼べない');
select throws_ok($$select public.assign_letters('00000000-0000-0000-0000-000000000001', '2026-11-19')$$,
  '42501', null, '割り当て関数を直接呼んで手紙を得ることはできない');
select throws_ok($$select public.light_level('00000000-0000-0000-0000-000000000001')$$,
  '42501', null, '共感数につながる関数は呼べない');
select throws_ok($$select * from public.admin_report_queue$$, '42501', null, '運営用ビューは見えない');
select throws_ok($$select public.set_reaction((select id from public.answers limit 1), 'wakaru', true)$$,
  '42501', null, '割り当てられていない回答には共感できない');
reset role;
select set_config('role', 'anon', true);
select throws_ok('select public.get_today_letters()', '42501', null, '未ログインでも取得できない');
reset role;

-- ===== ユーザー 1 が投稿する（審査中でも読める） =====
select pg_temp.posted(1, 'pending');
select pg_temp.as_user(pg_temp.u(1));
select is(jsonb_array_length(public.get_today_letters() -> 'letters'), 7, '他の人 3 通 + 運営 4 通 = 7 通');
select is((public.get_today_letters() ->> 'is_full')::boolean, false, '10 通に満たないことが分かる');
select is((select count(*)::int from jsonb_array_elements(public.get_today_letters() -> 'letters') l
           where l ->> 'body' like '1番の人%'), 0, '自分の手紙は届かない');
select is((select array_agg(distinct k order by k) from jsonb_array_elements(public.get_today_letters() -> 'letters') l,
           jsonb_object_keys(l) k),
          array['answer_id', 'body', 'light_level', 'my_reactions', 'seen', 'slot'],
          'user_id や共感数を含まない（返す項目は決まったものだけ）');
select is((public.get_today_letters() -> 'letters' -> 0 ->> 'slot')::int, 1, '1枚目から順に並ぶ');

-- 後から投稿が増えたら、空いている枠だけ追加で割り当てる（入れ替えない）
reset role;
create temp table first_ids as
  select f.answer_id from public.feed_assignments f where f.user_id = pg_temp.u(1);
grant select on first_ids to authenticated;
select pg_temp.posted(n) from generate_series(14, 25) n;
select pg_temp.as_user(pg_temp.u(1));
select is(jsonb_array_length(public.get_today_letters() -> 'letters'), 10, 'あとで開くと 10 通まで補充される');
select is((public.get_today_letters() ->> 'is_full')::boolean, true, '10 通そろった');
select is((select count(*)::int from jsonb_array_elements(public.get_today_letters() -> 'letters') l
           where (l ->> 'answer_id')::uuid in (select answer_id from first_ids)), 7,
          '最初の 7 通はそのまま残る（入れ替わらない）');
select is(jsonb_array_length(public.get_today_letters() -> 'letters'), 10, '何度開いても 10 通を超えない');

-- ===== 共感と灯り =====
create temp table target as
  select (public.get_today_letters() -> 'letters' -> 0 ->> 'answer_id')::uuid as id;
select is((public.set_reaction((select id from target), 'wakaru', true) ->> 'light_level')::int, 1,
  '共感すると灯りの段階が上がる');
select is(public.set_reaction((select id from target), 'hokkori', true) -> 'my_reactions', '["hokkori", "wakaru"]',
  '種類ごとに押せる');
select is((public.set_reaction((select id from target), 'wakaru', true) -> 'my_reactions'), '["hokkori", "wakaru"]',
  '同じ種類は1回まで');
select is((public.set_reaction((select id from target), 'wakaru', false) -> 'my_reactions'), '["hokkori"]',
  '取り消せる');
select throws_ok($$select public.set_reaction((select id from target), 'like', true)$$, 'P0001', 'invalid_reaction',
  '3種類以外は押せない');

-- ===== 読了 =====
select is((select bool_or((public.mark_letter_seen((l ->> 'answer_id')::uuid) ->> 'completed')::boolean)
           from jsonb_array_elements(public.get_today_letters() -> 'letters') l), true,
          '10 通すべて既読で完了');
select is(public.get_today_state() ->> 'state', 'COMPLETED', '状態は COMPLETED');

-- ===== 通報（3人で非表示）とブロック =====
reset role;
create temp table reported as select (select id from target) as id;
grant select on reported, target to authenticated;
-- ユーザー 26〜28 が投稿して、同じ手紙が届いている状態にする
select pg_temp.posted(n) from generate_series(26, 28) n;
insert into public.feed_assignments (user_id, day_key, slot, answer_id, kind)
select pg_temp.u(n), '2026-11-19', 1, (select id from reported), 'random' from generate_series(26, 28) n;
select pg_temp.as_user(pg_temp.u(26)); select public.report_letter((select id from reported), 'offensive');
select pg_temp.as_user(pg_temp.u(26)); select public.report_letter((select id from reported), 'offensive');
select pg_temp.as_user(pg_temp.u(27)); select public.report_letter((select id from reported), 'spam');
reset role;
select is((select status from public.answers where id = (select id from reported)), 'approved',
  '同じ人の重複通報は数えない（2人ではまだ表示）');
select pg_temp.as_user(pg_temp.u(28)); select public.report_letter((select id from reported), 'other');
reset role;
select is((select status from public.answers where id = (select id from reported)), 'hidden',
  '異なる3人から通報されたら非表示');
select pg_temp.as_user(pg_temp.u(1));
select is((select count(*)::int from jsonb_array_elements(public.get_today_letters() -> 'letters') l
           where (l ->> 'answer_id')::uuid = (select id from reported)), 0, '非表示の手紙は届いた後でも消える');

-- ブロック: ユーザー 29 が 11 番の人をブロック → 11 番の手紙は届かない
reset role;
select pg_temp.posted(29);
create temp table a11 as select id from public.answers where user_id = pg_temp.u(11);
grant select on a11 to authenticated;
insert into public.feed_assignments (user_id, day_key, slot, answer_id, kind)
values (pg_temp.u(29), '2026-11-19', 1, (select id from a11), 'random');
select pg_temp.as_user(pg_temp.u(29));
select public.block_letter_author((select id from a11));
reset role;
delete from public.feed_assignments where user_id = pg_temp.u(29);
select pg_temp.as_user(pg_temp.u(29));
select is((select count(*)::int from jsonb_array_elements(public.get_today_letters() -> 'letters') l
           where (l ->> 'answer_id')::uuid = (select id from a11)), 0, 'ブロックした人の手紙は届かない');

-- 却下された人は手紙を読めない
reset role;
select pg_temp.posted(30, 'rejected');
select pg_temp.as_user(pg_temp.u(30));
select throws_ok('select public.get_today_letters()', '42501', 'answer_required', '却下された回答では手紙を読めない');

select * from finish();
rollback;
