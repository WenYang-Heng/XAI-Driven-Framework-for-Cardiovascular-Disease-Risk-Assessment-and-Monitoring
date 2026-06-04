-- Enable UUID generation
create extension if not exists "pgcrypto";

-- Auto-update updated_at function
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;


-- =========================
-- REMINDERS
-- =========================
create table if not exists public.reminders (
  reminder_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  title text not null,
  description text,
  reminder_time timestamptz not null,

  created_at timestamptz not null default now()
);


-- =========================
-- ASSESSMENTS
-- =========================
create table if not exists public.assessments (
  assessment_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Requires public.ml_models table to already exist
  model_id uuid references public.ml_models(model_id) on delete set null,

  assessed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);


-- =========================
-- ASSESSMENTS_INPUT
-- =========================
create table if not exists public.assessments_input (
  assessment_input_id uuid primary key default gen_random_uuid(),

  assessment_id uuid not null unique
    references public.assessments(assessment_id)
    on delete cascade,

  age int,
  sex int,

  bp_input_type text check (
    bp_input_type in ('exact', 'category', 'unknown')
  ),
  systolic_bp numeric,
  bp_category text,

  cholesterol_input_type text check (
    cholesterol_input_type in ('exact', 'category', 'unknown')
  ),
  total_cholesterol numeric,
  cholesterol_category text,

  diabetes_history text,
  smoking_status text,
  activity_level text,
  weight numeric,

  created_at timestamptz not null default now()
);


-- =========================
-- SIMULATION
-- =========================
create table if not exists public.simulation (
  simulation_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  activity_minutes numeric,
  nicotine_exposure numeric,
  sleep_hours numeric,
  target_bp numeric,
  target_cholesterol numeric,
  weight_change numeric,

  projected_risk_score numeric,
  projected_risk_category text,
  safety_status text,

  created_at timestamptz not null default now()
);


-- =========================
-- ACTION_PLANS
-- =========================
create table if not exists public.action_plans (
  action_plan_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  title text not null,
  summary text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- =========================
-- ACTION_ITEMS
-- =========================
create table if not exists public.action_items (
  action_item_id uuid primary key default gen_random_uuid(),

  action_plan_id uuid not null
    references public.action_plans(action_plan_id)
    on delete cascade,

  title text not null,
  priority text,
  factor text,
  difficulty text,
  reason text,

  -- If this is meant to be "daily", "weekly", etc.,
  -- change this column to text instead.
  timeframe timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- =========================
-- UPDATED_AT TRIGGERS
-- =========================
drop trigger if exists set_action_plans_updated_at on public.action_plans;
create trigger set_action_plans_updated_at
before update on public.action_plans
for each row
execute function public.set_updated_at();

drop trigger if exists set_action_items_updated_at on public.action_items;
create trigger set_action_items_updated_at
before update on public.action_items
for each row
execute function public.set_updated_at();


-- =========================
-- INDEXES
-- =========================
create index if not exists idx_reminders_user_id
on public.reminders(user_id);

create index if not exists idx_assessments_user_id
on public.assessments(user_id);

create index if not exists idx_assessments_model_id
on public.assessments(model_id);

create index if not exists idx_assessments_input_assessment_id
on public.assessments_input(assessment_id);

create index if not exists idx_simulation_user_id
on public.simulation(user_id);

create index if not exists idx_action_plans_user_id
on public.action_plans(user_id);

create index if not exists idx_action_items_action_plan_id
on public.action_items(action_plan_id);
