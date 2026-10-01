-- 007 made the Cleveland columns nullable, but its conditional domain check evaluated to NULL
-- (and therefore passed) when those columns were missing. Treat NULL as a violation.

begin;

alter table public.prediction_requests
  drop constraint if exists prediction_requests_feature_domain_check;

alter table public.prediction_requests
  add constraint prediction_requests_feature_domain_check
  check (
    feature_set <> 'uci_cleveland'
    or coalesce(
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
      and thal in (3, 6, 7),
      false
    )
  )
  not valid;

commit;
