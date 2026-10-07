create table public.deposit_checkout_reservations (
  submission_id uuid primary key references public.submissions(id) on delete cascade,
  token uuid not null default gen_random_uuid(),
  stripe_account_id text not null,
  amount_cents integer not null check(amount_cents>=50),
  currency text not null,
  expires_at timestamptz not null default(date_trunc('second',now())+interval '1 hour'),
  stripe_session_id text
);
alter table public.deposit_checkout_reservations enable row level security;

create or replace function public.reserve_deposit_checkout(p_submission_id uuid,p_account_id text,p_amount_cents integer,p_currency text)
returns jsonb language plpgsql set search_path = public as $$
declare reservation public.deposit_checkout_reservations; org_id uuid; settings jsonb; stored_quote jsonb;
begin
  select c.organization_id,v.schema->'settings',s.quote into org_id,settings,stored_quote from public.submissions s join public.calculators c on c.id=s.calculator_id join public.calculator_versions v on v.calculator_id=c.id and v.version=c.active_version where s.id=p_submission_id;
  perform 1 from public.organizations where id=org_id and stripe_account_id=p_account_id for update;
  if not found or public.workspace_plan(org_id) is distinct from 'business' or not coalesce((settings->>'deposits')::boolean,false) then raise exception 'Deposits are not enabled' using errcode='P0001'; end if;
  if not exists(select 1 from public.submissions where id=p_submission_id and public.calculator_accepts_leads(calculator_id)) then raise exception 'Calculator is inactive' using errcode='P0001'; end if;
  if p_amount_cents is distinct from round((stored_quote->>'subtotal')::numeric * coalesce((settings->>'depositPercent')::numeric,20))::integer or p_currency is distinct from lower(stored_quote->>'currency') then raise exception 'Deposit details changed; retry checkout' using errcode='P0001'; end if;
  perform 1 from public.submissions where id=p_submission_id and status not in ('won','lost') for update;
  if not found then raise exception 'Submission is closed' using errcode='P0001'; end if;
  if exists(select 1 from public.payments where submission_id=p_submission_id and status='paid') then
    raise exception 'This deposit has already been paid' using errcode='P0001';
  end if;
  select * into reservation from public.deposit_checkout_reservations where submission_id=p_submission_id;
  if not found then
    if exists(select 1 from public.payments where submission_id=p_submission_id and status='pending') then
      raise exception 'An earlier deposit checkout needs reconciliation' using errcode='P0001';
    end if;
    insert into public.deposit_checkout_reservations(submission_id,stripe_account_id,amount_cents,currency)
    values(p_submission_id,p_account_id,p_amount_cents,p_currency) returning * into reservation;
  end if;
  return to_jsonb(reservation);
end;
$$;

create or replace function public.register_deposit_checkout(p_submission_id uuid,p_token uuid,p_session_id text)
returns void language plpgsql set search_path = public as $$
declare reservation public.deposit_checkout_reservations;
begin
  perform 1 from public.submissions where id=p_submission_id for update;
  select * into reservation from public.deposit_checkout_reservations where submission_id=p_submission_id and token=p_token for update;
  if not found then raise exception 'Checkout reservation changed' using errcode='P0001'; end if;
  if reservation.stripe_session_id is not null and reservation.stripe_session_id<>p_session_id then raise exception 'Checkout session mismatch'; end if;
  insert into public.payments(submission_id,stripe_checkout_session_id,stripe_account_id,amount_cents,currency,status)
  values(p_submission_id,p_session_id,reservation.stripe_account_id,reservation.amount_cents,reservation.currency,'pending')
  on conflict(stripe_checkout_session_id) do nothing;
  update public.deposit_checkout_reservations set stripe_session_id=p_session_id where submission_id=p_submission_id;
end;
$$;

create or replace function public.release_expired_deposit_checkout(p_submission_id uuid,p_token uuid)
returns void language plpgsql set search_path = public as $$
declare reservation public.deposit_checkout_reservations;
begin
  perform 1 from public.submissions where id=p_submission_id for update;
  select * into reservation from public.deposit_checkout_reservations where submission_id=p_submission_id and token=p_token for update;
  if not found then return; end if;
  if exists(select 1 from public.payments where submission_id=p_submission_id and status='paid') then raise exception 'This deposit has already been paid' using errcode='P0001'; end if;
  update public.payments set status='failed' where stripe_checkout_session_id=reservation.stripe_session_id and status='pending';
  delete from public.deposit_checkout_reservations where submission_id=p_submission_id and token=p_token;
end;
$$;
revoke all on function public.reserve_deposit_checkout(uuid,text,integer,text) from public,anon,authenticated;
revoke all on function public.register_deposit_checkout(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.release_expired_deposit_checkout(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_deposit_checkout(uuid,text,integer,text) to service_role;
grant execute on function public.register_deposit_checkout(uuid,uuid,text) to service_role;
grant execute on function public.release_expired_deposit_checkout(uuid,uuid) to service_role;
