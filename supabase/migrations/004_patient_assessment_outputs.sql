alter table public.assessments
  add column if not exists risk_score numeric,
  add column if not exists risk_category text
    check (risk_category in ('low', 'moderate', 'high')),
  add column if not exists confidence_level text
    check (confidence_level in ('low', 'medium', 'high')),
  add column if not exists prediction_method text,
  add column if not exists estimated_inputs jsonb,
  add column if not exists missing_inputs jsonb,
  add column if not exists explanation jsonb;

alter table public.assessments_input
  add column if not exists weight_category text
    check (weight_category in ('healthy', 'overweight', 'obese', 'unsure'));

create index if not exists idx_assessments_risk_category
on public.assessments(risk_category);
