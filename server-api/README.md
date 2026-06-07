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
- `POST /api/reminders/process-due?dry_run=true`

## Reminder Email Notifications

Reminder emails use due reminders from Supabase and send through Resend.

Configure these values in `.env`:

```powershell
RESEND_API_KEY=your_resend_api_key
REMINDER_EMAIL_FROM=CardioXAI <onboarding@resend.dev>
REMINDER_PROCESSOR_TOKEN=your_internal_processor_token
```

Test without sending email:

```powershell
Invoke-RestMethod -Method Post "http://localhost:8000/api/reminders/process-due?dry_run=true" -Headers @{
  "X-Reminder-Processor-Token" = "your_internal_processor_token"
}
```

Send due reminder emails:

```powershell
Invoke-RestMethod -Method Post "http://localhost:8000/api/reminders/process-due" -Headers @{
  "X-Reminder-Processor-Token" = "your_internal_processor_token"
}
```

### Supabase Scheduled Reminder Emails

For reminders to send while the app is closed, deploy the Supabase Edge Function and schedule it with Supabase Cron.

Deploy the Edge Function:

```powershell
supabase functions deploy process-reminders
```

Set Edge Function secrets:

```powershell
supabase secrets set RESEND_API_KEY=your_resend_api_key
supabase secrets set REMINDER_EMAIL_FROM="CardioXAI <onboarding@resend.dev>"
supabase secrets set REMINDER_PROCESSOR_TOKEN=your_internal_processor_token
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

Store scheduler secrets in Supabase Vault from the SQL editor:

```sql
select vault.create_secret('https://your-project-ref.supabase.co', 'project_url');
select vault.create_secret('your_supabase_publishable_or_anon_key', 'function_invoke_key');
select vault.create_secret('your_internal_processor_token', 'reminder_processor_token');
```

After migration `011_schedule_reminder_processor.sql` is applied, schedule the processor:

```sql
select public.schedule_reminder_email_processor('*/5 * * * *');
```

To stop the schedule:

```sql
select public.unschedule_reminder_email_processor();
```

The ML output is a decision-support risk estimate and should not be presented as a final medical diagnosis.
