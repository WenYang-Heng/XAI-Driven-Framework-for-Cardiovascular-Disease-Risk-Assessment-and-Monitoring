alter table public.assessments_input
  drop constraint if exists assessments_input_bp_category_check,
  drop constraint if exists assessments_input_cholesterol_category_check;

alter table public.assessments_input
  add constraint assessments_input_bp_category_check
    check (bp_category in ('normal', 'above_normal', 'well_above_normal')),
  add constraint assessments_input_cholesterol_category_check
    check (cholesterol_category in ('normal', 'above_normal', 'well_above_normal'));
