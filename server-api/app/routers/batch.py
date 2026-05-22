from io import BytesIO

import pandas as pd
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.models import ModelName, PREDICTION_FEATURES
from app.services import ml_client, storage


router = APIRouter(prefix="/api/predictions", tags=["batch predictions"])


@router.post("/batch")
async def create_batch_prediction(
    file: UploadFile = File(...),
    model_name: ModelName = Form(...),
    user_id: str | None = Form(None),
) -> dict:
    upload_id = await storage.create_upload(
        user_id=user_id,
        file_name=file.filename or "upload",
        file_type=file.content_type or "application/octet-stream",
        model_name=model_name,
    )

    try:
        batch_prediction = await ml_client.predict_batch(file, model_name)
        rows = await _read_rows(file)
    except Exception as error:
        await storage.update_upload(upload_id, 0, 0, 0, "failed")
        raise HTTPException(status_code=502, detail=f"server-ml batch request failed: {error}") from error

    results = []
    errors = []
    for result in batch_prediction.results:
        if result.status == "failed":
            await storage.save_batch_row(
                upload_id=upload_id,
                row_number=result.row_number,
                status="failed",
                error_message=result.error_message,
            )
            errors.append({"row_number": result.row_number, "error_message": result.error_message})
            continue

        request_id = None
        result_id = None
        if 0 < result.row_number <= len(rows):
            request_payload = {
                **rows[result.row_number - 1],
                "user_id": user_id,
                "model_name": model_name,
            }
            prediction_payload = {
                "model_name": model_name,
                "risk_score": result.risk_score,
                "predicted_class": result.predicted_class,
                "risk_level": result.risk_level,
                "explanation": result.explanation or [],
                "model_version": result.model_version or f"uci-heart-{model_name}",
            }
            request_id, result_id = await storage.save_prediction(
                request_payload,
                prediction_payload,
                entry_type="batch",
            )

        await storage.save_batch_row(
            upload_id=upload_id,
            row_number=result.row_number,
            status="success",
            request_id=request_id,
            result_id=result_id,
        )
        results.append(
            {
                "row_number": result.row_number,
                "request_id": request_id,
                "result_id": result_id,
                "risk_score": result.risk_score,
                "predicted_class": result.predicted_class,
                "risk_level": result.risk_level,
            }
        )

    await storage.update_upload(
        upload_id=upload_id,
        total_rows=batch_prediction.summary.total_rows,
        successful_rows=batch_prediction.summary.successful_rows,
        failed_rows=batch_prediction.summary.failed_rows,
        status="processed",
    )
    await storage.log_activity(user_id, "batch_prediction_uploaded", "uploaded_files", upload_id)

    return {
        "success": True,
        "upload_id": upload_id,
        "summary": batch_prediction.summary.model_dump(),
        "results": results,
        "errors": errors,
    }


async def _read_rows(file: UploadFile) -> list[dict]:
    await file.seek(0)
    content = await file.read()
    await file.seek(0)
    filename = (file.filename or "").lower()

    if filename.endswith(".csv"):
        df = pd.read_csv(BytesIO(content))
    else:
        df = pd.read_excel(BytesIO(content))

    if any(feature not in df.columns for feature in PREDICTION_FEATURES):
        return []

    rows: list[dict] = []
    for _, row in df.iterrows():
        clean_row = row[PREDICTION_FEATURES].where(row[PREDICTION_FEATURES].notnull(), None).to_dict()
        rows.append({key: _to_python(value) for key, value in clean_row.items()})
    return rows


def _to_python(value):
    return value.item() if hasattr(value, "item") else value
