alter table public.assessments_input
  drop constraint if exists assessments_input_bp_category_check,
  drop constraint if exists assessments_input_cholesterol_category_check;

update public.assessments_input
set bp_category = case
  when bp_category in ('low', 'normal') then 'normal'
  when bp_category in ('elevated', 'stage_1') then 'above_normal'
  when bp_category in ('stage_2', 'crisis') then 'well_above_normal'
  else bp_category
end
where bp_category is not null;

update public.assessments_input
set cholesterol_category = case
  when cholesterol_category = 'desirable' then 'normal'
  when cholesterol_category = 'borderline' then 'above_normal'
  when cholesterol_category = 'high' then 'well_above_normal'
  else cholesterol_category
end
where cholesterol_category is not null;

alter table public.assessments_input
  add constraint assessments_input_bp_category_check
    check (bp_category in ('normal', 'above_normal', 'well_above_normal')),
  add constraint assessments_input_cholesterol_category_check
    check (cholesterol_category in ('normal', 'above_normal', 'well_above_normal'));
