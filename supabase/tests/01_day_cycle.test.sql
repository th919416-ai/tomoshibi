-- ステップ2 完了条件: 時刻を差し替えて 6:59 / 7:00 の境界が正しく動くこと（§3, §12）
begin;
select plan(17);

-- 時刻の差し替え（ローカルでは seed で許可済み。テストでは明示的に許可する）
update public.app_settings set allow_clock_override = true;

-- app_day_key の境界
select is(public.app_day_key('2026-11-20 06:59:59+09'), date '2026-11-19', '6:59:59 は前日の day_key');
select is(public.app_day_key('2026-11-20 07:00:00+09'), date '2026-11-20', '7:00:00 から新しい day_key');
select is(public.app_day_key('2026-11-20 00:00:00+09'), date '2026-11-19', '0:00（日付またぎ）はまだ前日');
select is(public.app_day_key('2026-11-19 23:59:59+09'), date '2026-11-19', '23:59:59 は当日');
select is(public.app_day_key('2027-01-01 06:59:59+09'), date '2026-12-31', '年またぎの 6:59:59 は大晦日');
select is(public.app_day_key('2026-11-19 22:00:00+00'), date '2026-11-20', 'UTC で渡しても JST で判定（22:00Z = 7:00 JST）');
select is(public.app_day_key('2026-11-19 21:59:59+00'), date '2026-11-19', 'UTC 21:59:59 = JST 6:59:59');

-- 時間枠
select is(public.app_day_starts_at('2026-11-19'), '2026-11-19 07:00:00+09'::timestamptz, '開始は当日 7:00 JST');
select is(public.app_day_ends_at('2026-11-19'), '2026-11-20 07:00:00+09'::timestamptz, '終了（排他的）は翌 7:00 JST');

-- app_now の差し替え
set local app.now_override = '2026-11-20 06:59:59+09';
select is(public.app_now(), '2026-11-20 06:59:59+09'::timestamptz, 'app_now は差し替えた時刻を返す');
select is(public.app_day_key(), date '2026-11-19', '引数なしでも app_now で判定する');

update public.app_settings set allow_clock_override = false;
select isnt(public.app_now(), '2026-11-20 06:59:59+09'::timestamptz, '許可されていない環境では差し替えを無視する');
update public.app_settings set allow_clock_override = true;

-- お題の可視性（RLS）: 認証済みユーザーとして確認
delete from public.questions where day_key in ('2026-11-19', '2026-11-20');
insert into public.questions (day_key, genre, body) values
  ('2026-11-19', 'memory', 'テスト用・19日の問い'),
  ('2026-11-20', 'senses', 'テスト用・20日の問い');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

set local app.now_override = '2026-11-20 06:59:59+09';
select is((select body from public.get_today_question()), 'テスト用・19日の問い', '6:59:59 は前日のお題');
select is((select count(*)::int from public.questions where day_key = '2026-11-20'), 0, '6:59:59 には翌日のお題は見えない');

set local app.now_override = '2026-11-20 07:00:00+09';
select is((select body from public.get_today_question()), 'テスト用・20日の問い', '7:00:00 に新しいお題に切り替わる');
select is((select count(*)::int from public.questions where day_key = '2026-11-20'), 1, '7:00:00 から当日のお題が見える');

reset role;
set local role anon;
select throws_ok('select * from public.get_today_question()', '42501', null, '未ログインではお題を取得できない');

select * from finish();
rollback;
