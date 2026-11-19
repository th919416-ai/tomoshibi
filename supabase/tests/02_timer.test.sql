-- ステップ3: タイマー・締め切り・状態の導出（§3.1, §4）
begin;
select plan(24);

update public.app_settings set allow_clock_override = true;

create function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.at(ts text) returns void language plpgsql as $$
begin perform set_config('app.now_override', ts, true); end $$;
create function pg_temp.state() returns text language sql as $$
  select public.get_today_state() ->> 'state' $$;
create function pg_temp.options() returns text language sql as $$
  select (public.get_today_state() -> 'available_timer_options')::text $$;

insert into auth.users (id, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated');
delete from public.questions where day_key between '2026-11-18' and '2026-11-21';
insert into public.questions (day_key, genre, body) values
  ('2026-11-19', 'memory', '19日の問い'), ('2026-11-20', 'senses', '20日の問い');

select is((select count(*)::int from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 1,
  'ユーザーができるとプロフィールが作られる');

-- ユーザー1: 朝 8:00 に 60 分のタイマー
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select pg_temp.at('2026-11-19 08:00:00+09');
select is(pg_temp.state(), 'NOT_STARTED', '開始前は NOT_STARTED');
select is(pg_temp.options(), '[10, 60, 360]', '朝はすべての選択肢を選べる');
select throws_ok('select public.start_timer(30)', 'P0001', 'invalid_timer_option', '10/60/360 以外は選べない');
select is(public.start_timer(60) ->> 'state', 'TIMER_RUNNING', 'タイマーを開始できる');
select throws_ok('select public.start_timer(10)', 'P0001', 'timer_already_started', '開始済みのタイマーは選び直せない');
select throws_ok('select public.cancel_timer()', 'P0001', 'timer_cancel_not_allowed', '【仮決定】キャンセルは既定で不可');

select pg_temp.at('2026-11-19 08:59:59+09');
select is(pg_temp.state(), 'TIMER_RUNNING', '終了1秒前はまだ TIMER_RUNNING');
select pg_temp.at('2026-11-19 09:00:00+09');
select is(pg_temp.state(), 'WRITABLE', '終了時刻ちょうどで WRITABLE');
select pg_temp.at('2026-11-20 06:59:59+09');
select is(pg_temp.state(), 'WRITABLE', '締め切り 6:59:59 まで書ける');
select pg_temp.at('2026-11-20 07:00:00+09');
select is(public.get_today_state() ->> 'day_key', '2026-11-20', '猶予（9:30まで）を過ぎた前日は引きずらず、7:00 から新しい日');
select is(pg_temp.state(), 'NOT_STARTED', '新しい日は NOT_STARTED');

-- 締め切り直前の選択肢
reset role;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.at('2026-11-20 00:59:59+09');
select is(pg_temp.options(), '[10, 60, 360]', '0:59:59 なら 6時間が間に合う（6:59:59 ちょうど）');
select pg_temp.at('2026-11-20 01:00:00+09');
select is(pg_temp.options(), '[10, 60]', '1:00:00 からは 6時間は選べない');
select pg_temp.at('2026-11-20 05:59:59+09');
select is(pg_temp.options(), '[10, 60]', '5:59:59 なら 1時間が間に合う');
select pg_temp.at('2026-11-20 06:49:59+09');
select is(pg_temp.options(), '[10]', '6:49:59 は 10分だけ');
select throws_ok('select public.start_timer(60)', 'P0001', 'timer_exceeds_deadline', '間に合わない選択肢はサーバーでも拒否');
select pg_temp.at('2026-11-20 06:50:00+09');
select is(pg_temp.state(), 'CLOSED', '6:50:00 からは CLOSED（締め切り10分前を過ぎた）');
select throws_ok('select public.start_timer(10)', 'P0001', 'day_closed', 'CLOSED では開始できない');

-- 猶予: 6:49:59 に 10分 → 6:59:59 終了 → 翌 7:29:59 まで前日分として書ける
reset role;
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select pg_temp.at('2026-11-20 06:49:59+09');
select is(public.start_timer(10) ->> 'state', 'TIMER_RUNNING', '6:49:59 に 10分のタイマーを開始');
select pg_temp.at('2026-11-20 07:29:58+09');
select is(public.get_today_state() ->> 'day_key', '2026-11-19', '猶予中は前日のまま');
select is(pg_temp.state(), 'WRITABLE', '猶予中は前日分を書ける');
select throws_ok('select public.start_timer(10)', 'P0001', 'previous_day_in_progress', '猶予中は新しい日のタイマーを始められない');
select pg_temp.at('2026-11-20 07:29:59+09');
select is(public.get_today_state() ->> 'day_key', '2026-11-20', '猶予が切れたら新しい日（前日は MISSED）');

select * from finish();
rollback;
