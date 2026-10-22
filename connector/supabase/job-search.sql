-- Run log tables for the job search (docs/job-search/plan.md, section 7).
-- Same Supabase project as the problem log, separate tables. Run once in the
-- project's SQL editor.
-- job_search_runs: one row per run (started by Claude's scheduled task or
--   by hand, real or dry).
-- job_search_stages: one row per stage of a run, with counts, failures,
--   Composio charges and the stage's report (advert details only, never CV
--   text or other personal data).
-- The connector's publishable key may only add rows. Claude reads them with
-- the Supabase connector.

create table public.job_search_runs (
  id text primary key check (length(id) <= 20),
  at timestamptz not null,
  trigger text not null check (trigger in ('cron', 'manual', 'claude')),
  dry_run boolean not null,
  ok boolean not null,
  ms int,
  stages text[] not null default '{}' check (cardinality(stages) <= 20),
  commit text check (length(commit) <= 40)
);
create index job_search_runs_at on public.job_search_runs (at desc);

create table public.job_search_stages (
  id text primary key check (length(id) <= 60),
  run_id text not null check (length(run_id) <= 20),
  at timestamptz not null default now(),
  stage text not null check (length(stage) <= 30),
  dry_run boolean not null,
  ok boolean not null,
  ms int,
  error text check (length(error) <= 1000),
  counts jsonb not null default '{}' check (octet_length(counts::text) <= 5000),
  failures jsonb not null default '[]' check (octet_length(failures::text) <= 40000),
  charge_usd numeric(10, 5) not null default 0,
  details jsonb not null default '{}' check (octet_length(details::text) <= 200000)
);
create index job_search_stages_run on public.job_search_stages (run_id);
create index job_search_stages_at on public.job_search_stages (at desc);

alter table public.job_search_runs enable row level security;
alter table public.job_search_stages enable row level security;
revoke all on public.job_search_runs, public.job_search_stages from anon, authenticated;
grant insert on public.job_search_runs, public.job_search_stages to anon;
create policy "job search adds runs" on public.job_search_runs for insert to anon with check (true);
create policy "job search adds stages" on public.job_search_stages for insert to anon with check (true);

-- Each run with its stages, newest first.
create view public.job_search_run_details with (security_invoker = true) as
select r.*,
  coalesce((select jsonb_agg(to_jsonb(s) - 'run_id' order by s.at) from public.job_search_stages s where s.run_id = r.id), '[]') as stage_reports
from public.job_search_runs r;
revoke all on public.job_search_run_details from anon, authenticated;

-- Run records are kept 90 days. Needs the pg_cron extension (already used by
-- the problem log).
select cron.schedule('job-search-runs-cleanup', '23 3 * * *', $$
  delete from public.job_search_stages where at < now() - interval '90 days';
  delete from public.job_search_runs where at < now() - interval '90 days';
$$);
