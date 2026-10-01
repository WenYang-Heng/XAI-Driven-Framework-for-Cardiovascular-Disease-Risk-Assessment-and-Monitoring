# CVD Risk Assessment API

FastAPI frontend-facing backend for the cardiovascular disease risk assessment system.

The service is responsible for:

- proxying model and prediction requests to `server-ml`
- validating single and batch prediction inputs
- storing prediction, upload, batch-row, and activity history
- exposing history and admin summary endpoints for the frontend

Storage backend, in order of preference:

1. `DATABASE_URL` set: direct Postgres (use the Supabase **Session pooler** URI; the direct `db.<ref>.supabase.co` host is IPv6-only on the free plan).
2. `SUPABASE_URL` + `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) set: inserts through the Supabase REST API. The clinician workflow requires option 1.
3. Neither: in-memory storage for local development and tests.

All tables have RLS enabled with no policies, so this service must use the secret/service-role key or a direct DB connection.

Model inputs are the 14 Framingham features defined in `app/features.py`.

## Requirements

- Python 3.10–3.12
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
- `GET /api/admin/models`: models with the admin-selected default
- `PUT /api/admin/models/default`: `{"model_name": "logistic_regression"}`

## Clinician Workflow Endpoints

Every request carries the clinician's user id (`clinician_id` in the body or query). Patients are only visible to their assigned or creating clinician.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/clinician/worklist?clinician_id=` | Unreviewed assessments (highest risk first), drafts, recently signed off |
| `GET` | `/api/clinician/patients?clinician_id=&q=` | My patients with their latest risk |
| `POST` | `/api/clinician/patients` | Create a patient profile (demographics + history, with a source tag) |
| `GET` | `/api/clinician/patients/{id}?clinician_id=` | Profile, measurements and assessment timeline |
| `PATCH` | `/api/clinician/patients/{id}` | Update profile/history (provenance updated per field) |
| `POST` | `/api/clinician/patients/{id}/measurements?clinician_id=` | Record vitals/labs (BMI derived from height and weight) |
| `GET` | `/api/clinician/patients/{id}/prefill?clinician_id=` | All 14 model inputs with source, age in days, staleness and missing fields |
| `POST` | `/api/clinician/patients/{id}/assessments` | Save today's readings and confirmed history, run the default model, return prediction + model agreement |
| `GET` | `/api/clinician/assessments/{result_id}?clinician_id=` | Assessment with inputs, XAI, patient and reviews |
| `PUT` | `/api/clinician/assessments/{result_id}/review` | Save a draft verdict or sign off (`sign_off: true` requires `clinical_action`; signed-off reviews are locked) |

Staleness rules: vitals older than 90 days and labs older than 365 days are flagged.

## Tests

```bash
cd server-api
python -m pytest tests
```

Tests use in-memory storage and a mocked `server-ml`.

The ML output is a decision-support risk estimate and should not be presented as a final medical diagnosis.
