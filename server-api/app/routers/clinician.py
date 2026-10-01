from collections.abc import Awaitable, Callable
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query

from app.models import AssessmentCreate, ClinicalReviewRequest, MeasurementCreate, PatientProfileCreate, PatientProfileUpdate
from app.services import clinical


router = APIRouter(prefix="/api/clinician", tags=["clinician"])


async def _handle(action: Callable[[], Awaitable[Any] | Any]) -> Any:
    try:
        result = action()
        if isinstance(result, Awaitable):
            result = await result
        return result
    except clinical.NotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except clinical.ConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except clinical.ValidationFailedError as error:
        raise HTTPException(status_code=422, detail=error.errors) from error
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail=f"server-ml request failed: {error}") from error


@router.get("/worklist")
async def get_worklist(clinician_id: str = Query(...)) -> dict:
    return {"success": True, **await _handle(lambda: clinical.worklist(clinician_id))}


@router.get("/patients")
async def list_patients(clinician_id: str = Query(...), q: str | None = Query(None, max_length=100)) -> dict:
    return {"success": True, "items": await _handle(lambda: clinical.list_patients(clinician_id, q))}


@router.post("/patients", status_code=201)
async def create_patient(request: PatientProfileCreate) -> dict:
    patient = await _handle(lambda: clinical.create_patient(request.model_dump(mode="json")))
    return {"success": True, "patient": patient}


@router.get("/patients/{patient_case_id}")
async def get_patient(patient_case_id: str, clinician_id: str = Query(...)) -> dict:
    def load() -> dict:
        return {
            "patient": clinical.get_patient(patient_case_id, clinician_id),
            "measurements": clinical.list_measurements(patient_case_id),
            "assessments": clinical.patient_timeline(patient_case_id, clinician_id),
        }

    return {"success": True, **await _handle(load)}


@router.patch("/patients/{patient_case_id}")
async def update_patient(patient_case_id: str, request: PatientProfileUpdate) -> dict:
    patient = await _handle(lambda: clinical.update_patient(patient_case_id, request.model_dump(mode="json")))
    return {"success": True, "patient": patient}


@router.post("/patients/{patient_case_id}/measurements", status_code=201)
async def add_measurement(patient_case_id: str, request: MeasurementCreate, clinician_id: str = Query(...)) -> dict:
    async def save() -> dict | None:
        clinical.get_patient(patient_case_id, clinician_id)
        payload = request.model_dump(mode="json")
        payload["recorded_by"] = payload.get("recorded_by") or clinician_id
        return await clinical.add_measurement(patient_case_id, payload)

    measurement = await _handle(save)
    if measurement is None:
        raise HTTPException(status_code=422, detail=["Enter at least one reading."])
    return {"success": True, "measurement": measurement}


@router.get("/patients/{patient_case_id}/prefill")
async def get_prefill(patient_case_id: str, clinician_id: str = Query(...)) -> dict:
    return {"success": True, **await _handle(lambda: clinical.prefill(patient_case_id, clinician_id))}


@router.post("/patients/{patient_case_id}/assessments", status_code=201)
async def create_assessment(patient_case_id: str, request: AssessmentCreate) -> dict:
    payload = request.model_dump(mode="json", exclude_none=True)
    return {"success": True, **await _handle(lambda: clinical.run_assessment(patient_case_id, payload))}


@router.get("/assessments/{result_id}")
async def get_assessment(result_id: str, clinician_id: str = Query(...)) -> dict:
    return {"success": True, "assessment": await _handle(lambda: clinical.get_assessment(result_id, clinician_id))}


@router.put("/assessments/{result_id}/review")
async def review_assessment(result_id: str, request: ClinicalReviewRequest) -> dict:
    review = await _handle(lambda: clinical.review_assessment(result_id, request.model_dump(mode="json")))
    return {"success": True, "review": review}
