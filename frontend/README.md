# CardioXAI Frontend

React + Vite frontend for the cardiovascular disease risk assessment and monitoring interface.

## Run

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

## ML API

The domain expert dashboard reads model metrics from `server-ml` at:

```text
http://localhost:8001
```

To use a different ML API URL, create a `.env` file:

```text
VITE_ML_API_URL=http://localhost:8001
```

The UI supports these model choices:

- XGBoost
- Random Forest
- Neural Network Classification
- Logistic Regression

For each selected model, the dashboard displays precision, sensitivity/recall, specificity, F1 score, AUC-ROC score, and the confusion matrix.
