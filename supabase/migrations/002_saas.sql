alter table public.organizations
  add column trial_ends_at timestamptz not null default (now() + interval '14 days'),
  add column stripe_customer_id text unique,
  add column stripe_account_id text unique;

create table public.billing_subscriptions (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  plan text not null check (plan in ('basic','premium','business')),
  status text not null,
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  observed_at timestamptz not null default now()
);
alter table public.billing_subscriptions enable row level security;
create policy "members read workspace subscription" on public.billing_subscriptions for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = billing_subscriptions.organization_id and m.user_id = auth.uid()));

create table public.workspace_usage (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  month date not null,
  leads integer not null default 0,
  primary key (organization_id, month)
);
alter table public.workspace_usage enable row level security;
create policy "members read workspace usage" on public.workspace_usage for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = workspace_usage.organization_id and m.user_id = auth.uid()));

alter table public.bookings drop constraint bookings_status_check;
alter table public.bookings add constraint bookings_status_check check(status in ('requested','confirmed','cancelled','completed'));

alter table public.calculators add column archived_at timestamptz;

alter table public.submissions add column follow_up_consent boolean not null default false;
alter table public.payments add column stripe_account_id text;

create or replace function public.workspace_plan(p_organization_id uuid)
returns text language plpgsql set search_path = public as $$
declare subscription public.billing_subscriptions; trial_end timestamptz;
begin
  select * into subscription from public.billing_subscriptions where organization_id = p_organization_id;
  if found then
    if subscription.status in ('active','trialing') and subscription.current_period_end > now() then return subscription.plan; end if;
    return null;
  end if;
  select trial_ends_at into trial_end from public.organizations where id = p_organization_id;
  if trial_end > now() then return 'basic'; end if;
  return null;
end;
$$;

create or replace function public.calculator_accepts_leads(p_calculator_id uuid)
returns boolean language plpgsql set search_path = public as $$
declare calculator public.calculators; plan text; allowed integer;
begin
  select * into calculator from public.calculators where id=p_calculator_id and archived_at is null;
  if not found then return false; end if;
  plan:=public.workspace_plan(calculator.organization_id);
  if plan is null then return false; end if;
  allowed:=case plan when 'basic' then 1 when 'premium' then 5 else 25 end;
  return (select count(*) from public.calculators c where c.organization_id=calculator.organization_id and c.archived_at is null and (c.created_at,c.id)<(calculator.created_at,calculator.id)) < allowed;
end;
$$;

create or replace function public.set_calculator_archived(p_organization_id uuid,p_calculator_id uuid,p_archived boolean)
returns void language plpgsql set search_path = public as $$
declare plan text; allowed integer;
begin
  perform 1 from public.organizations where id=p_organization_id for update;
  perform 1 from public.calculators where id=p_calculator_id and organization_id=p_organization_id for update;
  if not found then raise exception 'Calculator not found' using errcode='42501'; end if;
  if not p_archived then
    plan:=public.workspace_plan(p_organization_id);
    if plan is null then raise exception 'Subscription required' using errcode='P0001'; end if;
    allowed:=case plan when 'basic' then 1 when 'premium' then 5 else 25 end;
    if (select count(*) from public.calculators where organization_id=p_organization_id and archived_at is null and id<>p_calculator_id)>=allowed then
      raise exception 'Calculator limit reached' using errcode='P0001';
    end if;
  end if;
  update public.calculators set archived_at=case when p_archived then now() else null end where id=p_calculator_id;
end;
$$;
revoke all on function public.calculator_accepts_leads(uuid) from public,anon,authenticated;
revoke all on function public.set_calculator_archived(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.calculator_accepts_leads(uuid) to service_role;
grant execute on function public.set_calculator_archived(uuid,uuid,boolean) to service_role;

create or replace function public.sync_billing_subscription(
  p_organization_id uuid, p_customer_id text, p_subscription_id text,
  p_plan text, p_status text, p_period_end timestamptz, p_cancel_at_period_end boolean, p_observed_at timestamptz
) returns void language plpgsql set search_path = public as $$
declare existing public.billing_subscriptions;
begin
  perform 1 from public.organizations where id = p_organization_id and stripe_customer_id = p_customer_id for update;
  if not found then raise exception 'Billing customer mismatch' using errcode='42501'; end if;
  select * into existing from public.billing_subscriptions where organization_id = p_organization_id;
  if found and existing.stripe_subscription_id <> p_subscription_id and existing.status not in ('canceled','incomplete_expired') then
    raise exception 'Workspace already has a subscription' using errcode='23505';
  end if;
  insert into public.billing_subscriptions (organization_id,stripe_customer_id,stripe_subscription_id,plan,status,current_period_end,cancel_at_period_end,observed_at)
  values (p_organization_id,p_customer_id,p_subscription_id,p_plan,p_status,p_period_end,p_cancel_at_period_end,p_observed_at)
  on conflict (organization_id) do update set stripe_customer_id=excluded.stripe_customer_id,stripe_subscription_id=excluded.stripe_subscription_id,
    plan=excluded.plan,status=excluded.status,current_period_end=excluded.current_period_end,cancel_at_period_end=excluded.cancel_at_period_end,observed_at=excluded.observed_at
  where billing_subscriptions.observed_at <= excluded.observed_at;
end;
$$;

create or replace function public.create_calculator_with_version(
  p_organization_id uuid, p_public_id text, p_name text, p_template_slug text, p_schema jsonb, p_pricing_rules jsonb
) returns uuid language plpgsql set search_path = public as $$
declare calculator_id uuid; plan text; allowed integer;
begin
  perform 1 from public.organizations where id=p_organization_id for update;
  plan := public.workspace_plan(p_organization_id);
  if plan is null then raise exception 'Subscription required' using errcode='P0001'; end if;
  allowed := case plan when 'basic' then 1 when 'premium' then 5 else 25 end;
  if (select count(*) from public.calculators where organization_id=p_organization_id and archived_at is null) >= allowed then
    raise exception 'Calculator limit reached' using errcode='P0001';
  end if;
  insert into public.calculators (organization_id,public_id,name,template_slug) values (p_organization_id,p_public_id,p_name,p_template_slug) returning id into calculator_id;
  insert into public.calculator_versions (calculator_id,version,schema,pricing_rules) values (calculator_id,1,p_schema,p_pricing_rules);
  return calculator_id;
end;
$$;

create or replace function public.revise_calculator(
  p_organization_id uuid, p_calculator_id uuid, p_expected_version integer, p_name text, p_schema jsonb, p_pricing_rules jsonb
) returns integer language plpgsql set search_path = public as $$
declare current_version integer;
begin
  perform 1 from public.organizations where id=p_organization_id for update;
  if public.workspace_plan(p_organization_id) is null then raise exception 'Subscription required' using errcode='P0001'; end if;
  select active_version into current_version from public.calculators where id=p_calculator_id and organization_id=p_organization_id for update;
  if not found then raise exception 'Calculator not found' using errcode='42501'; end if;
  if current_version <> p_expected_version then raise exception 'Calculator changed; reload before saving' using errcode='40001'; end if;
  insert into public.calculator_versions (calculator_id,version,schema,pricing_rules) values(p_calculator_id,current_version+1,p_schema,p_pricing_rules);
  update public.calculators set name=p_name,active_version=current_version+1 where id=p_calculator_id;
  return current_version+1;
end;
$$;

create or replace function public.capture_submission(
  p_calculator_id uuid, p_template_slug text, p_answers jsonb, p_quote jsonb,
  p_name text, p_email text, p_phone text, p_token_hash text, p_follow_up_consent boolean
) returns uuid language plpgsql set search_path = public as $$
declare v_organization_id uuid; plan text; allowed integer; current_count integer; submission_id uuid;
begin
  select c.organization_id into v_organization_id from public.calculators c where c.id=p_calculator_id;
  if not found then raise exception 'Calculator not found' using errcode='42501'; end if;
  perform 1 from public.organizations where id=v_organization_id for update;
  plan := public.workspace_plan(v_organization_id);
  if plan is null then raise exception 'Subscription required' using errcode='P0001'; end if;
  if not public.calculator_accepts_leads(p_calculator_id) then raise exception 'Calculator is inactive or exceeds plan limit' using errcode='P0001'; end if;
  allowed := case plan when 'basic' then 100 when 'premium' then 1000 else 10000 end;
  insert into public.workspace_usage as usage (organization_id,month,leads)
  values (v_organization_id,date_trunc('month',now() at time zone 'UTC')::date,1)
  on conflict (organization_id,month) do update set leads=usage.leads+1 returning leads into current_count;
  if current_count > allowed then raise exception 'Monthly lead limit reached' using errcode='P0001'; end if;
  insert into public.submissions (calculator_id,template_slug,answers,quote,lead_name,lead_email,lead_phone,access_token_hash,follow_up_consent,next_follow_up_at)
  values (p_calculator_id,p_template_slug,p_answers,p_quote,p_name,p_email,p_phone,p_token_hash,p_follow_up_consent,
    case when plan in ('premium','business') and p_follow_up_consent and p_email is not null then now()+interval '1 day' else null end)
  returning id into submission_id;
  return submission_id;
end;
$$;

create or replace function public.set_lead_status(p_organization_id uuid,p_submission_id uuid,p_status text)
returns void language plpgsql set search_path = public as $$
begin
  if p_status not in ('new','contacted','won','lost') then raise exception 'Invalid lead status' using errcode='22023'; end if;
  perform 1 from public.submissions s join public.calculators c on c.id=s.calculator_id
  where s.id=p_submission_id and c.organization_id=p_organization_id for update of s;
  if not found then raise exception 'Lead not found' using errcode='42501'; end if;
  if exists(select 1 from public.bookings where submission_id=p_submission_id and status in ('requested','confirmed')) then
    raise exception 'Resolve the active booking first' using errcode='P0001';
  end if;
  update public.submissions set status=p_status,next_follow_up_at=null where id=p_submission_id;
end;
$$;

create or replace function public.resolve_booking(p_organization_id uuid,p_booking_id uuid,p_status text)
returns void language plpgsql set search_path = public as $$
declare submission_id uuid;
begin
  if p_status not in ('confirmed','cancelled','completed') then raise exception 'Invalid booking status' using errcode='22023'; end if;
  select b.submission_id into submission_id from public.bookings b join public.submissions s on s.id=b.submission_id join public.calculators c on c.id=s.calculator_id
  where b.id=p_booking_id and c.organization_id=p_organization_id and b.status in ('requested','confirmed') for update of s,b;
  if not found then raise exception 'Booking not found' using errcode='42501'; end if;
  if p_status='completed' and not exists(select 1 from public.bookings where id=p_booking_id and status='confirmed') then raise exception 'Confirm the booking before completion' using errcode='P0001'; end if;
  update public.bookings set status=p_status where id=p_booking_id;
  update public.submissions set status=case p_status when 'confirmed' then 'booked' when 'completed' then 'won' else 'contacted' end,next_follow_up_at=null where id=submission_id;
end;
$$;

create or replace function public.cleanup_rate_limits() returns void language sql set search_path = public as $$
  delete from public.api_rate_limits where updated_at < now()-interval '2 days';
$$;

revoke all on function public.workspace_plan(uuid) from public,anon,authenticated;
revoke all on function public.sync_billing_subscription(uuid,text,text,text,text,timestamptz,boolean,timestamptz) from public,anon,authenticated;
revoke all on function public.revise_calculator(uuid,uuid,integer,text,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.capture_submission(uuid,text,jsonb,jsonb,text,text,text,text,boolean) from public,anon,authenticated;
revoke all on function public.set_lead_status(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.resolve_booking(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.cleanup_rate_limits() from public,anon,authenticated;
grant execute on function public.workspace_plan(uuid) to service_role;
grant execute on function public.sync_billing_subscription(uuid,text,text,text,text,timestamptz,boolean,timestamptz) to service_role;
grant execute on function public.revise_calculator(uuid,uuid,integer,text,jsonb,jsonb) to service_role;
grant execute on function public.capture_submission(uuid,text,jsonb,jsonb,text,text,text,text,boolean) to service_role;
grant execute on function public.set_lead_status(uuid,uuid,text) to service_role;
grant execute on function public.resolve_booking(uuid,uuid,text) to service_role;
grant execute on function public.cleanup_rate_limits() to service_role;
