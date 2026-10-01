-- Clinician revamp: Framingham feature set, patient-centric profiles,
-- per-visit measurements, clinician sign-off, and admin-selected default model.
-- See docs/clinician-revamp-plan.md.

begin;

-- =========================
-- GLOBAL SHAP (previously created outside migrations)
-- =========================
create table if not exists public.model_global_explanations (
  global_explanation_id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.ml_models(model_id) on delete cascade,
  dataset_name text,
  samples_explained integer,
  explainer_type text,
  explanation_scope text not null default 'global',
  feature_importance jsonb not null default '[]'::jsonb,
  beeswarm_data jsonb,
  dependence_data jsonb,
  summary_text text,
  generation_status text not null default 'pending'
    check (generation_status in ('pending', 'completed', 'failed', 'unavailable')),
  error_message text,
  generated_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists idx_model_global_explanations_model
on public.model_global_explanations(model_id, generated_at desc);

-- =========================
-- ML MODELS: Framingham metadata + admin-selected default
-- =========================
-- is_active = model is available; is_default = the model clinicians are given.
alter table public.ml_models
  add column if not exists is_default boolean not null default false,
  add column if not exists brier_score numeric,
  add column if not exists decision_threshold numeric,
  add column if not exists cross_validation jsonb;

alter table public.ml_models
  alter column dataset_name set default 'Framingham Heart Study';

create unique index if not exists idx_ml_models_single_default
on public.ml_models(is_default) where is_default;

update public.ml_models
set
  dataset_name = 'Framingham Heart Study',
  model_version = 'framingham-chd10-' || model_name,
  description = case model_name
    when 'random_forest' then 'Tree ensemble model for 10-year CHD risk (Framingham).'
    when 'xgboost' then 'Gradient boosted tree model for 10-year CHD risk (Framingham).'
    when 'logistic_regression' then 'Linear model for 10-year CHD risk (Framingham).'
    when 'neural_network' then 'Neural network model for 10-year CHD risk (Framingham).'
    else description
  end;

-- Logistic regression has the best test and cross-validated AUC on Framingham.
update public.ml_models
set is_default = (model_name = 'logistic_regression')
where not exists (select 1 from public.ml_models where is_default);

alter table public.model_metric_snapshots
  add column if not exists brier_score numeric,
  add column if not exists cross_validation jsonb;

alter table public.model_metric_snapshots
  alter column dataset_name set default 'Framingham Heart Study';
alter table public.fairness_metric_snapshots
  alter column dataset_name set default 'Framingham Heart Study';
alter table public.data_drift_snapshots
  alter column dataset_name set default 'Framingham Heart Study';

-- =========================
-- PATIENT PROFILE (stable demographics + history)
-- =========================
alter table public.patient_cases
  add column if not exists assigned_clinician_id uuid references public.user_profiles(user_id) on delete set null,
  add column if not exists display_name text,
  add column if not exists sex smallint check (sex in (0, 1)),
  add column if not exists date_of_birth date,
  add column if not exists current_smoker smallint check (current_smoker in (0, 1)),
  add column if not exists cigs_per_day numeric check (cigs_per_day between 0 and 100),
  add column if not exists bp_meds smallint check (bp_meds in (0, 1)),
  add column if not exists prevalent_stroke smallint check (prevalent_stroke in (0, 1)),
  add column if not exists prevalent_hyp smallint check (prevalent_hyp in (0, 1)),
  add column if not exists diabetes smallint check (diabetes in (0, 1)),
  -- Per-field provenance, e.g. {"current_smoker": {"source": "self_reported", "updated_at": "..."}}
  add column if not exists history_sources jsonb not null default '{}'::jsonb,
  -- Optional link to a patient-app account (agree with the patient-module owner first).
  add column if not exists linked_user_id uuid unique references auth.users(id) on delete set null;

create index if not exists idx_patient_cases_assigned_clinician
on public.patient_cases(assigned_clinician_id);

-- =========================
-- PER-VISIT MEASUREMENTS
-- =========================
create table if not exists public.patient_measurements (
  measurement_id uuid primary key default gen_random_uuid(),
  patient_case_id uuid not null references public.patient_cases(patient_case_id) on delete cascade,
  measured_at timestamp with time zone not null default now(),
  sys_bp numeric check (sys_bp between 70 and 300),
  dia_bp numeric check (dia_bp between 40 and 160),
  heart_rate numeric check (heart_rate between 30 and 200),
  height_cm numeric check (height_cm between 100 and 250),
  weight_kg numeric check (weight_kg between 25 and 300),
  bmi numeric check (bmi between 12 and 70),
  tot_chol numeric check (tot_chol between 80 and 700),
  glucose numeric check (glucose between 40 and 500),
  source text not null default 'clinician'
    check (source in ('clinician', 'lab', 'self_reported', 'imported')),
  recorded_by uuid references public.user_profiles(user_id) on delete set null,
  notes text,
  created_at timestamp with time zone default now()
);

create index if not exists idx_patient_measurements_case_time
on public.patient_measurements(patient_case_id, measured_at desc);

-- =========================
-- PREDICTION REQUESTS: support both feature sets
-- =========================
alter table public.prediction_requests
  add column if not exists feature_set text not null default 'uci_cleveland'
    check (feature_set in ('uci_cleveland', 'framingham')),
  add column if not exists input_sources jsonb,
  add column if not exists measurement_id uuid references public.patient_measurements(measurement_id) on delete set null;

alter table public.prediction_requests
  alter column feature_set set default 'framingham',
  alter column cp drop not null,
  alter column trestbps drop not null,
  alter column chol drop not null,
  alter column fbs drop not null,
  alter column restecg drop not null,
  alter column thalach drop not null,
  alter column exang drop not null,
  alter column oldpeak drop not null,
  alter column slope drop not null,
  alter column ca drop not null,
  alter column thal drop not null;

-- Cleveland domain checks now only apply to Cleveland rows; Framingham inputs live in input_features.
alter table public.prediction_requests
  drop constraint if exists prediction_requests_feature_domain_check;

alter table public.prediction_requests
  add constraint prediction_requests_feature_domain_check
  check (
    feature_set <> 'uci_cleveland'
    or (
      age between 0 and 120
      and sex in (0, 1)
      and cp in (1, 2, 3, 4)
      and trestbps > 0
      and chol > 0
      and fbs in (0, 1)
      and restecg in (0, 1, 2)
      and thalach > 0
      and exang in (0, 1)
      and oldpeak >= 0
      and slope in (1, 2, 3)
      and ca between 0 and 3
      and thal in (3, 6, 7)
    )
  )
  not valid;

alter table public.prediction_requests
  add constraint prediction_requests_framingham_inputs_check
  check (feature_set <> 'framingham' or input_features is not null)
  not valid;

-- =========================
-- CLINICIAN VERDICT + SIGN-OFF
-- =========================
alter table public.domain_expert_feedback
  add column if not exists flagged_features jsonb not null default '[]'::jsonb,
  add column if not exists clinical_action text
    check (clinical_action in ('none', 'lifestyle', 'start_or_adjust_medication', 'refer', 'further_tests')),
  add column if not exists review_status text not null default 'draft'
    check (review_status in ('draft', 'signed_off')),
  add column if not exists signed_off_at timestamp with time zone,
  add column if not exists updated_at timestamp with time zone default now();

alter table public.domain_expert_feedback
  add constraint domain_expert_feedback_signoff_check
  check (review_status <> 'signed_off' or signed_off_at is not null)
  not valid;

create index if not exists idx_domain_expert_feedback_expert_status
on public.domain_expert_feedback(expert_id, review_status);

-- =========================
-- UPDATED_AT TRIGGERS
-- =========================
drop trigger if exists set_domain_expert_feedback_updated_at on public.domain_expert_feedback;
create trigger set_domain_expert_feedback_updated_at
before update on public.domain_expert_feedback
for each row
execute function public.set_updated_at();

drop trigger if exists set_model_global_explanations_updated_at on public.model_global_explanations;
create trigger set_model_global_explanations_updated_at
before update on public.model_global_explanations
for each row
execute function public.set_updated_at();

-- =========================
-- ROW LEVEL SECURITY
-- =========================
-- All data access goes through server-api with the service-role key (which bypasses RLS);
-- the frontend only uses Supabase for auth. Enabling RLS without policies blocks direct
-- access with the public anon/publishable key.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'user_profiles', 'ml_models', 'prediction_requests', 'prediction_results',
    'uploaded_files', 'batch_prediction_rows', 'model_metric_snapshots', 'activity_logs',
    'patient_cases', 'xai_explanations', 'domain_expert_feedback',
    'fairness_metric_snapshots', 'data_drift_snapshots', 'model_global_explanations',
    'patient_measurements', 'reminders', 'assessments', 'assessments_input',
    'simulation', 'action_plans', 'action_items'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

commit;
