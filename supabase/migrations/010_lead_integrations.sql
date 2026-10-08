create table public.workspace_integrations (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  revision uuid not null default gen_random_uuid(),
  provider text not null check (provider in ('zapier','make')),
  endpoint_url text not null,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
create table public.integration_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  revision uuid not null,
  status text not null default 'pending' check (status in ('pending','delivered','failed','cancelled')),
  attempts integer not null default 0 check (attempts between 0 and 5),
  next_attempt_at timestamptz not null default now(),
  claim_token uuid,
  last_status integer,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique(submission_id,revision)
);
create index integration_deliveries_due on public.integration_deliveries(next_attempt_at) where status='pending';
create index integration_deliveries_workspace on public.integration_deliveries(organization_id,created_at desc);
alter table public.workspace_integrations enable row level security;
alter table public.integration_deliveries enable row level security;
revoke all on public.workspace_integrations, public.integration_deliveries from anon, authenticated;
grant all on public.workspace_integrations, public.integration_deliveries to service_role;

create function public.configure_workspace_integration(p_organization_id uuid,p_provider text,p_url text,p_enabled boolean)
returns void language plpgsql set search_path=public as $$
begin
  perform 1 from public.organizations where id=p_organization_id for update;
  if not found then raise exception 'Workspace not found'; end if;
  if p_enabled and public.workspace_plan(p_organization_id) not in ('premium','business') then
    raise exception 'Upgrade your plan to use this feature' using errcode='42501';
  end if;
  if p_provider is null or p_url is null or not (
    (p_provider='zapier' and p_url ~ '^https://hooks\.zapier\.com/hooks/catch/[0-9]+/[A-Za-z0-9_-]+/?$') or
    (p_provider='make' and p_url ~ '^https://hook\.(eu1|eu2|us1|us2)\.make\.com/[A-Za-z0-9]{20,128}$')
  ) then raise exception 'Invalid integration destination' using errcode='22023'; end if;
  update public.integration_deliveries set status='cancelled',claim_token=null where organization_id=p_organization_id and status='pending';
  insert into public.workspace_integrations(organization_id,provider,endpoint_url,enabled)
  values(p_organization_id,p_provider,p_url,p_enabled)
  on conflict(organization_id) do update set provider=excluded.provider,endpoint_url=excluded.endpoint_url,enabled=excluded.enabled,revision=gen_random_uuid(),updated_at=now();
end;
$$;

create function public.queue_lead_integration()
returns trigger language plpgsql set search_path=public as $$
declare org uuid; connection public.workspace_integrations;
begin
  select organization_id into org from public.calculators where id=new.calculator_id;
  if public.workspace_plan(org) not in ('premium','business') then return new; end if;
  select * into connection from public.workspace_integrations where organization_id=org and enabled;
  if found then
    insert into public.integration_deliveries(organization_id,submission_id,revision) values(org,new.id,connection.revision);
  end if;
  return new;
end;
$$;
create trigger queue_lead_integration after insert on public.submissions for each row execute function public.queue_lead_integration();

create function public.claim_integration_deliveries(p_limit integer)
returns jsonb language plpgsql set search_path=public as $$
declare result jsonb;
begin
  update public.integration_deliveries set status='failed',claim_token=null where status='pending' and attempts>=5 and next_attempt_at<=now();
  with due as (
    select id from public.integration_deliveries where status='pending' and attempts<5 and next_attempt_at<=now()
    order by next_attempt_at for update skip locked limit least(greatest(p_limit,1),20)
  ), claimed as (
    update public.integration_deliveries d set attempts=d.attempts+1,next_attempt_at=now()+interval '5 minutes',claim_token=gen_random_uuid()
    from due where d.id=due.id returning d.*
  ) select coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) into result from claimed;
  return result;
end;
$$;
revoke all on function public.configure_workspace_integration(uuid,text,text,boolean), public.queue_lead_integration(), public.claim_integration_deliveries(integer) from public,anon,authenticated;
grant execute on function public.configure_workspace_integration(uuid,text,text,boolean), public.queue_lead_integration(), public.claim_integration_deliveries(integer) to service_role;
