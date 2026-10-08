alter table public.submissions add column follow_up_claim_token uuid;

create function public.claim_customer_reminders(p_limit integer)
returns jsonb language plpgsql set search_path=public as $$
declare result jsonb;
begin
  with due as (
    select s.id from public.submissions s
    join public.calculators c on c.id=s.calculator_id
    join public.calculator_versions v on v.calculator_id=c.id and v.version=c.active_version
    where s.next_follow_up_at<=now() and s.follow_up_consent and s.follow_up_count<3
      and s.status in ('new','contacted') and s.lead_email is not null
      and not exists(select 1 from public.bookings b where b.submission_id=s.id and b.status in ('requested','confirmed'))
      and public.workspace_plan(c.organization_id) in ('premium','business')
      and public.calculator_accepts_leads(c.id)
      and v.schema->'settings'->>'followUps'='true'
      and exists (
        select 1 from public.organization_members m join auth.users u on u.id=m.user_id
        where m.organization_id=c.organization_id and m.role='owner' and u.email is not null
      )
    order by s.next_follow_up_at,s.id for update of s skip locked
    limit least(greatest(p_limit,1),10)
  ), claimed as (
    update public.submissions s set next_follow_up_at=now()+interval '10 minutes',follow_up_claim_token=gen_random_uuid()
    from due where s.id=due.id returning s.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'claim_token',s.follow_up_claim_token,'follow_up_count',s.follow_up_count,
    'lead_name',s.lead_name,'lead_email',s.lead_email,'quote',s.quote,
    'calculator_name',coalesce(nullif(v.schema->'translations'->coalesce(s.quote->>'locale',v.schema->'settings'->>'locale','en')->>'name',''),c.name),'business_name',coalesce(nullif(v.schema->'settings'->>'businessName',''),c.name),
    'locale',v.schema->'settings'->>'locale',
    'reply_to',(select u.email from public.organization_members m join auth.users u on u.id=m.user_id
      where m.organization_id=c.organization_id and m.role='owner' and u.email is not null order by m.user_id limit 1)
  )),'[]'::jsonb) into result from claimed s
  join public.calculators c on c.id=s.calculator_id
  join public.calculator_versions v on v.calculator_id=c.id and v.version=c.active_version;
  return result;
end;
$$;

create function public.finish_customer_reminder(p_submission_id uuid,p_claim_token uuid,p_sent boolean)
returns boolean language plpgsql set search_path=public as $$
declare changed integer;
begin
  update public.submissions set
    follow_up_claim_token=null,
    follow_up_count=follow_up_count+case when p_sent then 1 else 0 end,
    status=case when p_sent then 'contacted' else status end,
    next_follow_up_at=case
      when not p_sent then now()+interval '1 hour'
      when follow_up_count=0 then now()+interval '3 days'
      when follow_up_count=1 then now()+interval '7 days'
      else null end
  where id=p_submission_id and follow_up_claim_token=p_claim_token and follow_up_consent
    and status in ('new','contacted') and next_follow_up_at is not null
    and not exists(select 1 from public.bookings b where b.submission_id=p_submission_id and b.status in ('requested','confirmed'));
  get diagnostics changed=row_count;
  return changed=1;
end;
$$;

revoke all on function public.claim_customer_reminders(integer),public.finish_customer_reminder(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.claim_customer_reminders(integer),public.finish_customer_reminder(uuid,uuid,boolean) to service_role;
