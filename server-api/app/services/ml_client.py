import os
from typing import Any

import httpx
from fastapi import UploadFile

from app.models import BatchPredictionResponse, ModelMetricsListResponse, ModelMetricsResponse, PredictionResponse


SERVER_ML_BASE_URL = os.getenv("SERVER_ML_BASE_URL", "http://localhost:8001").rstrip("/")


async def list_models() -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(f"{SERVER_ML_BASE_URL}/models")
        response.raise_for_status()
        data = response.json()
        return data.get("models", [])


async def get_model_metrics(model_name: str) -> ModelMetricsResponse:
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.get(f"{SERVER_ML_BASE_URL}/models/{model_name}/metrics")
        response.raise_for_status()
        return ModelMetricsResponse(**response.json())


async def get_all_model_metrics() -> ModelMetricsListResponse:
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.get(f"{SERVER_ML_BASE_URL}/models/metrics")
        response.raise_for_status()
        return ModelMetricsListResponse(**response.json())


async def predict(payload: dict[str, Any]) -> PredictionResponse:
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(f"{SERVER_ML_BASE_URL}/predict", json=payload)
        response.raise_for_status()
        return PredictionResponse(**response.json())


async def predict_batch(file: UploadFile, model_name: str) -> BatchPredictionResponse:
    content = await file.read()
    await file.seek(0)
    files = {"file": (file.filename or "upload.csv", content, file.content_type or "application/octet-stream")}
    data = {"model_name": model_name}

    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(f"{SERVER_ML_BASE_URL}/predict/batch", data=data, files=files)
        response.raise_for_status()
        return BatchPredictionResponse(**response.json())


async def predict_batch_bytes(
    content: bytes,
    file_name: str,
    content_type: str,
    model_name: str,
) -> BatchPredictionResponse:
    files = {"file": (file_name or "upload.csv", content, content_type or "application/octet-stream")}
    data = {"model_name": model_name}

    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(f"{SERVER_ML_BASE_URL}/predict/batch", data=data, files=files)
        response.raise_for_status()
        return BatchPredictionResponse(**response.json())


async def predict_scores(features: dict[str, Any]) -> list[dict[str, Any]]:
    """Risk score from every model (no XAI), used for the model-agreement signal."""
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(f"{SERVER_ML_BASE_URL}/predict/scores", json=features)
        response.raise_for_status()
        return response.json().get("scores", [])
