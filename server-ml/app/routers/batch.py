from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.schemas import BatchPredictionResponse, ModelName
from app.services.batch_prediction import predict_batch
from app.utils.file_parser import parse_uploaded_file


router = APIRouter(tags=["batch prediction"])


@router.post("/predict/batch", response_model=BatchPredictionResponse)
async def batch_predict(
    file: UploadFile = File(...),
    model_name: ModelName = Form(...),
) -> BatchPredictionResponse:
    try:
        df = await parse_uploaded_file(file)
        return predict_batch(df, model_name)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
