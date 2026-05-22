# server-ml

FastAPI machine learning service for cardiovascular risk prediction using the UCI ML Heart Disease dataset.

The service fetches dataset `id=45` with `ucimlrepo`, keeps the 13 input attributes used by the common heart disease benchmark, and trains cached classifiers on demand.

## Requirements

- Python 3.10+

## Setup

```powershell
cd server-ml
python -m venv .venv
.\.venv\Scripts\Activate.ps1
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

The model uses these input attributes:

- `age`
- `sex`
- `cp`
- `trestbps`
- `chol`
- `fbs`
- `restecg`
- `thalach`
- `exang`
- `oldpeak`
- `slope`
- `ca`
- `thal`

The predicted target is `num`. Target values greater than `0` are treated as heart disease present (`1`), while `0` is treated as no heart disease (`0`).

## Models

The prediction endpoint supports four model names:

- `xgboost`
- `random_forest`
- `neural_network`
- `logistic_regression`

Use `model_name` in the prediction request body to choose the model. If omitted, the service uses `logistic_regression`.

## Example Prediction

```powershell
$body = @{
  model_name = "xgboost"
  age = 55
  sex = 1
  cp = 4
  trestbps = 145
  chol = 220
  fbs = 0
  restecg = 1
  thalach = 150
  exang = 1
  oldpeak = 1.4
  slope = 2
  ca = 0
  thal = 7
} | ConvertTo-Json

Invoke-RestMethod http://localhost:8001/api/v1/predict -Method Post -ContentType "application/json" -Body $body
```

The first prediction for each model may take longer because the service downloads the dataset and trains that selected model.

## Example Metrics Request

```powershell
Invoke-RestMethod http://localhost:8001/api/v1/models/random_forest/metrics
```

Metrics include accuracy, precision, sensitivity/recall, specificity, F1 score, AUC-ROC score, and confusion matrix values.

## Example Batch Prediction

```powershell
Invoke-RestMethod `
  -Uri http://localhost:8001/predict/batch `
  -Method Post `
  -Form @{ model_name = "random_forest"; file = Get-Item ".\data\samples\sample_prediction_upload.csv" }
```

CSV, XLSX, and XLS uploads are supported. Invalid rows return row-level errors instead of failing the entire upload.
