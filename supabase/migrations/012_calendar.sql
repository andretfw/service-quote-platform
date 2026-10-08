create table public.booking_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  timezone text not null default 'UTC',
  duration_minutes integer not null default 60 check(duration_minutes between 15 and 1440),
  weekdays integer[] not null default array[1,2,3,4,5] check(weekdays <@ array[0,1,2,3,4,5,6]),
  opens_at time not null default '09:00', closes_at time not null default '17:00',
  enforce_hours boolean not null default false,
  check(opens_at < closes_at)
);
create table public.calendar_blocks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  starts_at timestamptz not null, ends_at timestamptz not null,
  label text not null default 'Unavailable' check(length(label) between 1 and 160),
  check(ends_at > starts_at and ends_at <= starts_at + interval '366 days')
);
create index calendar_blocks_workspace on public.calendar_blocks(organization_id,starts_at);
alter table public.bookings add column ends_at timestamptz;
update public.bookings set ends_at=starts_at+interval '1 hour';
alter table public.bookings alter column ends_at set not null;
alter table public.bookings add constraint booking_duration check(ends_at > starts_at and ends_at <= starts_at + interval '24 hours');

create table public.calendar_connections (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check(provider in ('google','outlook')),
  refresh_token text not null,
  revision uuid not null default gen_random_uuid(),
  connected_at timestamptz not null default now(),
  primary key(organization_id,provider)
);
create table public.calendar_oauth_states (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check(provider in ('google','outlook')),
  verifier text not null,
  expires_at timestamptz not null
);
create table public.calendar_deliveries (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check(provider in ('google','outlook')),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  revision uuid not null default gen_random_uuid(),
  connection_revision uuid not null,
  external_id text,
  status text not null default 'pending' check(status in ('pending','synced','failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  claim_token uuid,
  primary key(organization_id,provider,booking_id)
);
create index calendar_deliveries_due on public.calendar_deliveries(next_attempt_at) where status='pending';
do $$ declare name text; begin
  foreach name in array array['booking_settings','calendar_blocks','calendar_connections','calendar_oauth_states','calendar_deliveries'] loop
    execute format('alter table public.%I enable row level security', name);
    execute format('revoke all on public.%I from anon,authenticated', name);
    execute format('grant all on public.%I to service_role', name);
  end loop;
end $$;

create function public.assert_booking_slot(p_org uuid,p_start timestamptz,p_end timestamptz,p_ignore uuid default null)
returns void language plpgsql set search_path=public as $$
declare settings public.booking_settings; local_start timestamp; local_end timestamp;
begin
  perform 1 from public.organizations where id=p_org for update;
  if not found then raise exception 'Workspace not found' using errcode='42501'; end if;
  if p_start<=now() or p_end<=p_start or p_end>p_start+interval '24 hours' or p_start>now()+interval '366 days' then
    raise exception 'Invalid booking time' using errcode='22023';
  end if;
  select * into settings from public.booking_settings where organization_id=p_org;
  if found and settings.enforce_hours then
    local_start:=p_start at time zone settings.timezone;
    local_end:=p_end at time zone settings.timezone;
    if not (extract(dow from local_start)::integer=any(settings.weekdays)) or local_start::date<>local_end::date
      or local_start::time<settings.opens_at or local_end::time>settings.closes_at then
      raise exception 'Outside business working hours' using errcode='P0001';
    end if;
  end if;
  if exists(select 1 from public.calendar_blocks where organization_id=p_org and starts_at<p_end and ends_at>p_start)
    or exists(select 1 from public.bookings b join public.submissions s on s.id=b.submission_id join public.calculators c on c.id=s.calculator_id
      where c.organization_id=p_org and b.status='confirmed' and (p_ignore is null or b.id<>p_ignore) and b.starts_at<p_end and b.ends_at>p_start) then
    raise exception 'This time is unavailable' using errcode='P0001';
  end if;
end;
$$;

create or replace function public.request_booking(p_submission_id uuid,p_starts_at timestamptz)
returns uuid language plpgsql set search_path=public as $$
declare booking_id uuid; org_id uuid; settings jsonb; duration integer;
begin
  select c.organization_id,v.schema->'settings' into org_id,settings
  from public.submissions s join public.calculators c on c.id=s.calculator_id
  join public.calculator_versions v on v.calculator_id=c.id and v.version=c.active_version where s.id=p_submission_id;
  perform 1 from public.organizations where id=org_id for update;
  if not exists(select 1 from public.submissions where id=p_submission_id and public.calculator_accepts_leads(calculator_id)) then raise exception 'Calculator is inactive' using errcode='P0001'; end if;
  if public.workspace_plan(org_id) is distinct from 'business' or not coalesce((settings->>'bookingRequests')::boolean,false) then raise exception 'Booking requests are not enabled' using errcode='P0001'; end if;
  select duration_minutes into duration from public.booking_settings where organization_id=org_id;
  perform public.assert_booking_slot(org_id,p_starts_at,p_starts_at+make_interval(mins=>coalesce(duration,60)));
  perform 1 from public.submissions where id=p_submission_id for update;
  insert into public.bookings(submission_id,starts_at,ends_at,status) values(p_submission_id,p_starts_at,p_starts_at+make_interval(mins=>coalesce(duration,60)),'requested') returning id into booking_id;
  update public.submissions set status='booked',next_follow_up_at=null where id=p_submission_id and status not in ('won','lost');
  if not found then raise exception 'Submission cannot be booked' using errcode='P0001'; end if;
  return booking_id;
end;
$$;

create or replace function public.resolve_booking(p_organization_id uuid,p_booking_id uuid,p_status text)
returns void language plpgsql set search_path=public as $$
declare booking public.bookings;
begin
  perform 1 from public.organizations where id=p_organization_id for update;
  if p_status not in ('confirmed','cancelled','completed') then raise exception 'Invalid booking status' using errcode='22023'; end if;
  select b.* into booking from public.bookings b join public.submissions s on s.id=b.submission_id join public.calculators c on c.id=s.calculator_id
    where b.id=p_booking_id and c.organization_id=p_organization_id and b.status in ('requested','confirmed') for update of b,s;
  if not found then raise exception 'Booking not found' using errcode='42501'; end if;
  if p_status='completed' and booking.status<>'confirmed' then raise exception 'Confirm the booking before completion' using errcode='P0001'; end if;
  if p_status='confirmed' then perform public.assert_booking_slot(p_organization_id,booking.starts_at,booking.ends_at,p_booking_id); end if;
  update public.bookings set status=p_status where id=p_booking_id;
  update public.submissions set status=case p_status when 'confirmed' then 'booked' when 'completed' then 'won' else 'contacted' end,next_follow_up_at=null where id=booking.submission_id;
end;
$$;

create function public.queue_calendar_booking() returns trigger language plpgsql set search_path=public as $$
declare org uuid;
begin
  if new.status not in ('confirmed','cancelled') then return new; end if;
  select c.organization_id into org from public.submissions s join public.calculators c on c.id=s.calculator_id where s.id=new.submission_id;
  insert into public.calendar_deliveries(organization_id,provider,booking_id,connection_revision)
    select org,provider,new.id,revision from public.calendar_connections where organization_id=org
  on conflict(organization_id,provider,booking_id) do update set revision=gen_random_uuid(),connection_revision=excluded.connection_revision,status='pending',attempts=0,next_attempt_at=now(),claim_token=null;
  return new;
end;
$$;
create trigger queue_calendar_booking after update of status,starts_at,ends_at on public.bookings for each row execute function public.queue_calendar_booking();
create function public.claim_calendar_deliveries(p_limit integer) returns jsonb language plpgsql set search_path=public as $$
declare result jsonb;
begin
  delete from public.calendar_oauth_states where expires_at<now();
  update public.calendar_deliveries set status='failed',claim_token=null where status='pending' and attempts>=5 and next_attempt_at<=now();
  with due as (select organization_id,provider,booking_id from public.calendar_deliveries where status='pending' and attempts<5 and next_attempt_at<=now()
    order by next_attempt_at for update skip locked limit least(greatest(p_limit,1),10)),
  claimed as (update public.calendar_deliveries d set attempts=d.attempts+1,claim_token=gen_random_uuid(),next_attempt_at=now()+interval '5 minutes'
    from due where d.organization_id=due.organization_id and d.provider=due.provider and d.booking_id=due.booking_id returning d.*)
  select coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) into result from claimed;
  return result;
end;
$$;
revoke all on function public.assert_booking_slot(uuid,timestamptz,timestamptz,uuid),public.queue_calendar_booking(),public.claim_calendar_deliveries(integer) from public,anon,authenticated;
grant execute on function public.assert_booking_slot(uuid,timestamptz,timestamptz,uuid),public.queue_calendar_booking(),public.claim_calendar_deliveries(integer) to service_role;

create function public.create_calendar_block(p_org uuid,p_start timestamptz,p_end timestamptz,p_label text)
returns uuid language plpgsql set search_path=public as $$
declare block_id uuid;
begin
  perform 1 from public.organizations where id=p_org for update;
  if not found or public.workspace_plan(p_org)<>'business' then raise exception 'Workspace not found' using errcode='42501'; end if;
  if exists(select 1 from public.bookings b join public.submissions s on s.id=b.submission_id join public.calculators c on c.id=s.calculator_id where c.organization_id=p_org and b.status='confirmed' and b.starts_at<p_end and b.ends_at>p_start) then
    raise exception 'This block overlaps a confirmed booking' using errcode='P0001';
  end if;
  insert into public.calendar_blocks(organization_id,starts_at,ends_at,label) values(p_org,p_start,p_end,p_label) returning id into block_id;
  return block_id;
end;
$$;
revoke all on function public.create_calendar_block(uuid,timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function public.create_calendar_block(uuid,timestamptz,timestamptz,text) to service_role;

alter table public.calendar_deliveries add foreign key(organization_id,provider) references public.calendar_connections(organization_id,provider) on delete cascade;
create function public.queue_calendar_connection() returns trigger language plpgsql set search_path=public as $$
begin
  if TG_OP='UPDATE' and new.revision=old.revision then return new; end if;
  insert into public.calendar_deliveries(organization_id,provider,booking_id,connection_revision)
  select new.organization_id,new.provider,b.id,new.revision from public.bookings b join public.submissions s on s.id=b.submission_id join public.calculators c on c.id=s.calculator_id
    where c.organization_id=new.organization_id and b.status='confirmed' and b.ends_at>now()
  on conflict(organization_id,provider,booking_id) do update set external_id=null,connection_revision=excluded.connection_revision,revision=gen_random_uuid(),status='pending',attempts=0,next_attempt_at=now(),claim_token=null;
  return new;
end;
$$;
create trigger queue_calendar_connection after insert or update on public.calendar_connections for each row execute function public.queue_calendar_connection();
revoke all on function public.queue_calendar_connection() from public,anon,authenticated;

create function public.workspace_calendar(p_org uuid,p_from timestamptz,p_until timestamptz)
returns jsonb language plpgsql set search_path=public as $$
declare result jsonb;
begin
 if p_until<=p_from or p_until>p_from+interval '70 days' then raise exception 'Invalid calendar range' using errcode='22023'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'starts_at',b.starts_at,'ends_at',b.ends_at,'status',b.status,'name',s.lead_name) order by b.starts_at,b.id),'[]'::jsonb) into result
 from public.bookings b join public.submissions s on s.id=b.submission_id join public.calculators c on c.id=s.calculator_id where c.organization_id=p_org and b.starts_at<p_until and b.ends_at>p_from;
 return result;
end;
$$;
revoke all on function public.workspace_calendar(uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.workspace_calendar(uuid,timestamptz,timestamptz) to service_role;

create function public.reschedule_booking(p_org uuid,p_id uuid,p_start timestamptz,p_end timestamptz)
returns void language plpgsql set search_path=public as $$
begin
 perform 1 from public.organizations where id=p_org for update;
 if public.workspace_plan(p_org)<>'business' then raise exception 'Upgrade your plan' using errcode='42501';end if;
 perform 1 from public.bookings b join public.submissions s on s.id=b.submission_id join public.calculators c on c.id=s.calculator_id where b.id=p_id and c.organization_id=p_org and b.status in ('requested','confirmed') for update of b,s;
 if not found then raise exception 'Booking not found' using errcode='42501';end if;
 perform public.assert_booking_slot(p_org,p_start,p_end,p_id);
 update public.bookings set starts_at=p_start,ends_at=p_end where id=p_id;
end;
$$;
revoke all on function public.reschedule_booking(uuid,uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.reschedule_booking(uuid,uuid,timestamptz,timestamptz) to service_role;
