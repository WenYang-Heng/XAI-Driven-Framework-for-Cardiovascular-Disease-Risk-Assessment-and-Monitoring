begin;

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_profiles_user_id_auth_users_fkey'
  ) then
    alter table public.user_profiles
      add constraint user_profiles_user_id_auth_users_fkey
      foreign key (user_id)
      references auth.users(id)
      on delete cascade
      not valid;
  end if;
end $$;

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_ml_models_updated_at on public.ml_models;
create trigger set_ml_models_updated_at
before update on public.ml_models
for each row
execute function public.set_updated_at();

create table if not exists public.patient_cases (
  patient_case_id uuid primary key default gen_random_uuid(),
  patient_reference_id text not null unique,
  created_by uuid references public.user_profiles(user_id) on delete set null,
  case_status text not null default 'active'
    check (case_status in ('active', 'archived')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

drop trigger if exists set_patient_cases_updated_at on public.patient_cases;
create trigger set_patient_cases_updated_at
before update on public.patient_cases
for each row
execute function public.set_updated_at();

alter table public.prediction_requests
  add column if not exists patient_case_id uuid references public.patient_cases(patient_case_id) on delete set null,
  add column if not exists model_id uuid references public.ml_models(model_id) on delete set null,
  add column if not exists input_features jsonb,
  add column if not exists assessment_date date default current_date,
  add column if not exists visit_label text;

alter table public.prediction_results
  add column if not exists model_id uuid references public.ml_models(model_id) on delete set null,
  add column if not exists xai jsonb;

create table if not exists public.xai_explanations (
  xai_id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.prediction_results(result_id) on delete cascade,
  xai_method text not null check (xai_method in ('SHAP', 'LIME')),
  all_feature_contributions jsonb not null,
  top_features jsonb,
  shap_values jsonb,
  explanation_text text,
  feature_value_context jsonb,
  normalization_info jsonb,
  created_at timestamp with time zone default now()
);

create table if not exists public.domain_expert_feedback (
  feedback_id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.prediction_results(result_id) on delete cascade,
  expert_id uuid not null references public.user_profiles(user_id) on delete cascade,
  clinician_risk_level text check (clinician_risk_level in ('low', 'moderate', 'high')),
  agreement_level integer check (agreement_level between 1 and 5),
  is_clinically_acceptable boolean,
  confidence_level integer check (confidence_level between 1 and 5),
  feedback_comment text,
  use_for_future_retraining boolean default false,
  created_at timestamp with time zone default now()
);

alter table public.uploaded_files
  add column if not exists model_id uuid references public.ml_models(model_id) on delete set null,
  add column if not exists patient_reference_mode text default 'csv_column'
    check (patient_reference_mode in ('csv_column', 'auto_generate', 'single_case'));

alter table public.batch_prediction_rows
  add column if not exists patient_case_id uuid references public.patient_cases(patient_case_id) on delete set null,
  add column if not exists patient_reference_id text;

alter table public.model_metric_snapshots
  add column if not exists model_id uuid references public.ml_models(model_id) on delete set null,
  add column if not exists calibration_metrics jsonb,
  add column if not exists decision_curve_data jsonb,
  add column if not exists roc_curve_data jsonb;

create table if not exists public.fairness_metric_snapshots (
  fairness_id uuid primary key default gen_random_uuid(),
  model_id uuid references public.ml_models(model_id) on delete set null,
  model_name text not null,
  model_version text,
  dataset_name text default 'UCI Heart Disease',
  sensitive_attribute text not null,
  group_name text not null,
  metric_name text not null,
  metric_value numeric not null,
  created_at timestamp with time zone default now()
);

create table if not exists public.data_drift_snapshots (
  drift_id uuid primary key default gen_random_uuid(),
  model_id uuid references public.ml_models(model_id) on delete set null,
  model_name text not null,
  model_version text,
  dataset_name text default 'UCI Heart Disease',
  feature_name text not null,
  drift_method text default 'PSI',
  drift_score numeric not null,
  threshold_value numeric not null default 0.2,
  drift_status text not null check (drift_status in ('no_drift', 'warning', 'drift_detected')),
  alert_triggered boolean default false,
  alert_message text,
  reference_mean numeric,
  current_mean numeric,
  created_at timestamp with time zone default now()
);

create index if not exists idx_patient_cases_reference on public.patient_cases(patient_reference_id);
create index if not exists idx_patient_cases_created_by on public.patient_cases(created_by);
create index if not exists idx_prediction_requests_user_id on public.prediction_requests(user_id);
create index if not exists idx_prediction_requests_patient_case_id on public.prediction_requests(patient_case_id);
create index if not exists idx_prediction_requests_assessment_date on public.prediction_requests(assessment_date);
create index if not exists idx_prediction_results_request_id on public.prediction_results(request_id);
create index if not exists idx_prediction_results_user_id on public.prediction_results(user_id);
create index if not exists idx_prediction_results_risk_level on public.prediction_results(risk_level);
create index if not exists idx_xai_explanations_result_id on public.xai_explanations(result_id);
create index if not exists idx_domain_expert_feedback_result_id on public.domain_expert_feedback(result_id);
create index if not exists idx_uploaded_files_user_id on public.uploaded_files(user_id);
create index if not exists idx_batch_prediction_rows_upload_id on public.batch_prediction_rows(upload_id);
create index if not exists idx_batch_prediction_rows_patient_reference_id on public.batch_prediction_rows(patient_reference_id);
create index if not exists idx_fairness_metric_model_name on public.fairness_metric_snapshots(model_name);
create index if not exists idx_data_drift_model_feature on public.data_drift_snapshots(model_name, feature_name);

insert into public.ml_models (model_name, display_name, description, model_version, is_active)
values
  ('random_forest', 'Random Forest', 'Tree ensemble model for Cleveland CVD risk assessment.', 'v1.0', true),
  ('xgboost', 'XGBoost', 'Gradient boosted tree model for Cleveland CVD risk assessment.', 'v1.0', true),
  ('logistic_regression', 'Logistic Regression', 'Linear baseline model for Cleveland CVD risk assessment.', 'v1.0', true),
  ('neural_network', 'Neural Network', 'Neural network model for Cleveland CVD risk assessment.', 'v1.0', true)
on conflict (model_name) do update
set
  display_name = excluded.display_name,
  description = excluded.description,
  model_version = excluded.model_version,
  is_active = excluded.is_active,
  updated_at = now();

commit;
