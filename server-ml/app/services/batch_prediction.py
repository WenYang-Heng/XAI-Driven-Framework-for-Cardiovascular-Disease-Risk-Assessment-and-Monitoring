from typing import Any

from pydantic import ValidationError

from app.schemas import (
    BatchPredictionResponse,
    BatchPredictionRowResult,
    BatchPredictionSummary,
    ModelName,
    RiskPredictionRequest,
)
from app.services.dataset import FEATURE_COLUMNS
from app.services.risk_model import predict_risk


REQUIRED_COLUMNS = FEATURE_COLUMNS


def predict_batch(df: Any, model_name: ModelName) -> BatchPredictionResponse:
    results: list[BatchPredictionRowResult] = []

    missing_columns = [column for column in REQUIRED_COLUMNS if column not in df.columns]
    if missing_columns:
        missing = ", ".join(missing_columns)
        return BatchPredictionResponse(
            model_name=model_name,
            summary=BatchPredictionSummary(
                total_rows=len(df),
                successful_rows=0,
                failed_rows=len(df),
            ),
            results=[
                BatchPredictionRowResult(
                    row_number=0,
                    status="failed",
                    error_message=f"Missing required columns: {missing}",
                )
            ],
        )

    for index, row in df.iterrows():
        row_number = int(index) + 1
        row_dict = row[REQUIRED_COLUMNS].where(row[REQUIRED_COLUMNS].notnull(), None).to_dict()
        row_dict["model_name"] = model_name

        try:
            request = RiskPredictionRequest(**row_dict)
            prediction = predict_risk(request)

            results.append(
                BatchPredictionRowResult(
                    row_number=row_number,
                    risk_score=prediction.risk_score,
                    predicted_class=prediction.predicted_class,
                    risk_level=prediction.risk_level,
                    explanation=prediction.explanation,
                    model_version=prediction.model_version,
                    status="success",
                )
            )
        except ValidationError as validation_error:
            results.append(
                BatchPredictionRowResult(
                    row_number=row_number,
                    status="failed",
                    error_message=str(validation_error),
                )
            )
        except Exception as error:
            results.append(
                BatchPredictionRowResult(
                    row_number=row_number,
                    status="failed",
                    error_message=str(error),
                )
            )

    successful_rows = sum(1 for result in results if result.status == "success")
    failed_rows = sum(1 for result in results if result.status == "failed")

    return BatchPredictionResponse(
        model_name=model_name,
        summary=BatchPredictionSummary(
            total_rows=len(df),
            successful_rows=successful_rows,
            failed_rows=failed_rows,
        ),
        results=results,
    )
