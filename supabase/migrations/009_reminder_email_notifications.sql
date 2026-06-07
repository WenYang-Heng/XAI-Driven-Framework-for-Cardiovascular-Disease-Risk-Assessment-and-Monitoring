alter table public.reminders
  add column if not exists notified_at timestamptz,
  add column if not exists email_enabled boolean not null default true,
  add column if not exists notification_channel text not null default 'email'
    check (notification_channel in ('email', 'in_app', 'none')),
  add column if not exists notification_error text;

create index if not exists idx_reminders_due_email
on public.reminders(status, reminder_time, notified_at)
where email_enabled = true;
