alter table public.action_plans
  add column if not exists assessment_id uuid references public.assessments(assessment_id) on delete set null,
  add column if not exists risk_score numeric,
  add column if not exists risk_category text
    check (risk_category in ('low', 'moderate', 'high')),
  add column if not exists generated_by text default 'ai_assisted',
  add column if not exists ai_model text,
  add column if not exists generation_metadata jsonb;

alter table public.action_items
  add column if not exists specific_examples text[],
  add column if not exists next_step text,
  add column if not exists barrier_plan text,
  add column if not exists measure text,
  add column if not exists status text default 'not_started';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'action_items'
      and column_name = 'timeframe'
      and data_type <> 'text'
  ) then
    alter table public.action_items
      alter column timeframe type text
      using timeframe::text;
  end if;
end $$;

create index if not exists idx_action_plans_assessment_id
on public.action_plans(assessment_id);

create index if not exists idx_action_plans_risk_category
on public.action_plans(risk_category);
