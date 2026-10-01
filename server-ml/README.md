# server-ml

FastAPI machine learning service that estimates **10-year coronary heart disease (CHD) risk** using the Framingham Heart Study teaching dataset.

The dataset ships with the service at `app/resources/framingham.csv` (4,240 rows), so no download is needed. Models are trained on demand and cached as `.pkl` artifacts.

## Requirements

- Python 3.10–3.12 (the pinned dependencies do not build on 3.14)
- macOS: `brew install libomp` (required by XGBoost)

## Setup

```powershell
cd server-ml
python -m venv .venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

If you already installed the dependencies before the XGBoost compatibility fix, run:

```powershell
pip install --upgrade xgboost==2.1.4
```

## Run

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

Open:

- API root: http://localhost:8001
- Health check: http://localhost:8001/health
- Dataset summary: http://localhost:8001/dataset/summary
- Available models: http://localhost:8001/models
- Model metrics: http://localhost:8001/models/xgboost/metrics
- Interactive docs: http://localhost:8001/docs

The legacy `/api/v1` routes are still registered for compatibility.

## Dataset

Source: Framingham Heart Study teaching extract (Kaggle copy). The target is `ten_year_chd` (source column `TenYearCHD`): whether the participant developed CHD within 10 years.

| Binary class | Meaning | Rows | Percentage |
| --- | --- | ---: | ---: |
| `0` | No CHD within 10 years | 3,596 | 84.8% |
| `1` | CHD within 10 years | 644 | 15.2% |

The model uses 14 input features (API name ← source column):

| Feature | Source | Meaning |
| --- | --- | --- |
| `sex` | `male` | 1 = male, 0 = female |
| `age` | `age` | Years (training range 32–70) |
| `current_smoker` | `currentSmoker` | 1 = currently smokes |
| `cigs_per_day` | `cigsPerDay` | Cigarettes per day |
| `bp_meds` | `BPMeds` | 1 = on blood pressure medication |
| `prevalent_stroke` | `prevalentStroke` | 1 = previous stroke |
| `prevalent_hyp` | `prevalentHyp` | 1 = diagnosed hypertension |
| `diabetes` | `diabetes` | 1 = diabetic |
| `tot_chol` | `totChol` | Total cholesterol, mg/dL |
| `sys_bp` | `sysBP` | Systolic BP, mmHg |
| `dia_bp` | `diaBP` | Diastolic BP, mmHg |
| `bmi` | `BMI` | kg/m² |
| `heart_rate` | `heartRate` | Resting heart rate, bpm |
| `glucose` | `glucose` | mg/dL |

`education` is dropped: it is not a clinical risk factor and should not be collected by a clinical tool.

Missing values (glucose 388, BPMeds 53, totChol 50, cigsPerDay 29, BMI 19, heartRate 1) are kept and median-imputed inside each model pipeline. LIME and SHAP background samples use complete rows only.

Known limitations: a mid-20th-century US cohort that is predominantly white, ages 32–70, a CHD-only outcome, and no HDL cholesterol.

## Models

The prediction endpoint supports four model names:

- `xgboost`
- `random_forest`
- `neural_network`
- `logistic_regression`

Use `model_name` in the prediction request body to choose the model. If omitted, the service uses `logistic_regression`.

## Pretrained Model Artifacts

The service can use saved `.pkl` model artifacts so the model does not need to retrain after every server restart.

Generate all model artifacts with:

```powershell
cd server-ml
.\venv\Scripts\python.exe scripts\train_models.py
```

This creates one artifact per model:

```text
data/models/xgboost.pkl
data/models/random_forest.pkl
data/models/neural_network.pkl
data/models/logistic_regression.pkl
```

When a prediction is requested, the service first checks whether the selected model artifact exists. If the `.pkl` file exists, the model is loaded from disk. If it does not exist, the service trains the model, saves the artifact, and then uses it for prediction.

## How the ML Model Works

The service trains a supervised binary classifier on the 14 features above:

1. Load `app/resources/framingham.csv` and rename columns to API names.
2. Split 80/20 train/test, stratified on the target (`random_state=42`).
3. Train the selected model on the training split (median imputation inside the pipeline).
4. Evaluate on the untouched test split, and run 5-fold stratified cross-validation on the training split.
5. Save the model as a `.pkl` artifact.

| Model | How it learns |
| --- | --- |
| `logistic_regression` | Learns feature weights and converts the weighted score into a probability. |
| `random_forest` | Builds many decision trees and averages their class probabilities. |
| `xgboost` | Builds boosted decision trees, where each tree improves on previous errors. |
| `neural_network` | Learns non-linear patterns through hidden layers and outputs class probabilities. |

No model uses class re-weighting. Re-weighting would inflate the probabilities, and a clinician must be able to read `risk_score = 0.18` as "about an 18% 10-year risk". Calibration is reported with the Brier score (lower is better).

Current results (test split, threshold 0.20):

| Model | AUC | Brier | Sensitivity | Specificity | 5-fold CV AUC |
| --- | ---: | ---: | ---: | ---: | ---: |
| `logistic_regression` | 0.702 | 0.121 | 0.45 | 0.79 | 0.732 ± 0.031 |
| `random_forest` | 0.683 | 0.122 | 0.43 | 0.79 | 0.724 ± 0.034 |
| `xgboost` | 0.673 | 0.124 | 0.43 | 0.78 | 0.717 ± 0.033 |
| `neural_network` | 0.656 | 0.125 | 0.47 | 0.74 | 0.685 ± 0.012 |

AUCs of about 0.70–0.73 match published results on this dataset. The much higher AUCs seen on the UCI Cleveland dataset come from diagnostic inputs (angiography, stress tests), not from better risk prediction.

## How the Explanations Are Computed

All SHAP values are in **probability units**: a value of `0.042` means that feature added about 4.2 percentage points to this patient's 10-year risk compared with the average patient. Contributions plus the base value add up to the predicted risk.

| Model | Per-patient SHAP | Global SHAP |
| --- | --- | --- |
| `random_forest`, `xgboost` | `TreeExplainer` (interventional, probability output) | `TreeExplainer` |
| `logistic_regression`, `neural_network` | `KernelExplainer`, `nsamples="auto"`, `l1_reg=False` | `KernelExplainer`, same settings |

- **Background:** 100 complete rows sampled with a fixed seed. An earlier 40-row sample contained nobody on BP medication, with diabetes or with a previous stroke, so those features always showed exactly 0.
- **Sampling:** `nsamples="auto"` (2 × 14 + 2048 feature combinations) keeps run-to-run variation below about 0.15 percentage points. With 80 samples, features were zeroed and values drifted between runs.
- **`l1_reg=False`:** SHAP's default L1 feature selection activates when fewer than 20% of combinations are evaluated, and forces small contributions to exactly 0.
- **Global SHAP for logistic regression:** uses `KernelExplainer` rather than `LinearExplainer`, because `LinearExplainer` reports log-odds and that would not be comparable with the per-patient explanations.
- **Correlated features:** they share credit. For example, `cigs_per_day` carries most of the smoking effect, so `current_smoker` gets a value near 0.

LIME uses the same 100-row background for its feature statistics.

## How the Risk Score Is Calculated

The risk score is the model's predicted probability for class `1`.

In this project:

```text
class 1 = CHD within 10 years
```

So:

```text
risk_score = P(class 1 | patient clinical features)
```

The prediction function builds a one-row dataframe from the patient input, sends it to the selected trained model, and asks the model for class probabilities:

```python
def predict_risk(request: RiskPredictionRequest) -> RiskPredictionResponse:
    model = get_model(request.model_name)
    input_frame = pd.DataFrame([_feature_payload(request)], columns=FEATURE_COLUMNS)

    risk_score = round(float(model.predict_proba(input_frame)[0][1]), 4)
    predicted_class = 1 if risk_score >= HIGH_RISK_THRESHOLD else 0
    risk_level = _risk_level(risk_score)
```

The important line is:

```python
model.predict_proba(input_frame)[0][1]
```

It can be read like this:

| Code part | Meaning |
| --- | --- |
| `predict_proba(input_frame)` | Return probability values for each class. |
| `[0]` | Select the first patient row in the prediction batch. |
| `[1]` | Select the probability for class `1`, CHD within 10 years. |

The `predict_proba` output gives probabilities for both classes. For example, the model may return:

```text
model.predict_proba(input_frame) = [[0.32, 0.68]]
```

This means:

| Value | Meaning |
| --- | --- |
| `0.32` | Probability of class `0`, no CHD within 10 years |
| `0.68` | Probability of class `1`, CHD within 10 years |

Therefore:

```text
risk_score = 0.68
```

This can be interpreted as:

```text
The model estimates a 68% probability that the patient develops CHD within 10 years.
```

Different model types produce this probability in different ways:

| Model | How class `1` probability is produced |
| --- | --- |
| `logistic_regression` | Calculates a weighted sum of the patient features, then converts it to probability using a sigmoid function. |
| `random_forest` | Gets probability estimates from many decision trees and averages them. |
| `xgboost` | Combines boosted tree outputs and converts the final score into a probability. |
| `neural_network` | Passes the feature values through learned hidden layers and outputs class probabilities. |

For logistic regression, the simplified formula is:

```text
weighted_score = b0 + b1(sex) + b2(age) + b3(current_smoker) + ... + b14(glucose)
risk_score = 1 / (1 + e^(-weighted_score))
```

The other models do not use this exact formula, but they still return the same type of value:

```text
probability of class 1
```

## How the Risk Category Is Assigned

`risk_score` is the estimated probability of CHD within 10 years. It is banded using common 10-year-risk cut-offs:

| Risk score | Risk level |
| --- | --- |
| `< 0.10` | Low |
| `0.10` to `< 0.20` | Moderate |
| `>= 0.20` | High |

`predicted_class` is `1` when the patient is in the high band (`risk_score >= 0.20`). Accuracy, precision, sensitivity, specificity, F1 and the confusion matrix are all computed at this threshold, so "positive" means "flag for clinical action".

The rule-based `explanation` list names the modifiable risk factors that are out of range (smoking, BP ≥ 140/90, total cholesterol ≥ 240, diabetes or glucose ≥ 126, BMI ≥ 30, previous stroke). It also warns when age is outside the 32–70 training range, because that estimate is an extrapolation.

## Example Prediction

```powershell
$body = @{
  model_name = "logistic_regression"
  sex = 1
  age = 58
  current_smoker = 1
  cigs_per_day = 20
  bp_meds = 0
  prevalent_stroke = 0
  prevalent_hyp = 1
  diabetes = 0
  tot_chol = 260
  sys_bp = 150
  dia_bp = 95
  bmi = 29
  heart_rate = 80
  glucose = 90
} | ConvertTo-Json

Invoke-RestMethod http://localhost:8001/api/v1/predict -Method Post -ContentType "application/json" -Body $body
```

The first prediction for each model may take longer if its artifact has not been trained yet.

## Example Metrics Request

```powershell
Invoke-RestMethod http://localhost:8001/api/v1/models/random_forest/metrics
```

Metrics include accuracy, precision, sensitivity/recall, specificity, F1 score, AUC-ROC, Brier score, the decision threshold, 5-fold cross-validation (mean ± SD AUC and Brier), and confusion matrix values.

## Example Batch Prediction

```powershell
Invoke-RestMethod `
  -Uri http://localhost:8001/predict/batch `
  -Method Post `
  -Form @{ model_name = "random_forest"; file = Get-Item ".\data\samples\sample_prediction_upload.csv" }
```

CSV, XLSX, and XLS uploads are supported. Invalid rows return row-level errors instead of failing the entire upload.
