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

After cleaning rows with missing values, the binary target distribution is:

| Binary class | Meaning | Rows | Percentage |
| --- | --- | ---: | ---: |
| `0` | No heart disease | 160 | 53.87% |
| `1` | Heart disease present | 137 | 46.13% |

The original UCI target is a multi-class severity field:

| Raw `num` value | Meaning in this project | Rows | Percentage |
| --- | --- | ---: | ---: |
| `0` | No heart disease | 160 | 53.87% |
| `1` | Heart disease severity 1 | 54 | 18.18% |
| `2` | Heart disease severity 2 | 35 | 11.78% |
| `3` | Heart disease severity 3 | 35 | 11.78% |
| `4` | Heart disease severity 4 | 13 | 4.38% |

For model training, `num=1`, `num=2`, `num=3`, and `num=4` are grouped together as binary class `1`.

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

The service trains a supervised binary classification model. The model learns the relationship between the 13 clinical input features and the binary target:

- `0` = no heart disease
- `1` = heart disease present

The training flow is:

1. Fetch the UCI Heart Disease dataset with `ucimlrepo`.
2. Keep the 13 selected clinical features.
3. Clean the dataset by replacing missing values marked as `?` and dropping incomplete rows.
4. Convert the original target column `num` into a binary label:

   ```text
   num = 0       -> class 0
   num = 1 to 4  -> class 1
   ```

5. Train the selected model on the cleaned feature matrix `X` and binary target `y`.
6. Cache the trained model so repeated predictions do not retrain it every time.

The available models use slightly different learning methods:

| Model | How it learns |
| --- | --- |
| `logistic_regression` | Learns feature weights and converts the weighted score into a probability. |
| `random_forest` | Builds many decision trees and averages their class probabilities. |
| `xgboost` | Builds boosted decision trees, where each tree improves on previous errors. |
| `neural_network` | Learns non-linear patterns through hidden layers and outputs class probabilities. |

`random_forest` and `logistic_regression` use `class_weight="balanced"` to reduce bias if one class has more rows than the other. The current binary dataset is fairly balanced, but this still helps the model treat both classes carefully.

## How the Risk Score Is Calculated

The risk score is the model's predicted probability for class `1`.

In this project:

```text
class 1 = heart disease present
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
    predicted_class = 1 if risk_score >= 0.5 else 0
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
| `[1]` | Select the probability for class `1`, heart disease present. |

The `predict_proba` output gives probabilities for both classes. For example, the model may return:

```text
model.predict_proba(input_frame) = [[0.32, 0.68]]
```

This means:

| Value | Meaning |
| --- | --- |
| `0.32` | Probability of class `0`, no heart disease |
| `0.68` | Probability of class `1`, heart disease present |

Therefore:

```text
risk_score = 0.68
```

This can be interpreted as:

```text
The model estimates a 68% probability that the patient belongs to the heart disease present class.
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
weighted_score = b0 + b1(age) + b2(sex) + b3(cp) + ... + b13(thal)
risk_score = 1 / (1 + e^(-weighted_score))
```

The other models do not use this exact formula, but they still return the same type of value:

```text
probability of class 1
```

## How the Risk Category Is Assigned

After calculating the numeric `risk_score`, the service assigns two outputs:

- `predicted_class`
- `risk_level`

The final predicted class uses a `0.50` threshold:

| Risk score | Predicted class | Meaning |
| --- | --- | --- |
| `< 0.50` | `0` | No heart disease predicted |
| `>= 0.50` | `1` | Heart disease present predicted |

The code is:

```python
predicted_class = 1 if risk_score >= 0.5 else 0
```

The displayed risk category uses separate thresholds:

| Risk score range | Risk level |
| --- | --- |
| `0.00` to `0.34` | Low |
| `0.35` to `0.69` | Moderate |
| `0.70` to `1.00` | High |

The code is:

```python
def _risk_level(score: float) -> str:
    if score >= 0.7:
        return "high"
    if score >= 0.35:
        return "moderate"
    return "low"
```

This means a patient can have:

| Example risk score | Predicted class | Risk level | Explanation |
| --- | --- | --- | --- |
| `0.22` | `0` | Low | The model estimates a low probability of heart disease. |
| `0.48` | `0` | Moderate | The risk level is moderate, but the final class is still no heart disease because it is below `0.50`. |
| `0.68` | `1` | Moderate | The final class is heart disease present, but the risk category is not high because it is below `0.70`. |
| `0.82` | `1` | High | The model estimates a high probability of heart disease. |

The risk score is not calculated from the raw dataset percentages. The percentages only describe the class balance of the training dataset. The actual risk score is produced by the trained ML model using the patient's input features.

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
