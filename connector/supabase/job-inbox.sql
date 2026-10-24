-- The job search Inbox (docs/job-search/plan.md): roles the server found
-- that Claude hasn't reviewed yet, and companies whose careers page the
-- server couldn't read. Same Supabase project as the run log. Run once in
-- the project's SQL editor.
--   status new: waiting for Claude. added: Claude kept it and the server
--   wrote it to Notion's Open Roles (notion_url). rejected: Claude left it
--   out (reason). Reviewed rows are kept so a role is never added twice.
-- Unlike the log tables, the connector's publishable key may also read and
-- change rows here (never delete), because the server checks for duplicates
-- and records Claude's decisions. Only the server holds that key. The rows
-- hold job adverts only, never CV text or other personal data.

create table public.job_inbox (
  id text primary key check (length(id) <= 20),
  at timestamptz not null default now(),
  found date not null,
  kind text not null default 'role' check (kind in ('role', 'needs_claude')),
  status text not null default 'new' check (status in ('new', 'added', 'rejected')),
  company text not null check (length(company) <= 300),
  title text check (length(title) <= 300),
  link text check (length(link) <= 2000),
  -- Every link key for the advert (its own link and job-site copies) and
  -- the company-and-title key, for the duplicate check.
  keys text[] not null default '{}' check (cardinality(keys) <= 10),
  role_key text check (length(role_key) <= 700),
  location text check (length(location) <= 300),
  pay text check (length(pay) <= 300),
  source text check (length(source) <= 50),
  advert text check (length(advert) <= 10000),
  reason text check (length(reason) <= 1000),
  notion_url text check (length(notion_url) <= 300),
  reviewed_at timestamptz
);
create index job_inbox_status on public.job_inbox (status, at);

alter table public.job_inbox enable row level security;
revoke all on public.job_inbox from anon, authenticated;
grant select, insert, update on public.job_inbox to anon;
create policy "job search reads the inbox" on public.job_inbox for select to anon using (true);
create policy "job search adds to the inbox" on public.job_inbox for insert to anon with check (true);
create policy "job search records reviews" on public.job_inbox for update to anon using (true) with check (true);

-- Advert text of reviewed rows is dropped after 30 days (the row stays for
-- the duplicate check), and rejected rows go after a year.
select cron.schedule('job-inbox-cleanup', '37 3 * * *', $$
  update public.job_inbox set advert = null where status <> 'new' and advert is not null and reviewed_at < now() - interval '30 days';
  delete from public.job_inbox where status = 'rejected' and reviewed_at < now() - interval '365 days';
$$);
