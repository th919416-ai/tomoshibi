-- ステップ7: アーカイブ・削除・設定・灯りのお知らせ・アカウント削除
begin;
select plan(16);

update public.app_settings set allow_clock_override = true;
create function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.at(ts text) returns void language plpgsql as $$
begin perform set_config('app.now_override', ts, true); end $$;

delete from public.questions where day_key between '2026-10-30' and '2026-11-21';
insert into public.questions (day_key, genre, body) values
  ('2026-10-31', 'imagine', '10月の問い'), ('2026-11-18', 'values', '18日の問い'), ('2026-11-19', 'memory', '19日の問い');
insert into auth.users (id, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated');

-- ユーザー1 の過去の回答（10/31 と 11/18）
insert into public.daily_progress (user_id, day_key, timer_minutes, timer_started_at, timer_ends_at, answered_at)
values ('11111111-1111-1111-1111-111111111111', '2026-10-31', 60, '2026-10-31 08:00+09', '2026-10-31 09:00+09', '2026-10-31 09:10+09'),
       ('11111111-1111-1111-1111-111111111111', '2026-11-18', 10, '2026-11-18 08:00+09', '2026-11-18 08:10+09', '2026-11-18 08:20+09');
insert into public.answers (user_id, question_id, day_key, body, status)
select '11111111-1111-1111-1111-111111111111', q.id, q.day_key, q.body || 'への、わたしの答えを書きました。', 'approved'
from public.questions q where q.day_key in ('2026-10-31', '2026-11-18');

select pg_temp.at('2026-11-19 08:00:00+09');
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(public.get_my_archive('2026-11') -> 'months', '["2026-11", "2026-10"]', '回答のある月だけが並ぶ');
select is(jsonb_array_length(public.get_my_archive('2026-11') -> 'entries'), 1, '月ごとに区切って返す');
select is(public.get_my_archive('2026-10') -> 'entries' -> 0 ->> 'timer_minutes', '60', '考えた時間も残る');
select is((select array_agg(k order by k) from jsonb_object_keys(public.get_my_archive('2026-10') -> 'entries' -> 0) k),
  array['answer_id', 'body', 'day_key', 'genre', 'question', 'status', 'timer_minutes'],
  'アーカイブには他者の反応を含まない');
select throws_ok($$select public.get_my_archive('2026-13')$$, 'P0001', 'invalid_month', '不正な月は拒否');

-- 灯りのお知らせ: 昨日（18日）の手紙に共感があれば、1度だけ
select is((public.get_today_state() ->> 'show_glow_notice')::boolean, false, '共感が無ければお知らせしない');
reset role;
insert into public.feed_assignments (user_id, day_key, slot, answer_id, kind)
select '22222222-2222-2222-2222-222222222222', '2026-11-18', 1, id, 'random'
from public.answers where day_key = '2026-11-18';
insert into public.reactions (user_id, answer_id, type)
select '22222222-2222-2222-2222-222222222222', id, 'hokkori' from public.answers where day_key = '2026-11-18';
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is((public.get_today_state() ->> 'show_glow_notice')::boolean, true, '共感があれば翌日お知らせする');
select public.ack_glow_notice();
select is((public.get_today_state() ->> 'show_glow_notice')::boolean, false, 'お知らせは1度だけ');

-- 設定
select is(public.update_my_settings(p_notify_question => true) ->> 'notify_question', 'true', 'お題通知をオンにできる');
select is(public.get_my_profile() ->> 'notify_timer', 'true', 'タイマー通知は初期値オン');
select is(public.complete_onboarding() ->> 'onboarded', 'true', 'オンボーディング完了を記録');
select throws_ok($$select public.register_push_token('abc', 'ios')$$, 'P0001', 'invalid_push_token', '不正なトークンは拒否');
select lives_ok($$select public.register_push_token('ExponentPushToken[xxxx]', 'ios')$$, 'トークンを登録できる');

-- 削除: 自分の回答は消せる。他人の回答は消せない
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select throws_ok($$select public.delete_my_answer((select id from public.answers limit 1))$$, 'P0001', 'answer_not_found',
  '他人の回答は削除できない');
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select public.delete_my_answer((public.get_my_archive('2026-10') -> 'entries' -> 0 ->> 'answer_id')::uuid);
select is(public.get_my_archive('2026-11') -> 'months', '["2026-11"]', '削除した回答はアーカイブから消える');

-- アカウント削除
select public.delete_my_account();
reset role;
select is((select count(*)::int from public.answers where user_id = '11111111-1111-1111-1111-111111111111')
        + (select count(*)::int from public.profiles where id = '11111111-1111-1111-1111-111111111111')
        + (select count(*)::int from public.push_tokens where user_id = '11111111-1111-1111-1111-111111111111')
        + (select count(*)::int from auth.users where id = '11111111-1111-1111-1111-111111111111'), 0,
  'アカウント削除で、回答・プロフィール・通知トークンもすべて消える');

select * from finish();
rollback;
