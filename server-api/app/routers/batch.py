from io import BytesIO
from typing import Any

import pandas as pd
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.models import BatchConfirmRequest, BatchPreviewRequest, ModelName, PREDICTION_FEATURES
from app.services import ml_client, storage


router = APIRouter(prefix="/api/batch", tags=["batch"])


@router.post("/uploads")
async def create_batch_upload(
    file: UploadFile = File(...),
    model_name: ModelName = Form(...),
    user_id: str | None = Form(None),
    patient_reference_mode: str = Form("csv_column"),
) -> dict:
    content = await file.read()
    await file.seek(0)
    upload_id = await storage.create_upload(
        user_id=user_id,
        file_name=file.filename or "upload.csv",
        file_type=file.content_type or "text/csv",
        model_name=model_name,
        patient_reference_mode=patient_reference_mode,
        content=content,
    )
    await storage.log_activity(user_id, "UPLOAD_BATCH_FILE", "uploaded_files", upload_id)
    return {"success": True, "upload_id": upload_id}


@router.post("/uploads/{upload_id}/preview")
async def preview_batch_upload(upload_id: str, request: BatchPreviewRequest) -> dict:
    uploaded = storage.get_upload_file(upload_id)
    if not uploaded:
        raise HTTPException(status_code=404, detail="Uploaded file not found. Upload the CSV again.")

    rows = _read_rows_from_bytes(uploaded["content"], uploaded["file_name"])
    preview_rows = _preview_rows(
        rows=rows,
        upload_id=upload_id,
        user_id=request.user_id,
        patient_reference_mode=request.patient_reference_mode,
        single_patient_reference_id=request.single_patient_reference_id,
    )
    summary = {
        "total_rows": len(preview_rows),
        "valid_rows": sum(1 for row in preview_rows if row["status"] == "valid"),
        "invalid_rows": sum(1 for row in preview_rows if row["status"] == "invalid"),
        "new_patient_cases": sum(1 for row in preview_rows if row["will_create_patient_case"]),
        "existing_patient_cases": sum(1 for row in preview_rows if row["existing_patient_case_id"]),
    }
    await storage.log_activity(request.user_id, "PREVIEW_BATCH_MAPPING", "uploaded_files", upload_id)
    return {"success": True, "upload_id": upload_id, "summary": summary, "rows": preview_rows}


@router.post("/uploads/{upload_id}/confirm")
async def confirm_batch_upload(upload_id: str, request: BatchConfirmRequest) -> dict:
    uploaded = storage.get_upload_file(upload_id)
    if not uploaded:
        raise HTTPException(status_code=404, detail="Uploaded file not found. Upload the CSV again.")

    rows = _read_rows_from_bytes(uploaded["content"], uploaded["file_name"])
    preview_rows = _preview_rows(
        rows=rows,
        upload_id=upload_id,
        user_id=request.user_id,
        patient_reference_mode=request.patient_reference_mode,
        single_patient_reference_id=request.single_patient_reference_id,
    )
    invalid_by_row = {row["row_number"]: row for row in preview_rows if row["status"] == "invalid"}

    try:
        batch_prediction = await ml_client.predict_batch_bytes(
            uploaded["content"],
            uploaded["file_name"],
            uploaded["file_type"],
            request.model_name,
        )
    except Exception as error:
        await storage.update_upload(upload_id, len(rows), 0, len(rows), "failed")
        raise HTTPException(status_code=502, detail=f"server-ml batch request failed: {error}") from error

    results = []
    errors = []
    successful_rows = 0
    failed_rows = 0

    for result in batch_prediction.results:
        preview = next((row for row in preview_rows if row["row_number"] == result.row_number), None)
        patient_reference_id = preview.get("patient_reference_id") if preview else None

        if result.row_number in invalid_by_row or result.status == "failed":
            message = result.error_message or "; ".join(invalid_by_row.get(result.row_number, {}).get("errors", []))
            await storage.save_batch_row(
                upload_id=upload_id,
                row_number=result.row_number,
                status="failed",
                error_message=message,
                patient_reference_id=patient_reference_id,
            )
            errors.append({"row_number": result.row_number, "error_message": message})
            failed_rows += 1
            continue

        request_id = None
        result_id = None
        patient_case_id = None
        if 0 < result.row_number <= len(rows):
            request_payload = {
                **{key: rows[result.row_number - 1][key] for key in PREDICTION_FEATURES},
                "user_id": request.user_id,
                "model_name": request.model_name,
                "patient_reference_id": patient_reference_id,
                "assessment_date": rows[result.row_number - 1].get("assessment_date"),
                "visit_label": rows[result.row_number - 1].get("visit_label"),
            }
            prediction_payload = {
                "model_name": request.model_name,
                "risk_score": result.risk_score,
                "predicted_class": result.predicted_class,
                "risk_level": result.risk_level,
                "explanation": result.explanation or [],
                "xai": result.xai.model_dump() if result.xai else None,
                "model_version": result.model_version or f"uci-heart-{request.model_name}",
            }
            request_id, result_id, patient_case_id, saved_patient_reference_id = await storage.save_prediction(
                request_payload,
                prediction_payload,
                entry_type="batch",
            )
            patient_reference_id = saved_patient_reference_id or patient_reference_id

        await storage.save_batch_row(
            upload_id=upload_id,
            row_number=result.row_number,
            status="success",
            request_id=request_id,
            result_id=result_id,
            patient_case_id=patient_case_id,
            patient_reference_id=patient_reference_id,
        )
        successful_rows += 1
        await storage.log_activity(request.user_id, "PROCESS_BATCH_ROW_SUCCESS", "batch_prediction_rows", result_id)
        results.append(
            {
                "row_number": result.row_number,
                "patient_reference_id": patient_reference_id,
                "request_id": request_id,
                "result_id": result_id,
                "risk_score": result.risk_score,
                "predicted_class": result.predicted_class,
                "risk_level": result.risk_level,
                "explanation": result.explanation or [],
                "xai": result.xai.model_dump() if result.xai else None,
            }
        )

    await storage.update_upload(
        upload_id=upload_id,
        total_rows=len(rows),
        successful_rows=successful_rows,
        failed_rows=failed_rows,
        status="processed",
    )
    await storage.log_activity(request.user_id, "CONFIRM_BATCH_PROCESSING", "uploaded_files", upload_id)

    return {
        "success": True,
        "upload_id": upload_id,
        "summary": {
            "total_rows": len(rows),
            "successful_rows": successful_rows,
            "failed_rows": failed_rows,
        },
        "results": results,
        "errors": errors,
    }


def _read_rows_from_bytes(content: bytes, file_name: str) -> list[dict[str, Any]]:
    filename = file_name.lower()
    if filename.endswith(".csv"):
        df = pd.read_csv(BytesIO(content))
    else:
        df = pd.read_excel(BytesIO(content))

    rows: list[dict[str, Any]] = []
    for _, row in df.iterrows():
        clean = row.where(row.notnull(), None).to_dict()
        rows.append({key: _to_python(value) for key, value in clean.items()})
    return rows


def _preview_rows(
    rows: list[dict[str, Any]],
    upload_id: str,
    user_id: str | None,
    patient_reference_mode: str,
    single_patient_reference_id: str | None,
) -> list[dict[str, Any]]:
    preview = []
    seen_references: set[str] = set()

    for index, row in enumerate(rows, start=1):
        errors = _validate_row(row)
        patient_reference_id = _patient_reference_for_row(
            row,
            index,
            upload_id,
            patient_reference_mode,
            single_patient_reference_id,
        )
        if not patient_reference_id:
            errors.append("Missing patient_reference_id for selected reference mode.")
        elif patient_reference_id in seen_references and patient_reference_mode == "csv_column":
            errors.append("Duplicate patient_reference_id in uploaded file.")
        seen_references.add(patient_reference_id or "")

        existing = storage.search_patient_cases(patient_reference_id=patient_reference_id, user_id=user_id) if patient_reference_id else []
        exact_existing = next(
            (item for item in existing if item["patient_reference_id"].lower() == patient_reference_id.lower()),
            None,
        ) if patient_reference_id else None

        preview.append(
            {
                "row_number": index,
                "patient_reference_id": patient_reference_id,
                "status": "invalid" if errors else "valid",
                "errors": errors,
                "will_create_patient_case": bool(patient_reference_id and not exact_existing and not errors),
                "existing_patient_case_id": exact_existing.get("patient_case_id") if exact_existing else None,
            }
        )

    return preview


def _patient_reference_for_row(
    row: dict[str, Any],
    index: int,
    upload_id: str,
    patient_reference_mode: str,
    single_patient_reference_id: str | None,
) -> str | None:
    if patient_reference_mode == "auto_generate":
        return f"CASE-2026-{upload_id[:4].upper()}-{index:04d}"
    if patient_reference_mode == "single_case":
        return (single_patient_reference_id or "").strip() or None
    return str(row.get("patient_reference_id") or "").strip() or None


def _validate_row(row: dict[str, Any]) -> list[str]:
    errors = []
    missing = [feature for feature in PREDICTION_FEATURES if row.get(feature) in (None, "")]
    if missing:
        errors.append(f"Missing required fields: {', '.join(missing)}")
        return errors

    ranges = {
        "age": lambda value: float(value) > 0,
        "sex": lambda value: int(value) in (0, 1),
        "cp": lambda value: int(value) in (1, 2, 3, 4),
        "trestbps": lambda value: float(value) > 0,
        "chol": lambda value: float(value) > 0,
        "fbs": lambda value: int(value) in (0, 1),
        "restecg": lambda value: int(value) in (0, 1, 2),
        "thalach": lambda value: float(value) > 0,
        "exang": lambda value: int(value) in (0, 1),
        "oldpeak": lambda value: float(value) >= 0,
        "slope": lambda value: int(value) in (1, 2, 3),
        "ca": lambda value: int(value) in (0, 1, 2, 3),
        "thal": lambda value: int(value) in (3, 6, 7),
    }
    for feature, validator in ranges.items():
        try:
            if not validator(row[feature]):
                errors.append(f"Invalid value for {feature}.")
        except (TypeError, ValueError):
            errors.append(f"Invalid value for {feature}.")
    return errors


def _to_python(value: Any) -> Any:
    return value.item() if hasattr(value, "item") else value
