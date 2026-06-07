alter table public.reminders
  drop constraint if exists reminders_repeat_interval_check;

update public.reminders
set repeat_interval = case
  when repeat_interval = 'none' then 'once'
  when repeat_interval = 'twice_weekly' then 'custom'
  else repeat_interval
end;

alter table public.reminders
  alter column repeat_interval set default 'once',
  add constraint reminders_repeat_interval_check
    check (repeat_interval in (
      'once',
      'daily',
      'weekly',
      'custom',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday'
    )),
  add column if not exists custom_mode text
    check (custom_mode in ('interval', 'selected_days')),
  add column if not exists custom_interval integer
    check (custom_interval is null or custom_interval > 0),
  add column if not exists custom_unit text
    check (custom_unit in ('minutes', 'hours', 'days', 'weeks')),
  add column if not exists selected_days jsonb not null default '[]'::jsonb;
