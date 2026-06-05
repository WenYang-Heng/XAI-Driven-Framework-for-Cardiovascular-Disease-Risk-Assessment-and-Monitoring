alter table public.assessments_input
  add column if not exists height_cm numeric,
  add column if not exists diastolic_bp numeric,
  add column if not exists glucose_category text
    check (glucose_category in ('normal', 'above_normal', 'well_above_normal', 'unknown')),
  add column if not exists alcohol_intake text
    check (alcohol_intake in ('yes', 'no'));

create index if not exists idx_assessments_prediction_method
on public.assessments(prediction_method);
