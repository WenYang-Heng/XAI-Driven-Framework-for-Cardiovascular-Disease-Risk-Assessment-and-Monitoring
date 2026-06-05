# Non-Domain Expert CVD Model

This model path is for patient-friendly cardiovascular disease risk estimation using the Kaggle Cardiovascular Disease Dataset.

## Dataset

Expected local file:

```text
server-ml/app/data/raw/cardio_train.csv
```

Download the dataset manually with the Kaggle API or from Kaggle, then place `cardio_train.csv` in the folder above. The app does not download Kaggle data at runtime and must not contain Kaggle credentials.

This dataset is more suitable than the UCI heart disease dataset for non-domain expert users because it supports familiar inputs such as age, sex, height, weight, blood pressure, cholesterol category, glucose category, smoking, and physical activity. The UCI dataset contains more clinical fields such as chest pain type, ECG, exercise angina, ST depression, vessels, and thalassemia.

## Features

The training script uses:

- `age_years`
- `gender`
- `bmi`
- `ap_hi`
- `ap_lo`
- `cholesterol`
- `gluc`
- `smoke`
- `active`
- `alco`, if present

Target: `cardio`.

## Cleaning

The loader:

- Supports semicolon-separated CSV files.
- Drops duplicate rows.
- Converts age from days to years.
- Keeps realistic height, weight, blood pressure, and BMI ranges.
- Requires diastolic blood pressure to be lower than systolic blood pressure.
- Saves a processed CSV to `server-ml/app/data/processed/cardio_processed.csv`.

## Training

Run:

```powershell
cd server-ml
python -m app.scripts.train_non_domain_model
```

The script compares Logistic Regression, Random Forest, Gradient Boosting, and XGBoost if available. It saves:

```text
server-ml/app/models/non_domain_model_comparison.json
server-ml/app/models/non_domain_cvd_model.pkl
server-ml/app/models/non_domain_cvd_metadata.json
```

## Prediction

Endpoint:

```text
POST /predict/non-domain
```

Example request:

```json
{
  "age": 45,
  "sex": "male",
  "height_cm": 170,
  "weight_kg": 75,
  "systolic_bp": 130,
  "diastolic_bp": 85,
  "cholesterol_category": "normal",
  "glucose_category": "unknown",
  "smoking_status": "no",
  "physical_activity": "yes",
  "alcohol_intake": "no"
}
```

The response includes risk score, risk category, confidence level, estimated inputs, missing inputs, and top XAI factors.

## XAI

The service attempts SHAP explanations first. If SHAP is unavailable or incompatible with the selected model, it falls back to feature importance or coefficients and maps feature names to patient-friendly labels.

## Limitations

The model is used for educational risk estimation in a prototype system. It does not provide a medical diagnosis and should not replace professional medical advice.

Risk thresholds are prototype thresholds and should be calibrated before clinical or production use.
