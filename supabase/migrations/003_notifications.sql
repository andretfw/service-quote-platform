create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  recipient text not null,
  sent_at timestamptz,
  retry_at timestamptz not null default now(),
  unique (submission_id,recipient)
);
alter table public.notification_outbox enable row level security;
create index notification_outbox_due_idx on public.notification_outbox(retry_at) where sent_at is null;

create or replace function public.enqueue_lead_notification() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notification_outbox(submission_id,recipient)
  select new.id,u.email from public.calculators c join public.organization_members m on m.organization_id=c.organization_id
  join auth.users u on u.id=m.user_id where c.id=new.calculator_id and m.role='owner' and u.email is not null;
  return new;
end;
$$;
revoke all on function public.enqueue_lead_notification() from public,anon,authenticated;
create trigger submissions_notify_owner after insert on public.submissions for each row execute function public.enqueue_lead_notification();
