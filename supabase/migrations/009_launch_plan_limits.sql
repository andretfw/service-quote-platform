create or replace function public.calculator_accepts_leads(p_calculator_id uuid)
returns boolean language plpgsql set search_path = public as $$
declare calculator public.calculators; plan text; allowed integer;
begin
  select * into calculator from public.calculators where id=p_calculator_id and archived_at is null;
  if not found then return false; end if;
  plan:=public.workspace_plan(calculator.organization_id);
  if plan is null then return false; end if;
  allowed:=case plan when 'free' then 1 when 'basic' then 5 when 'premium' then 15 when 'business' then 50 else 0 end;
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
    allowed:=case plan when 'free' then 1 when 'basic' then 5 when 'premium' then 15 when 'business' then 50 else 0 end;
    if (select count(*) from public.calculators where organization_id=p_organization_id and archived_at is null and id<>p_calculator_id)>=allowed then
      raise exception 'Calculator limit reached' using errcode='P0001';
    end if;
  end if;
  update public.calculators set archived_at=case when p_archived then now() else null end where id=p_calculator_id;
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
  allowed := case plan when 'free' then 1 when 'basic' then 5 when 'premium' then 15 when 'business' then 50 else 0 end;
  if (select count(*) from public.calculators where organization_id=p_organization_id and archived_at is null) >= allowed then
    raise exception 'Calculator limit reached' using errcode='P0001';
  end if;
  insert into public.calculators (organization_id,public_id,name,template_slug) values (p_organization_id,p_public_id,p_name,p_template_slug) returning id into calculator_id;
  insert into public.calculator_versions (calculator_id,version,schema,pricing_rules) values (calculator_id,1,p_schema,p_pricing_rules);
  return calculator_id;
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
  allowed := case plan when 'free' then 7 when 'basic' then 100 when 'premium' then 1000 when 'business' then 2000 else 0 end;
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
