# CVD Risk Assessment API

FastAPI frontend-facing backend for the cardiovascular disease risk assessment system.

The service is responsible for:

- proxying model and prediction requests to `server-ml`
- validating single and batch prediction inputs
- storing prediction, upload, batch-row, and activity history
- exposing history and admin summary endpoints for the frontend

When `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured, records are inserted through the Supabase REST API. Without those variables, the service uses in-memory storage for local development.

## Requirements

- Python 3.10+
- `server-ml` running on `http://localhost:8001` by default

## Setup

```powershell
cd server-api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Set `SERVER_ML_BASE_URL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` in `.env` when needed.

## Run

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open:

- API root: http://localhost:8000
- Health check: http://localhost:8000/api/health
- Interactive docs: http://localhost:8000/docs

## Key Endpoints

- `GET /api/models`
- `GET /api/models/{model_name}/metrics`
- `POST /api/predictions`
- `POST /api/predictions/batch`
- `GET /api/history/predictions/{user_id}`
- `GET /api/history/uploads/{user_id}`
- `GET /api/history/uploads/detail/{upload_id}`
- `GET /api/admin/summary`

The ML output is a decision-support risk estimate and should not be presented as a final medical diagnosis.
