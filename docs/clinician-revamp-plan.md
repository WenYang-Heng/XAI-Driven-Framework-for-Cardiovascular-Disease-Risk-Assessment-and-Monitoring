# Clinician Module Revamp Plan

Branch: `revamp/framingham-clinician` (off `dev-wy`)
Owner: domain-expert (clinician) + admin modules
Horizon: one semester (~14 weeks)

## 1. Why revamp

| Today | Problem | Target |
|---|---|---|
| UCI Cleveland dataset (303 rows, ~61 test rows) | Diagnostic CAD target that needs stress-test/angiography inputs; metrics are noise-level; features do not match the patient module | **Framingham** (4,240 rows) predicting **10-year CHD risk** from routine clinical data |
| Doctor types 13 fields every time | No patient context, no reuse, no trend | Assessments hang off a **patient profile**; form is pre-filled, doctor confirms and adds today's readings |
| Doctor picks 1 of 4 models | That is an ML decision, not a clinical one | **Admin sets the active model**; clinician sees a model-agreement signal; picker hidden behind "Research mode" |
| Result → separate SHAP / LIME / Comparison tabs | Research view, not a clinical view | One **Clinical Review** screen: risk, plain-language drivers, modifiable factors, what-if; technical XAI in a collapsible panel |
| Feedback form feeds retraining only | Clinician gets nothing back | Clinician **verdict + action + sign-off + report**; admin sees override/flag analytics, closing the loop |
| History = flat list of predictions | Doctors think in patients | Worklist home + patient timeline |

## 2. Dataset decision

- Source: Framingham Heart Study teaching extract (Kaggle copy, 4,240 × 16). Stored at `server-ml/app/resources/framingham.csv`. **Confirm with supervisor** that the teaching extract is acceptable; cite it in the report.
- Target: `TenYearCHD` (15.2% positive).
- Features (14): `sex, age, current_smoker, cigs_per_day, bp_meds, prevalent_stroke, prevalent_hyp, diabetes, tot_chol, sys_bp, dia_bp, bmi, heart_rate, glucose`.
  - `education` dropped: not a clinical risk factor and not appropriate to ask in a clinical tool.
- Missing values (glucose 388, BPMeds 53, totChol 50, cigsPerDay 29, BMI 19, heartRate 1): kept and median-imputed inside each model pipeline.
- Known limitations (write them up): 1950s–80s US cohort, predominantly white, ages 32–70, CHD-only outcome, no HDL.

### Modelling changes
- Probabilities must mean something to a clinician ("18% 10-year risk"), so **no class re-weighting** that distorts probabilities; report **Brier score** and calibration.
- Risk bands follow common 10-year risk practice: **low < 10%, moderate 10–20%, high ≥ 20%**.
- `predicted_class` = high-risk band (score ≥ 0.20), and classification metrics are reported at that threshold.
- Metrics: held-out 20% test set **plus** 5-fold stratified CV on the training set (mean ± SD) so model comparisons are defensible.
- Baseline for the thesis: published Framingham non-laboratory (BMI-based) CVD equation (D'Agostino 2008) computed on the same test set. *(Coefficients must be verified against the paper before use.)*

## 3. Target clinician flow

```
Worklist (home)
 ├─ High risk, not reviewed · Awaiting my sign-off · Recent imports · Patient self-assessments (phase 6)
 └─ Patient page
     ├─ Profile (demographics + history, each value tagged with source)
     ├─ Risk timeline chart + assessment list
     └─ New assessment
          ├─ Pre-filled from profile + last visit; doctor enters today's vitals/labs; stale-value warnings
          └─ Clinical Review
               ├─ 10-year risk + band + calibrated meaning
               ├─ Top drivers in plain language, modifiable ones highlighted
               ├─ What-if on modifiable factors (smoking, BP, cholesterol, BMI, glucose)
               ├─ Model agreement (other models' scores) warning
               ├─ Clinician verdict: agree / override risk band, flag drivers as clinically wrong,
               │    action taken (none / lifestyle / start-adjust meds / refer / further tests), note → Sign off
               ├─ Printable report
               └─ ▸ Technical details: full SHAP / LIME / comparison / model card
```

## 4. Data model (migration `007_clinician_revamp.sql`)

- `patient_cases` → becomes the clinical patient profile:
  `assigned_clinician_id`, `full_name` (optional/pseudonymised), `sex`, `date_of_birth`,
  `current_smoker`, `cigs_per_day`, `bp_meds`, `prevalent_stroke`, `prevalent_hyp`, `diabetes`,
  `history_source jsonb` (per-field: `self_reported | clinician_verified | imported`, `updated_at`),
  `linked_user_id` → `auth.users` (nullable; patient-app account link, phase 6).
- `patient_measurements` (per visit): `patient_case_id`, `measured_at`, `sys_bp`, `dia_bp`, `heart_rate`, `bmi`, `height_cm`, `weight_kg`, `tot_chol`, `glucose`, `source`, `recorded_by`.
- `prediction_requests.input_features` keeps the **exact snapshot** used, plus `input_sources jsonb`.
- `domain_expert_feedback` adds: `flagged_features jsonb`, `clinical_action text`, `review_status` (`draft | signed_off`), `signed_off_at`.
- `ml_models` adds `is_active boolean` (exactly one active; partial unique index) and `dataset_name`.

## 5. Phases

| # | Phase | Weeks | Output |
|---|---|---|---|
| 0 | Foundations | 1 | Branch, own Supabase project, migrations 001–006 applied, local envs |
| 1 | **ML service on Framingham** | 1–2 | New loader, schema, bands, calibrated metrics + CV, explanations text, tests |
| 2 | Data model | 3 | Migration 007 + RLS for clinician-owned patients |
| 3 | server-api | 4–5 | Patients CRUD, prefill endpoint, assess-with-active-model, verdict/sign-off, worklist, active-model admin endpoint |
| 4 | Clinician frontend | 6–9 | Worklist, patient page + timeline, pre-filled assessment, Clinical Review, technical-details drawer, report, bulk import |
| 5 | Admin loop | 10–11 | Set active model, override-rate and flagged-driver analytics per model/feature, feedback export for retraining |
| 6 | Patient integration (with teammate) | 11–12 | Account link, replace `calculateDemoRisk` with the ML API, clinician sees self-assessments |
| 7 | Evaluation for thesis | 12–14 | CV table, calibration plot, Framingham-equation baseline, SHAP-vs-LIME agreement, clinician usability study (SUS + task timing) |

## 6. Needs agreement before the relevant phase
- **Supervisor**: dataset switch (before phase 1 is merged).
- **Teammate**: feature set, `linked_user_id`, patient module calling the ML API (before phase 6). The patient side currently uses a heuristic (`calculateDemoRisk`), so phase 1 does not break it.
- **Supabase**: creating the personal project (phase 0).
