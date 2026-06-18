alter table public.ml_models
  add column if not exists dataset_name text default 'UCI Heart Disease',
  add column if not exists accuracy numeric,
  add column if not exists precision numeric,
  add column if not exists sensitivity_recall numeric,
  add column if not exists specificity numeric,
  add column if not exists f1_score numeric,
  add column if not exists auc_roc numeric,
  add column if not exists confusion_matrix jsonb,
  add column if not exists calibration_metrics jsonb,
  add column if not exists decision_curve_data jsonb,
  add column if not exists roc_curve_data jsonb,
  add column if not exists metrics_updated_at timestamp with time zone;
