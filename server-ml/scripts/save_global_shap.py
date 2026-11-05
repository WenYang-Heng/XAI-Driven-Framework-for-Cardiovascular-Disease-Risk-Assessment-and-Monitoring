import argparse
import json
import os
import subprocess
import sys
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

import httpx

from app.schemas import ModelName
from app.services.risk_model import compute_global_shap


MODEL_NAMES: tuple[ModelName, ...] = (
    "xgboost",
    "random_forest",
    "logistic_regression",
    "neural_network",
)


def _load_env() -> None:
    env_path = PROJECT_ROOT / ".env"
    if not env_path.exists():
        return

    for line in env_path.read_text().splitlines():
        clean = line.strip()
        if not clean or clean.startswith("#") or "=" not in clean:
            continue
        key, value = clean.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def _supabase_settings() -> tuple[str, str]:
    _load_env()
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    if supabase_url.endswith("/rest/v1"):
        supabase_url = supabase_url[: -len("/rest/v1")]
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SECRET_KEY", "")
    if not supabase_url or not service_key:
        raise RuntimeError("Set SUPABASE_URL and SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY in server-ml/.env.")
    return supabase_url, service_key


def _headers(service_key: str) -> dict[str, str]:
    return {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _get_model_id(client: httpx.Client, supabase_url: str, headers: dict[str, str], model_name: ModelName) -> str:
    response = client.get(
        f"{supabase_url}/rest/v1/ml_models",
        params={"select": "model_id", "model_name": f"eq.{model_name}", "limit": "1"},
        headers=headers,
    )
    response.raise_for_status()
    rows = response.json()
    if not rows:
        raise RuntimeError(f"No ml_models row found for model_name={model_name}.")
    return rows[0]["model_id"]


def _existing_global_explanation_id(
    client: httpx.Client,
    supabase_url: str,
    headers: dict[str, str],
    model_id: str,
) -> str | None:
    response = client.get(
        f"{supabase_url}/rest/v1/model_global_explanations",
        params={
            "select": "global_explanation_id",
            "model_id": f"eq.{model_id}",
            "explanation_scope": "eq.global",
            "order": "generated_at.desc",
            "limit": "1",
        },
        headers=headers,
    )
    response.raise_for_status()
    rows = response.json()
    return rows[0]["global_explanation_id"] if rows else None


def _payload(model_id: str, global_shap: Any) -> dict[str, Any]:
    data = global_shap.model_dump(mode="json")
    return {
        "model_id": model_id,
        "dataset_name": data["dataset_name"],
        "samples_explained": data["samples_explained"],
        "explainer_type": data["explainer_type"],
        "explanation_scope": "global",
        "feature_importance": data["feature_importance"],
        "beeswarm_data": data["beeswarm_data"],
        "dependence_data": data["dependence_data"],
        "summary_text": data["summary_text"],
        "generation_status": data["generation_status"],
        "error_message": data["error_message"],
        "updated_at": datetime.now(UTC).isoformat(),
    }


def _save_global_shap(model_name: ModelName) -> None:
    supabase_url, service_key = _supabase_settings()
    headers = _headers(service_key)

    print(f"Computing Global SHAP for {model_name}...")
    global_shap = compute_global_shap(model_name)

    try:
        action = _save_global_shap_rest(supabase_url, headers, model_name, global_shap)
    except httpx.HTTPStatusError as error:
        if error.response.status_code != 403:
            raise
        print("Supabase REST returned 403; falling back to DATABASE_URL with psql.")
        action = _save_global_shap_database_url(model_name, global_shap)

    print(
        f"{action} Global SHAP for {model_name}: "
        f"status={global_shap.generation_status}, features={len(global_shap.feature_importance)}"
    )


def _save_global_shap_rest(
    supabase_url: str,
    headers: dict[str, str],
    model_name: ModelName,
    global_shap: Any,
) -> str:
    with httpx.Client(timeout=60) as client:
        model_id = _get_model_id(client, supabase_url, headers, model_name)
        existing_id = _existing_global_explanation_id(client, supabase_url, headers, model_id)
        payload = _payload(model_id, global_shap)

        if existing_id:
            response = client.patch(
                f"{supabase_url}/rest/v1/model_global_explanations",
                params={"global_explanation_id": f"eq.{existing_id}"},
                headers=headers,
                json=payload,
            )
            action = "Updated"
        else:
            response = client.post(
                f"{supabase_url}/rest/v1/model_global_explanations",
                headers=headers,
                json={**payload, "generated_at": datetime.now(UTC).isoformat()},
            )
            action = "Inserted"

        response.raise_for_status()
        return action


def _save_global_shap_database_url(model_name: ModelName, global_shap: Any) -> str:
    database_url = os.getenv("DATABASE_URL", "")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured in server-ml/.env.")

    data = global_shap.model_dump(mode="json")
    now = datetime.now(UTC).isoformat()
    sql = f"""
with target_model as (
  select model_id
  from public.ml_models
  where model_name = {_sql_literal(model_name)}
  limit 1
),
existing as (
  select global_explanation_id
  from public.model_global_explanations
  where model_id = (select model_id from target_model)
    and explanation_scope = 'global'
  order by generated_at desc
  limit 1
),
updated as (
  update public.model_global_explanations
  set
    dataset_name = {_sql_literal(data["dataset_name"])},
    samples_explained = {int(data["samples_explained"])},
    explainer_type = {_sql_nullable_literal(data["explainer_type"])},
    explanation_scope = 'global',
    feature_importance = {_json_literal(data["feature_importance"])}::jsonb,
    beeswarm_data = {_json_nullable_literal(data["beeswarm_data"])},
    dependence_data = {_json_nullable_literal(data["dependence_data"])},
    summary_text = {_sql_nullable_literal(data["summary_text"])},
    generation_status = {_sql_literal(data["generation_status"])},
    error_message = {_sql_nullable_literal(data["error_message"])},
    updated_at = {_sql_literal(now)}::timestamptz
  where global_explanation_id = (select global_explanation_id from existing)
  returning global_explanation_id
)
insert into public.model_global_explanations (
  model_id,
  dataset_name,
  samples_explained,
  explainer_type,
  explanation_scope,
  feature_importance,
  beeswarm_data,
  dependence_data,
  summary_text,
  generation_status,
  error_message,
  generated_at,
  updated_at
)
select
  model_id,
  {_sql_literal(data["dataset_name"])},
  {int(data["samples_explained"])},
  {_sql_nullable_literal(data["explainer_type"])},
  'global',
  {_json_literal(data["feature_importance"])}::jsonb,
  {_json_nullable_literal(data["beeswarm_data"])},
  {_json_nullable_literal(data["dependence_data"])},
  {_sql_nullable_literal(data["summary_text"])},
  {_sql_literal(data["generation_status"])},
  {_sql_nullable_literal(data["error_message"])},
  {_sql_literal(now)}::timestamptz,
  {_sql_literal(now)}::timestamptz
from target_model
where not exists (select 1 from updated);
"""
    with tempfile.NamedTemporaryFile("w", suffix=".sql", delete=False, encoding="utf-8") as file:
        file.write(sql)
        sql_path = file.name

    try:
        result = subprocess.run(
            ["psql", database_url, "-v", "ON_ERROR_STOP=1", "-f", sql_path],
            check=True,
            capture_output=True,
            text=True,
        )
    finally:
        Path(sql_path).unlink(missing_ok=True)

    return "Saved via DATABASE_URL" if result.returncode == 0 else "Skipped"


def _sql_literal(value: Any) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def _sql_nullable_literal(value: Any) -> str:
    if value is None:
        return "null"
    return _sql_literal(value)


def _json_literal(value: Any) -> str:
    return "'" + json.dumps(value).replace("'", "''") + "'"


def _json_nullable_literal(value: Any) -> str:
    if value is None:
        return "null"
    return _json_literal(value) + "::jsonb"


def main() -> None:
    parser = argparse.ArgumentParser(description="Compute and save Global SHAP rows to Supabase.")
    parser.add_argument(
        "--model",
        choices=MODEL_NAMES,
        action="append",
        help="Model to save. Repeat to save multiple models. Defaults to all models.",
    )
    args = parser.parse_args()

    models = tuple(args.model) if args.model else MODEL_NAMES
    for model_name in models:
        _save_global_shap(model_name)


if __name__ == "__main__":
    main()
