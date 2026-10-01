import { API_BASE_URL } from "./constants";
import type {
  AssessmentDetail,
  AssessmentRunResponse,
  GlobalShapExplanation,
  HistoryKey,
  MeasurementInput,
  ModelKey,
  ModelPerformance,
  ModelSummary,
  Patient,
  PatientDetail,
  PatientListItem,
  Prefill,
  Review,
  ReviewInput,
  Worklist,
} from "./types";

export class ApiError extends Error {
  details: string[];

  constructor(message: string, details: string[] = []) {
    super(message);
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError("Cannot reach the API. Check that server-api is running.");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body?.detail;
    // FastAPI validation errors are objects with `msg`; our own 422s are string lists.
    const details: string[] = Array.isArray(detail)
      ? detail.map((item: unknown) => (typeof item === "string" ? item : (item as { msg?: string })?.msg ?? String(item)))
      : typeof detail === "string"
        ? [detail]
        : [];
    throw new ApiError(details[0] ?? `Request failed (${response.status}).`, details);
  }

  return response.json() as Promise<T>;
}

const query = (params: Record<string, string | undefined>) =>
  new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1]))).toString();

export const clinicianApi = {
  worklist: (clinicianId: string) =>
    request<Worklist & { success: boolean }>(`/api/clinician/worklist?${query({ clinician_id: clinicianId })}`),

  listPatients: (clinicianId: string, q?: string) =>
    request<{ items: PatientListItem[] }>(`/api/clinician/patients?${query({ clinician_id: clinicianId, q })}`).then(
      (body) => body.items,
    ),

  createPatient: (
    clinicianId: string,
    payload: {
      patient_reference_id?: string;
      display_name?: string;
      date_of_birth?: string;
      history_source: "clinician" | "self_reported";
    } & Partial<Record<HistoryKey, number>>,
  ) =>
    request<{ patient: Patient }>("/api/clinician/patients", {
      method: "POST",
      body: JSON.stringify({ clinician_id: clinicianId, ...payload }),
    }).then((body) => body.patient),

  patient: (clinicianId: string, patientCaseId: string) =>
    request<PatientDetail>(`/api/clinician/patients/${patientCaseId}?${query({ clinician_id: clinicianId })}`),

  prefill: (clinicianId: string, patientCaseId: string) =>
    request<Prefill>(`/api/clinician/patients/${patientCaseId}/prefill?${query({ clinician_id: clinicianId })}`),

  runAssessment: (
    clinicianId: string,
    patientCaseId: string,
    payload: {
      measurement?: MeasurementInput;
      history?: Partial<Record<HistoryKey, number>>;
      visit_label?: string;
      model_name?: ModelKey;
    },
  ) =>
    request<AssessmentRunResponse>(`/api/clinician/patients/${patientCaseId}/assessments`, {
      method: "POST",
      body: JSON.stringify({ clinician_id: clinicianId, ...payload }),
    }),

  assessment: (clinicianId: string, resultId: string) =>
    request<{ assessment: AssessmentDetail }>(
      `/api/clinician/assessments/${resultId}?${query({ clinician_id: clinicianId })}`,
    ).then((body) => body.assessment),

  review: (clinicianId: string, resultId: string, payload: ReviewInput) =>
    request<{ review: Review }>(`/api/clinician/assessments/${resultId}/review`, {
      method: "PUT",
      body: JSON.stringify({ clinician_id: clinicianId, ...payload }),
    }).then((body) => body.review),
};

export const modelApi = {
  list: () => request<{ items: ModelSummary[]; default_model: ModelKey }>("/api/admin/models"),
  metrics: (modelName: ModelKey) => request<ModelPerformance>(`/api/models/${modelName}/metrics`),
  globalShap: (modelName: ModelKey) => request<GlobalShapExplanation>(`/api/models/${modelName}/global-shap`),
};
