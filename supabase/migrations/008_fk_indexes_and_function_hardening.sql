-- Supabase advisor fixes: pin set_updated_at's search_path and index foreign keys.

begin;

alter function public.set_updated_at() set search_path = '';

create index if not exists idx_activity_logs_user_id on public.activity_logs(user_id);
create index if not exists idx_batch_prediction_rows_patient_case_id on public.batch_prediction_rows(patient_case_id);
create index if not exists idx_batch_prediction_rows_request_id on public.batch_prediction_rows(request_id);
create index if not exists idx_batch_prediction_rows_result_id on public.batch_prediction_rows(result_id);
create index if not exists idx_data_drift_snapshots_model_id on public.data_drift_snapshots(model_id);
create index if not exists idx_fairness_metric_snapshots_model_id on public.fairness_metric_snapshots(model_id);
create index if not exists idx_model_metric_snapshots_model_id on public.model_metric_snapshots(model_id);
create index if not exists idx_patient_measurements_recorded_by on public.patient_measurements(recorded_by);
create index if not exists idx_prediction_requests_measurement_id on public.prediction_requests(measurement_id);
create index if not exists idx_prediction_requests_model_id on public.prediction_requests(model_id);
create index if not exists idx_prediction_results_model_id on public.prediction_results(model_id);
create index if not exists idx_uploaded_files_model_id on public.uploaded_files(model_id);

commit;
