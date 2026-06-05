alter table public.reminders
  add column if not exists linked_item text,
  add column if not exists repeat_interval text not null default 'none'
    check (repeat_interval in ('none', 'daily', 'weekly', 'twice_weekly')),
  add column if not exists status text not null default 'scheduled'
    check (status in ('scheduled', 'completed')),
  add column if not exists completed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists set_reminders_updated_at on public.reminders;
create trigger set_reminders_updated_at
before update on public.reminders
for each row
execute function public.set_updated_at();

create index if not exists idx_reminders_user_status_time
on public.reminders(user_id, status, reminder_time);
