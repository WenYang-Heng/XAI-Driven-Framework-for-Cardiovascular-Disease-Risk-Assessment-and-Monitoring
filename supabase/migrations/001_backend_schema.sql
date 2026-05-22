create extension if not exists "pgcrypto";

create table if not exists public.user_profiles (
    user_id uuid primary key,
    full_name text,
    email text unique,
    role text not null check (role in ('ADMIN', 'DOMAIN_EXPERT', 'PATIENT')),
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create table if not exists public.ml_models (
    model_id uuid primary key default gen_random_uuid(),
    model_name text not null unique,
    display_name text not null,
    description text,
    model_version text not null,
    is_active boolean default true,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create table if not exists public.prediction_requests (
    request_id uuid primary key default gen_random_uuid(),
    user_id uuid references public.user_profiles(user_id) on delete set null,
    model_name text not null,
    age integer not null,
    sex integer not null,
    cp integer not null,
    trestbps numeric not null,
    chol numeric not null,
    fbs integer not null,
    restecg integer not null,
    thalach numeric not null,
    exang integer not null,
    oldpeak numeric not null,
    slope integer not null,
    ca integer not null,
    thal integer not null,
    entry_type text not null default 'single' check (entry_type in ('single', 'batch')),
    source text not null default 'server-api' check (source in ('server-api', 'server-ml', 'frontend')),
    created_at timestamp with time zone default now()
);

create table if not exists public.prediction_results (
    result_id uuid primary key default gen_random_uuid(),
    request_id uuid references public.prediction_requests(request_id) on delete cascade,
    user_id uuid references public.user_profiles(user_id) on delete set null,
    model_name text not null,
    model_version text not null,
    risk_score numeric not null,
    predicted_class integer not null check (predicted_class in (0, 1)),
    risk_level text not null check (risk_level in ('low', 'moderate', 'high')),
    explanation jsonb,
    created_at timestamp with time zone default now()
);

create table if not exists public.uploaded_files (
    upload_id uuid primary key default gen_random_uuid(),
    user_id uuid references public.user_profiles(user_id) on delete set null,
    file_name text not null,
    file_type text not null,
    model_name text not null,
    total_rows integer default 0,
    successful_rows integer default 0,
    failed_rows integer default 0,
    upload_status text not null default 'pending' check (upload_status in ('pending', 'processing', 'processed', 'failed')),
    error_message text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create table if not exists public.batch_prediction_rows (
    batch_row_id uuid primary key default gen_random_uuid(),
    upload_id uuid references public.uploaded_files(upload_id) on delete cascade,
    request_id uuid references public.prediction_requests(request_id) on delete set null,
    result_id uuid references public.prediction_results(result_id) on delete set null,
    row_number integer not null,
    status text not null check (status in ('success', 'failed')),
    error_message text,
    created_at timestamp with time zone default now()
);

create table if not exists public.model_metric_snapshots (
    metric_id uuid primary key default gen_random_uuid(),
    model_name text not null,
    model_version text,
    dataset_name text default 'UCI Heart Disease',
    accuracy numeric not null,
    precision numeric not null,
    sensitivity_recall numeric not null,
    specificity numeric not null,
    f1_score numeric not null,
    auc_roc numeric not null,
    true_negative integer not null,
    false_positive integer not null,
    false_negative integer not null,
    true_positive integer not null,
    created_at timestamp with time zone default now()
);

create table if not exists public.activity_logs (
    log_id uuid primary key default gen_random_uuid(),
    user_id uuid references public.user_profiles(user_id) on delete set null,
    action text not null,
    entity_type text,
    entity_id uuid,
    metadata jsonb,
    created_at timestamp with time zone default now()
);
