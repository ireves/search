-- Problem log tables for the Search connector. Run once in the Supabase
-- project's SQL editor (docs/connector-setup.md, step 8).
-- search_calls: one row per connector tool call, written by the connector,
--   holding what Claude asked for and each engine request it made.
-- search_issues: one row per log_issue call (a skill run that hit problems).
-- The connector's publishable key may only add rows; it can't read, change
-- or delete anything. Claude reads the log through the Supabase connector,
-- usually from the search_issue_details view.

create table public.search_calls (
  ref text primary key check (length(ref) <= 16),
  at timestamptz not null default now(),
  tool text not null check (length(tool) <= 20),
  input jsonb check (octet_length(input::text) <= 20000),
  steps jsonb check (octet_length(steps::text) <= 60000),
  outcome jsonb check (octet_length(outcome::text) <= 5000),
  connector text check (length(connector) <= 40)
);
create index search_calls_at on public.search_calls (at desc);

create table public.search_issues (
  id text primary key check (length(id) <= 60),
  at timestamptz not null default now(),
  skill text not null check (length(skill) <= 60),
  mode text check (length(mode) <= 60),
  app text check (length(app) <= 20),
  model text check (length(model) <= 60),
  question text check (length(question) <= 1000),
  follow_up boolean,
  earlier_questions text[] check (cardinality(earlier_questions) <= 5),
  outcome text check (length(outcome) <= 20),
  issues jsonb not null default '[]' check (octet_length(issues::text) <= 80000),
  refs text[] not null default '{}' check (cardinality(refs) <= 40),
  report text check (length(report) <= 200000),
  setup jsonb check (octet_length(setup::text) <= 2000)
);
create index search_issues_at on public.search_issues (at desc);
create index search_issues_refs on public.search_issues using gin (refs);

alter table public.search_calls enable row level security;
alter table public.search_issues enable row level security;
revoke all on public.search_calls, public.search_issues from anon, authenticated;
grant insert on public.search_calls, public.search_issues to anon;
create policy "connector adds calls" on public.search_calls for insert to anon with check (true);
create policy "connector adds issues" on public.search_issues for insert to anon with check (true);

-- Each issue with the full record of the calls it names.
create view public.search_issue_details with (security_invoker = true) as
select i.*,
  coalesce((select jsonb_agg(to_jsonb(c) order by c.at) from public.search_calls c where c.ref = any(i.refs)), '[]') as calls
from public.search_issues i;
revoke all on public.search_issue_details from anon, authenticated;

-- Call records are kept 30 days, or for as long as an issue names them.
-- Needs the pg_cron extension (Database > Extensions).
select cron.schedule('search-calls-cleanup', '17 3 * * *', $$
  delete from public.search_calls c
  where c.at < now() - interval '30 days'
    and not exists (select 1 from public.search_issues i where i.refs @> array[c.ref])
$$);
