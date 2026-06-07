create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create or replace function public.schedule_reminder_email_processor(
  cron_expression text default '*/5 * * * *',
  batch_limit integer default 25
)
returns void
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  project_url text;
  function_invoke_key text;
  processor_token text;
begin
  select decrypted_secret
  into project_url
  from vault.decrypted_secrets
  where name = 'project_url';

  select decrypted_secret
  into function_invoke_key
  from vault.decrypted_secrets
  where name in ('function_invoke_key', 'publishable_key')
  order by case when name = 'function_invoke_key' then 0 else 1 end
  limit 1;

  select decrypted_secret
  into processor_token
  from vault.decrypted_secrets
  where name = 'reminder_processor_token';

  if project_url is null or function_invoke_key is null then
    raise exception 'Missing Vault secrets. Add project_url and function_invoke_key before scheduling reminder emails.';
  end if;

  if batch_limit < 1 or batch_limit > 100 then
    raise exception 'batch_limit must be between 1 and 100.';
  end if;

  if exists (select 1 from cron.job where jobname = 'process-reminder-emails') then
    perform cron.unschedule('process-reminder-emails');
  end if;

  perform cron.schedule(
    'process-reminder-emails',
    cron_expression,
    format(
      $job$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || %L,
          'X-Reminder-Processor-Token', %L
        ),
        body := jsonb_build_object(
          'source', 'supabase_cron',
          'time', now()::text
        )
      ) as request_id;
      $job$,
      rtrim(project_url, '/') || '/functions/v1/process-reminders?limit=' || batch_limit,
      function_invoke_key,
      coalesce(processor_token, '')
    )
  );
end;
$$;

create or replace function public.unschedule_reminder_email_processor()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if exists (select 1 from cron.job where jobname = 'process-reminder-emails') then
    perform cron.unschedule('process-reminder-emails');
  end if;
end;
$$;
