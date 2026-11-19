-- ステップ4: 回答の投稿・文字数・猶予・RLS（§3.1, §5.1, §6）
begin;
select plan(17);

update public.app_settings set allow_clock_override = true;

create function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.at(ts text) returns void language plpgsql as $$
begin perform set_config('app.now_override', ts, true); end $$;

insert into auth.users (id, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated');
delete from public.questions where day_key between '2026-11-18' and '2026-11-21';
insert into public.questions (day_key, genre, body) values ('2026-11-19', 'memory', '19日の問い');

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select pg_temp.at('2026-11-19 08:00:00+09');
select throws_ok($$select public.submit_answer(repeat('あ', 30))$$, 'P0001', 'not_writable_yet',
  'タイマーを始める前は投稿できない');
select public.start_timer(10);
select throws_ok($$select public.submit_answer(repeat('あ', 30))$$, 'P0001', 'not_writable_yet',
  'タイマー中は投稿できない（入力欄はロック）');

select pg_temp.at('2026-11-19 08:10:00+09');
select throws_ok($$select public.submit_answer('　' || repeat('あ', 19) || E'\n ')$$, 'P0001', 'answer_too_short',
  '前後の空白（全角・改行）を除いて 19 字は短すぎる');
select throws_ok($$select public.submit_answer(repeat('あ', 401))$$, 'P0001', 'answer_too_long', '401 字は長すぎる');
select is(public.submit_answer('　' || repeat('あ', 20) || E'\n') ->> 'state', 'ANSWERED', '20 字ちょうどは投稿できる');
select is((select body from public.answers), repeat('あ', 20), '前後の空白は取り除いて保存する');
select is((select status from public.answers), 'pending', '投稿直後は審査待ち');
select is(public.get_today_state() -> 'answer' ->> 'status', 'pending', '本人には審査中でも自分の回答が見える');
select throws_ok($$select public.submit_answer(repeat('い', 30))$$, 'P0001', 'already_answered', '投稿は編集できない');

-- 審査で rejected になったら書き直せる
reset role;
update public.answers set status = 'rejected', rejection_reason = 'personal_info';
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(public.get_today_state() -> 'answer' ->> 'rejection_reason', 'personal_info', '却下の理由が本人に伝わる');
select lives_ok($$select public.submit_answer(repeat('い', 30))$$, '却下された回答は書き直せる');
select is((select status from public.answers), 'pending', '書き直すと審査待ちに戻る');

-- RLS: 他人の回答は直接読めない・内部の列は見えない
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select is((select count(*)::int from public.answers), 0, '他人の回答は SELECT できない');
select throws_ok('select exposure_count from public.answers', '42501', null, '配信回数の列は見えない');
select throws_ok($$insert into public.answers (user_id, question_id, day_key, body) values
  ('22222222-2222-2222-2222-222222222222', (select id from public.questions limit 1), '2026-11-19', repeat('う', 30))$$,
  '42501', null, '回答を直接 INSERT できない（RPC 経由のみ）');

-- 猶予: 6:49:59 開始 → 6:59:59 終了 → 翌 7:29:58 は前日分として投稿できる
select pg_temp.at('2026-11-20 06:49:59+09');
select public.start_timer(10);
select pg_temp.at('2026-11-20 07:29:58+09');
select is(public.submit_answer(repeat('え', 25)) ->> 'day_key', '2026-11-19', '猶予中の投稿は前日分になる');
reset role;
select is((select day_key from public.answers where user_id = '22222222-2222-2222-2222-222222222222'),
  date '2026-11-19', '前日の day_key で保存される');

select * from finish();
rollback;
