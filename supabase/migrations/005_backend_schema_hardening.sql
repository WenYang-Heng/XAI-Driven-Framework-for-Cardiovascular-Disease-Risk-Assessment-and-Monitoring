begin;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ml_models_model_name_check') then
    alter table public.ml_models
      add constraint ml_models_model_name_check
      check (model_name in ('xgboost', 'random_forest', 'neural_network', 'logistic_regression'))
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'prediction_requests_model_name_check') then
    alter table public.prediction_requests
      add constraint prediction_requests_model_name_check
      check (model_name in ('xgboost', 'random_forest', 'neural_network', 'logistic_regression'))
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'prediction_requests_feature_domain_check') then
    alter table public.prediction_requests
      add constraint prediction_requests_feature_domain_check
      check (
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
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'prediction_results_model_name_check') then
    alter table public.prediction_results
      add constraint prediction_results_model_name_check
      check (model_name in ('xgboost', 'random_forest', 'neural_network', 'logistic_regression'))
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'prediction_results_risk_score_check') then
    alter table public.prediction_results
      add constraint prediction_results_risk_score_check
      check (risk_score between 0 and 1)
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'uploaded_files_model_name_check') then
    alter table public.uploaded_files
      add constraint uploaded_files_model_name_check
      check (model_name in ('xgboost', 'random_forest', 'neural_network', 'logistic_regression'))
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'uploaded_files_row_counts_check') then
    alter table public.uploaded_files
      add constraint uploaded_files_row_counts_check
      check (
        total_rows >= 0
        and successful_rows >= 0
        and failed_rows >= 0
        and successful_rows + failed_rows <= total_rows
      )
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'model_metric_snapshots_model_name_check') then
    alter table public.model_metric_snapshots
      add constraint model_metric_snapshots_model_name_check
      check (model_name in ('xgboost', 'random_forest', 'neural_network', 'logistic_regression'))
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'model_metric_snapshots_metric_range_check') then
    alter table public.model_metric_snapshots
      add constraint model_metric_snapshots_metric_range_check
      check (
        accuracy between 0 and 1
        and precision between 0 and 1
        and sensitivity_recall between 0 and 1
        and specificity between 0 and 1
        and f1_score between 0 and 1
        and auc_roc between 0 and 1
        and true_negative >= 0
        and false_positive >= 0
        and false_negative >= 0
        and true_positive >= 0
      )
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'fairness_metric_snapshots_metric_range_check') then
    alter table public.fairness_metric_snapshots
      add constraint fairness_metric_snapshots_metric_range_check
      check (metric_value between -100 and 100)
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'data_drift_snapshots_score_range_check') then
    alter table public.data_drift_snapshots
      add constraint data_drift_snapshots_score_range_check
      check (drift_score >= 0 and threshold_value > 0)
      not valid;
  end if;
end $$;

create index if not exists idx_model_metric_snapshots_created_at
on public.model_metric_snapshots(created_at desc);

create index if not exists idx_fairness_metric_snapshots_created_at
on public.fairness_metric_snapshots(created_at desc);

create index if not exists idx_data_drift_snapshots_created_at
on public.data_drift_snapshots(created_at desc);

create index if not exists idx_batch_prediction_rows_status_created_at
on public.batch_prediction_rows(status, created_at desc);

commit;
