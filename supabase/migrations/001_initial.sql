create extension if not exists pgcrypto;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  created_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.calculators (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  public_id text not null unique check (public_id ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  name text not null check (char_length(name) between 1 and 160),
  template_slug text not null check (template_slug ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  active_version integer not null default 1 check (active_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.calculator_versions (
  calculator_id uuid not null references public.calculators(id) on delete cascade,
  version integer not null check (version > 0),
  schema jsonb not null check (jsonb_typeof(schema) = 'object'),
  pricing_rules jsonb not null check (jsonb_typeof(pricing_rules) = 'array'),
  theme jsonb not null default '{}'::jsonb check (jsonb_typeof(theme) = 'object'),
  created_at timestamptz not null default now(),
  primary key (calculator_id, version)
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  calculator_id uuid not null references public.calculators(id) on delete cascade,
  template_slug text not null,
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  quote jsonb not null check (jsonb_typeof(quote) = 'object'),
  lead_name text not null check (char_length(lead_name) between 1 and 120),
  lead_email text check (lead_email is null or char_length(lead_email) <= 254),
  lead_phone text check (lead_phone is null or char_length(lead_phone) <= 40),
  access_token_hash text not null unique check (access_token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'new' check (status in ('new', 'contacted', 'booked', 'won', 'lost')),
  follow_up_count integer not null default 0 check (follow_up_count >= 0),
  next_follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  check (lead_email is not null or lead_phone is not null)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  starts_at timestamptz not null,
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

create table public.api_rate_limits (
  key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  stripe_checkout_session_id text not null unique,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger calculators_set_updated_at
before update on public.calculators
for each row execute function public.set_updated_at();

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.calculators enable row level security;
alter table public.calculator_versions enable row level security;
alter table public.submissions enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.api_rate_limits enable row level security;

-- Browser clients are read-only. All product mutations go through authenticated
-- server routes that perform authorization and then use the service-role client.
create policy "members read their memberships"
on public.organization_members for select
to authenticated
using (organization_members.user_id = auth.uid());

create policy "members read organizations"
on public.organizations for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members as member
    where member.organization_id = organizations.id
      and member.user_id = auth.uid()
  )
);

create policy "members read calculators"
on public.calculators for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members as member
    where member.organization_id = calculators.organization_id
      and member.user_id = auth.uid()
  )
);

create policy "members read calculator versions"
on public.calculator_versions for select
to authenticated
using (
  exists (
    select 1
    from public.calculators as calculator
    join public.organization_members as member
      on member.organization_id = calculator.organization_id
    where calculator.id = calculator_versions.calculator_id
      and member.user_id = auth.uid()
  )
);

create policy "members read submissions"
on public.submissions for select
to authenticated
using (
  exists (
    select 1
    from public.calculators as calculator
    join public.organization_members as member
      on member.organization_id = calculator.organization_id
    where calculator.id = submissions.calculator_id
      and member.user_id = auth.uid()
  )
);

create policy "members read bookings"
on public.bookings for select
to authenticated
using (
  exists (
    select 1
    from public.submissions as submission
    join public.calculators as calculator on calculator.id = submission.calculator_id
    join public.organization_members as member on member.organization_id = calculator.organization_id
    where submission.id = bookings.submission_id
      and member.user_id = auth.uid()
  )
);

create policy "members read payments"
on public.payments for select
to authenticated
using (
  exists (
    select 1
    from public.submissions as submission
    join public.calculators as calculator on calculator.id = submission.calculator_id
    join public.organization_members as member on member.organization_id = calculator.organization_id
    where submission.id = payments.submission_id
      and member.user_id = auth.uid()
  )
);

create or replace function public.get_or_create_default_organization(
  p_user_id uuid,
  p_workspace_name text
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  organization_id uuid;
begin
  if p_workspace_name is null or char_length(p_workspace_name) not between 1 and 160 then
    raise exception 'Invalid workspace name' using errcode = '22023';
  end if;

  select member.organization_id
  into organization_id
  from public.organization_members as member
  where member.user_id = p_user_id
  order by member.created_at asc
  limit 1;

  if organization_id is not null then
    return organization_id;
  end if;

  -- Serialize first-workspace creation for one user so concurrent calculator
  -- saves cannot create duplicate organizations.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select member.organization_id
  into organization_id
  from public.organization_members as member
  where member.user_id = p_user_id
  order by member.created_at asc
  limit 1;

  if organization_id is not null then
    return organization_id;
  end if;

  insert into public.organizations (name)
  values (p_workspace_name)
  returning id into organization_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (organization_id, p_user_id, 'owner');

  return organization_id;
end;
$$;

create or replace function public.create_calculator_with_version(
  p_organization_id uuid,
  p_public_id text,
  p_name text,
  p_template_slug text,
  p_schema jsonb,
  p_pricing_rules jsonb
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  calculator_id uuid;
begin
  insert into public.calculators (
    organization_id,
    public_id,
    name,
    template_slug,
    active_version
  ) values (
    p_organization_id,
    p_public_id,
    p_name,
    p_template_slug,
    1
  )
  returning id into calculator_id;

  insert into public.calculator_versions (
    calculator_id,
    version,
    schema,
    pricing_rules,
    theme
  ) values (
    calculator_id,
    1,
    p_schema,
    p_pricing_rules,
    '{}'::jsonb
  );

  return calculator_id;
end;
$$;

create or replace function public.request_booking(
  p_submission_id uuid,
  p_starts_at timestamptz
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  booking_id uuid;
begin
  if p_starts_at <= now() or p_starts_at > now() + interval '366 days' then
    raise exception 'Invalid booking time' using errcode = '22023';
  end if;

  insert into public.bookings (submission_id, starts_at, status)
  values (p_submission_id, p_starts_at, 'requested')
  returning id into booking_id;

  update public.submissions
  set status = 'booked', next_follow_up_at = null
  where id = p_submission_id
    and status not in ('won', 'lost');

  if not found then
    raise exception 'Submission cannot be booked' using errcode = 'P0001';
  end if;

  return booking_id;
end;
$$;

revoke all on function public.create_calculator_with_version(uuid, text, text, text, jsonb, jsonb) from public;
revoke all on function public.create_calculator_with_version(uuid, text, text, text, jsonb, jsonb) from anon;
revoke all on function public.create_calculator_with_version(uuid, text, text, text, jsonb, jsonb) from authenticated;
grant execute on function public.create_calculator_with_version(uuid, text, text, text, jsonb, jsonb) to service_role;

revoke all on function public.get_or_create_default_organization(uuid, text) from public;
revoke all on function public.get_or_create_default_organization(uuid, text) from anon;
revoke all on function public.get_or_create_default_organization(uuid, text) from authenticated;
grant execute on function public.get_or_create_default_organization(uuid, text) to service_role;

revoke all on function public.request_booking(uuid, timestamptz) from public;
revoke all on function public.request_booking(uuid, timestamptz) from anon;
revoke all on function public.request_booking(uuid, timestamptz) from authenticated;
grant execute on function public.request_booking(uuid, timestamptz) to service_role;

create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  current_count integer;
  cutoff timestamptz := now() - make_interval(secs => p_window_seconds);
begin
  if p_limit <= 0 or p_window_seconds <= 0 then
    raise exception 'Invalid rate-limit configuration';
  end if;

  insert into public.api_rate_limits as rate_limit (
    key,
    window_started_at,
    request_count,
    updated_at
  ) values (
    p_key,
    now(),
    1,
    now()
  )
  on conflict (key) do update
  set
    request_count = case
      when rate_limit.window_started_at <= cutoff then 1
      else rate_limit.request_count + 1
    end,
    window_started_at = case
      when rate_limit.window_started_at <= cutoff then now()
      else rate_limit.window_started_at
    end,
    updated_at = now()
  returning request_count into current_count;

  return current_count <= p_limit;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public;
revoke all on function public.consume_rate_limit(text, integer, integer) from anon;
revoke all on function public.consume_rate_limit(text, integer, integer) from authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

create index organization_members_user_idx on public.organization_members(user_id, organization_id);
create index submissions_follow_up_idx
  on public.submissions(next_follow_up_at)
  where next_follow_up_at is not null;
create index submissions_status_idx on public.submissions(status, created_at desc);
create index submissions_calculator_idx on public.submissions(calculator_id, created_at desc);
create index bookings_submission_idx on public.bookings(submission_id, created_at desc);
create unique index bookings_one_active_per_submission_idx
  on public.bookings(submission_id)
  where status in ('requested', 'confirmed');
create index payments_submission_idx on public.payments(submission_id, created_at desc);
create unique index payments_one_pending_per_submission_idx
  on public.payments(submission_id)
  where status = 'pending';
