-- ステップ5: モデレーション・通報・ブロック（CLAUDE.md §6）
-- 回答の自動審査は Edge Function `moderate-answer` が service_role で answers.status を更新する。

alter table public.app_settings
  -- 異なる何人から通報されたら自動で非表示にするか（§6-6）
  add column report_hide_threshold int not null default 3;

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  answer_id uuid not null references public.answers (id) on delete cascade,
  reason text not null check (reason in ('offensive', 'personal_info', 'self_harm', 'spam', 'other')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (reporter_id, answer_id)
);

create table public.blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_user_id),
  check (blocker_id <> blocked_user_id)
);

-- どちらもクライアントからは読み書きできない（相手の user_id を漏らさないため）。RPC 経由のみ。
alter table public.reports enable row level security;
alter table public.blocks enable row level security;
revoke all on public.reports from anon, authenticated;
revoke all on public.blocks from anon, authenticated;

-- 通報が閾値に達したら非表示にして運営の確認待ちにする
create function public.hide_answer_on_reports()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(distinct r.reporter_id) from public.reports r where r.answer_id = new.answer_id)
     >= (select report_hide_threshold from public.app_settings) then
    update public.answers a set status = 'hidden'
     where a.id = new.answer_id and a.status = 'approved';
  end if;
  return new;
end;
$$;

create trigger reports_hide_answer
  after insert on public.reports
  for each row execute function public.hide_answer_on_reports();

revoke execute on function public.hide_answer_on_reports() from public, anon, authenticated;

-- 運営用ビュー（Supabase Studio で確認する。§10-9）
create view public.admin_report_queue
with (security_invoker = true)
as
select a.id as answer_id, a.day_key, a.status, a.body,
       count(r.id) as report_count,
       array_agg(distinct r.reason) as reasons,
       max(r.created_at) as last_reported_at
from public.answers a
join public.reports r on r.answer_id = a.id and r.reviewed_at is null
group by a.id
order by max(r.created_at) desc;

revoke all on public.admin_report_queue from anon, authenticated;
