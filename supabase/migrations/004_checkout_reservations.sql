create table public.billing_checkout_reservations (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  token uuid not null default gen_random_uuid(),
  plan text not null check (plan in ('basic','premium','business')),
  expires_at timestamptz not null,
  stripe_session_id text
);
alter table public.billing_checkout_reservations enable row level security;

create or replace function public.reserve_subscription_checkout(p_organization_id uuid, p_plan text)
returns jsonb language plpgsql set search_path = public as $$
declare reservation public.billing_checkout_reservations;
begin
  perform 1 from public.organizations where id = p_organization_id for update;
  if not found then raise exception 'Workspace not found'; end if;
  if exists(select 1 from public.billing_subscriptions where organization_id=p_organization_id and status not in ('canceled','incomplete_expired')) then
    raise exception 'Manage your existing subscription in the billing portal' using errcode='P0001';
  end if;
  select * into reservation from public.billing_checkout_reservations where organization_id=p_organization_id;
  if not found or reservation.expires_at <= now() then
    insert into public.billing_checkout_reservations(organization_id,plan,expires_at)
    values(p_organization_id,p_plan,date_trunc('second',now())+interval '31 minutes')
    on conflict(organization_id) do update set token=gen_random_uuid(),plan=excluded.plan,expires_at=excluded.expires_at,stripe_session_id=null
    returning * into reservation;
  end if;
  return to_jsonb(reservation);
end;
$$;
revoke all on function public.reserve_subscription_checkout(uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_subscription_checkout(uuid,text) to service_role;

insert into public.workspace_usage(organization_id,month,leads)
select c.organization_id,date_trunc('month',s.created_at at time zone 'UTC')::date,count(*)::integer
from public.submissions s join public.calculators c on c.id=s.calculator_id
where s.created_at >= date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'
group by c.organization_id,date_trunc('month',s.created_at at time zone 'UTC')::date
on conflict(organization_id,month) do update set leads=greatest(workspace_usage.leads,excluded.leads);

create or replace function public.request_booking(p_submission_id uuid,p_starts_at timestamptz)
returns uuid language plpgsql set search_path = public as $$
declare booking_id uuid; org_id uuid; settings jsonb;
begin
  if p_starts_at <= now() or p_starts_at > now()+interval '366 days' then
    raise exception 'Invalid booking time' using errcode='22023';
  end if;
  select c.organization_id,v.schema->'settings' into org_id,settings
  from public.submissions s join public.calculators c on c.id=s.calculator_id
  join public.calculator_versions v on v.calculator_id=c.id and v.version=c.active_version
  where s.id=p_submission_id;
  perform 1 from public.organizations where id=org_id for update;
  if not exists(select 1 from public.submissions where id=p_submission_id and public.calculator_accepts_leads(calculator_id)) then raise exception 'Calculator is inactive' using errcode='P0001'; end if;
  if public.workspace_plan(org_id) is distinct from 'business' or not coalesce((settings->>'bookingRequests')::boolean,false) then
    raise exception 'Booking requests are not enabled' using errcode='P0001';
  end if;
  perform 1 from public.submissions where id=p_submission_id for update;
  insert into public.bookings(submission_id,starts_at,status) values(p_submission_id,p_starts_at,'requested') returning id into booking_id;
  update public.submissions set status='booked',next_follow_up_at=null where id=p_submission_id and status not in ('won','lost');
  if not found then raise exception 'Submission cannot be booked' using errcode='P0001'; end if;
  return booking_id;
end;
$$;
