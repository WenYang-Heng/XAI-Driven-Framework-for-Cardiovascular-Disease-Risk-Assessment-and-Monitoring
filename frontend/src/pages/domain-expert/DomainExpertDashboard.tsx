import { useEffect, useMemo, useState } from 'react';
import type { AssessmentModel, AssessmentModelSelection, AssessmentMode, BatchApiResponse, BatchApiRow, BatchPreviewResponse, DomainExpertUser, MainTab, ModelPerformance, PatientForm, PatientReferenceMode, PredictionApiResponse, PredictionResult, XaiTab } from './types';
import { API_BASE_URL, defaultForm, fallbackModelPerformance, modelProfiles, tabMeta } from './constants';
import { fallbackXai, formToPredictionPayload } from './utils';
import { Sidebar, TopHeader } from './components/Layout';
import { NewAssessment } from './components/NewAssessment';
import { AssessmentResult, BatchAssessmentResult } from './components/Results';
import { BatchXaiWorkspace, XaiWorkspace } from './components/Xai';
import { AssessmentHistory } from './components/History';
import { getValidationSummary } from './validation';

export function DomainExpertDashboard({
  currentUser,
  onLogout,
}: {
  currentUser?: DomainExpertUser;
  onLogout?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<MainTab>("new");
  const [activeXaiTab, setActiveXaiTab] = useState<XaiTab>("overview");
  const [assessmentMode, setAssessmentMode] = useState<AssessmentMode>("single");
  const [selectedBatchRow, setSelectedBatchRow] = useState<BatchApiRow | null>(null);
  const [form, setForm] = useState<PatientForm>(defaultForm);
  const [selectedModel, setSelectedModel] =
    useState<AssessmentModelSelection>("");
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [batchUploadId, setBatchUploadId] = useState<string | null>(null);
  const [batchPreview, setBatchPreview] = useState<BatchPreviewResponse | null>(null);
  const [patientReferenceMode, setPatientReferenceMode] = useState<PatientReferenceMode>("csv_column");
  const [singleBatchPatientReference, setSingleBatchPatientReference] = useState(defaultForm.patientId);
  const [batchResult, setBatchResult] = useState<BatchApiResponse | null>(null);
  const [predictionFeatureValues, setPredictionFeatureValues] = useState<Record<string, string> | null>(null);
  const [modelPerformance, setModelPerformance] = useState<ModelPerformance>(
    fallbackModelPerformance["Random Forest"],
  );
  const [isPerformanceLoading, setIsPerformanceLoading] = useState(false);
  const [isAssessmentLoading, setIsAssessmentLoading] = useState(false);
  const [performanceError, setPerformanceError] = useState<string | null>(null);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);

  const current = tabMeta[activeTab];
  const selectedModelKey = selectedModel ? modelProfiles[selectedModel].key : null;
  const selectedModelForDisplay: AssessmentModel = selectedModel || "Random Forest";
  const userId = currentUser?.id;

  useEffect(() => {
    const controller = new AbortController();

    async function loadModelPerformance() {
      if (!selectedModel || !selectedModelKey) {
        setModelPerformance(fallbackModelPerformance["Random Forest"]);
        setPerformanceError(null);
        setIsPerformanceLoading(false);
        return;
      }

      setIsPerformanceLoading(true);
      setPerformanceError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/models/${selectedModelKey}/metrics`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error("The API returned an error.");
        }

        const data = (await response.json()) as ModelPerformance;
        setModelPerformance(data);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setModelPerformance(fallbackModelPerformance[selectedModel]);
        setPerformanceError("Showing sample metrics until the API is running.");
      } finally {
        setIsPerformanceLoading(false);
      }
    }

    loadModelPerformance();

    return () => controller.abort();
  }, [selectedModel, selectedModelKey]);

  const patientSummary = useMemo(
    () => patientSummaryFromForm(form),
    [form],
  );

  const currentFeatureValues = useMemo(
    () => featureValuesFromInputFeatures(formToInputFeatures(form)),
    [form],
  );

  function updateField(field: keyof PatientForm, value: string) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  async function runSingleAssessment() {
    if (!selectedModel) {
      setAssessmentError("Select an assessment model before running the assessment.");
      return;
    }

    const validation = getValidationSummary(form, selectedModel, "single", null, false);
    if (validation.missingValues.length > 0 || validation.invalidValues.length > 0) {
      setAssessmentError("Complete all required fields and fix invalid values before running the assessment.");
      return;
    }

    setIsAssessmentLoading(true);
    setAssessmentError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/predictions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formToPredictionPayload(form, selectedModel, userId)),
      });

      if (!response.ok) {
        throw new Error("The prediction API returned an error.");
      }

      const data = (await response.json()) as PredictionApiResponse;
      setPrediction({
        ...data.prediction,
        patient_reference_id: data.patient_reference_id,
        patient_case_id: data.patient_case_id,
        result_id: data.result_id,
        request_id: data.request_id,
      } as PredictionResult);
      setPredictionFeatureValues(currentFeatureValues);
      setActiveTab("result");
    } catch (error) {
      setAssessmentError(
        error instanceof Error
          ? error.message
          : "Unable to run the assessment right now.",
      );
    } finally {
      setIsAssessmentLoading(false);
    }
  }

  async function runBatchAssessment() {
    if (!selectedModelKey) {
      setAssessmentError("Select an assessment model before running the batch assessment.");
      return;
    }

    if (!batchFile) {
      setAssessmentError("Select a CSV or spreadsheet file before running a batch assessment.");
      return;
    }

    setIsAssessmentLoading(true);
    setAssessmentError(null);

    try {
      if (!batchUploadId) {
        const formData = new FormData();
        formData.append("file", batchFile);
        formData.append("model_name", selectedModelKey);
        formData.append("patient_reference_mode", patientReferenceMode);
        if (userId) {
          formData.append("user_id", userId);
        }

        const uploadResponse = await fetch(`${API_BASE_URL}/api/batch/uploads`, {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error("The batch upload API returned an error.");
        }

        const uploadData = (await uploadResponse.json()) as { upload_id: string };
        setBatchUploadId(uploadData.upload_id);
        const previewResponse = await fetch(`${API_BASE_URL}/api/batch/uploads/${uploadData.upload_id}/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            upload_id: uploadData.upload_id,
            user_id: userId,
            model_name: selectedModelKey,
            patient_reference_mode: patientReferenceMode,
            single_patient_reference_id: singleBatchPatientReference,
          }),
        });

        if (!previewResponse.ok) {
          throw new Error("The batch preview API returned an error.");
        }

        const previewData = (await previewResponse.json()) as BatchPreviewResponse;
        setBatchPreview(previewData);
        return;
      }

      if (batchPreview?.summary.invalid_rows) {
        throw new Error("Fix invalid CSV rows before confirming batch processing.");
      }

      const response = await fetch(`${API_BASE_URL}/api/batch/uploads/${batchUploadId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          model_name: selectedModelKey,
          patient_reference_mode: patientReferenceMode,
          single_patient_reference_id: singleBatchPatientReference,
        }),
      });

      if (!response.ok) {
        throw new Error("The batch prediction API returned an error.");
      }

      const data = (await response.json()) as BatchApiResponse;
      setBatchResult(data);
      setBatchUploadId(null);
      setBatchPreview(null);
      setSelectedBatchRow(data.results.find((row) => row.status === "success") ?? data.results[0] ?? null);
      setActiveTab("result");
    } catch (error) {
      setAssessmentError(
        error instanceof Error
          ? error.message
          : "Unable to run the batch assessment right now.",
      );
    } finally {
      setIsAssessmentLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-950">
      <div className="flex min-h-screen">
        <Sidebar activeTab={activeTab} onChange={setActiveTab} />

        <section className="min-w-0 flex-1 px-5 py-5 lg:px-8">
          <TopHeader
            title={current.title}
            subtitle={current.subtitle}
            currentUser={currentUser}
            onLogout={onLogout}
          />

          <div className="mt-7">
            {activeTab === "new" ? (
              <NewAssessment
                form={form}
                selectedModel={selectedModel}
                assessmentMode={assessmentMode}
                onAssessmentModeChange={setAssessmentMode}
                onModelChange={setSelectedModel}
                updateField={updateField}
                batchFile={batchFile}
                batchPreview={batchPreview}
                patientReferenceMode={patientReferenceMode}
                singleBatchPatientReference={singleBatchPatientReference}
                isAssessmentLoading={isAssessmentLoading}
                assessmentError={assessmentError}
                onBatchFileSelected={(file) => {
                  setBatchFile(file);
                  setBatchUploadId(null);
                  setBatchPreview(null);
                  setBatchResult(null);
                }}
                onPatientReferenceModeChange={(mode) => {
                  setPatientReferenceMode(mode);
                  setBatchUploadId(null);
                  setBatchPreview(null);
                }}
                onSingleBatchPatientReferenceChange={setSingleBatchPatientReference}
                onRun={runSingleAssessment}
                onRunBatch={runBatchAssessment}
                onClear={() => {
                  setForm(defaultForm);
                  setSelectedModel("");
                  setPrediction(null);
                  setBatchResult(null);
                  setBatchFile(null);
                  setBatchUploadId(null);
                  setBatchPreview(null);
                  setPredictionFeatureValues(null);
                  setAssessmentError(null);
                }}
              />
            ) : null}
            {activeTab === "result" ? (
              assessmentMode === "batch" ? (
                <BatchAssessmentResult
                  selectedModel={selectedModelForDisplay}
                  batchResult={batchResult}
                  selectedRow={selectedBatchRow}
                  onSelectRow={setSelectedBatchRow}
                  onGoToBatchUpload={() => {
                    setAssessmentMode("batch");
                    setActiveTab("new");
                  }}
                  onViewXai={(row) => {
                    setSelectedBatchRow(row);
                    setActiveTab("xai");
                  }}
                />
              ) : (
                <AssessmentResult
                  patientSummary={patientSummary}
                  prediction={prediction}
                  selectedModel={selectedModelForDisplay}
                  modelPerformance={modelPerformance}
                  isPerformanceLoading={isPerformanceLoading}
                  performanceError={performanceError}
                  currentUser={currentUser}
                  onGoToNewAssessment={() => {
                    setAssessmentMode("single");
                    setActiveTab("new");
                  }}
                  onViewXai={() => setActiveTab("xai")}
                />
              )
            ) : null}
            {activeTab === "xai" ? (
              assessmentMode === "batch" ? (
                <BatchXaiWorkspace
                  selectedModel={selectedModelForDisplay}
                  selectedRow={selectedBatchRow}
                  batchResult={batchResult}
                  onGoToBatchUpload={() => {
                    setAssessmentMode("batch");
                    setActiveTab("new");
                  }}
                />
              ) : (
                <XaiWorkspace
                  activeXaiTab={activeXaiTab}
                  setActiveXaiTab={setActiveXaiTab}
                  prediction={prediction}
                  selectedModel={selectedModelForDisplay}
                  patientFeatureValues={predictionFeatureValues}
                  onBackToResult={() => setActiveTab("result")}
                  onGoToNewAssessment={() => {
                    setAssessmentMode("single");
                    setActiveTab("new");
                  }}
                />
              )
            ) : null}
            {activeTab === "history" ? (
              <AssessmentHistory
                userId={userId}
                onViewReport={(item) => {
                  setPrediction({
                    request_id: item.request_id,
                    result_id: item.result_id,
                    patient_case_id: item.patient_case_id,
                    patient_reference_id: item.patient_reference_id,
                    model_name: item.model_name,
                    risk_score: item.risk_score,
                    predicted_class: item.predicted_class === 1 ? 1 : 0,
                    risk_level: item.risk_level as PredictionResult["risk_level"],
                    explanation: item.explanation ?? [],
                    xai: item.xai ?? fallbackXai(item.risk_score, item.explanation ?? []),
                    model_version: item.model_version ?? item.model_name,
                    created_at: item.created_at,
                  });
                  const savedFeatures = item.input_features ?? null;
                  setPredictionFeatureValues(savedFeatures ? featureValuesFromInputFeatures(savedFeatures) : null);
                  if (savedFeatures) {
                    setForm(formFromInputFeatures(savedFeatures, item.patient_reference_id ?? ""));
                  } else {
                    setForm({ ...defaultForm, patientId: item.patient_reference_id ?? "" });
                  }
                  setSelectedModel(modelSelectionFromKey(item.model_name));
                  setAssessmentMode("single");
                  setActiveTab("result");
                }}
              />
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function formToInputFeatures(form: PatientForm): Record<string, string> {
  return {
    age: form.age,
    sex: form.sex,
    cp: form.chestPain,
    trestbps: form.restingBp,
    chol: form.cholesterol,
    fbs: form.fastingBloodSugar,
    restecg: form.restingEcg,
    thalach: form.maxHeartRate,
    exang: form.exerciseAngina,
    oldpeak: form.oldpeak,
    slope: form.slope,
    ca: form.vessels,
    thal: form.thalassemia,
  };
}

function formFromInputFeatures(features: Record<string, number | string | null>, patientReferenceId: string): PatientForm {
  return {
    patientId: patientReferenceId,
    age: valueString(features.age),
    sex: valueString(features.sex),
    chestPain: valueString(features.cp),
    restingBp: valueString(features.trestbps),
    cholesterol: valueString(features.chol),
    fastingBloodSugar: valueString(features.fbs),
    restingEcg: valueString(features.restecg),
    maxHeartRate: valueString(features.thalach),
    exerciseAngina: valueString(features.exang),
    oldpeak: valueString(features.oldpeak),
    slope: valueString(features.slope),
    vessels: valueString(features.ca),
    thalassemia: valueString(features.thal),
  };
}

function patientSummaryFromForm(form: PatientForm): string[][] {
  return patientSummaryFromInputFeatures(formToInputFeatures(form), form.patientId);
}

function patientSummaryFromInputFeatures(features: Record<string, number | string | null>, patientReferenceId?: string | null): string[][] {
  const values = featureValuesFromInputFeatures(features);
  return [
    ["Patient Reference ID", patientReferenceId || "Auto-generated"],
    ["Age", values.age],
    ["Sex", values.sex],
    ["Chest Pain Type", values.cp],
    ["Resting BP", values.trestbps],
    ["Cholesterol", values.chol],
    ["Fasting Blood Sugar > 120 mg/dL", values.fbs],
    ["Resting ECG Result", values.restecg],
    ["Max Heart Rate", values.thalach],
    ["Exercise-Induced Angina", values.exang],
    ["Oldpeak", values.oldpeak],
    ["Slope of Peak Exercise ST Segment", values.slope],
    ["Number of Major Vessels Coloured by Fluoroscopy", values.ca],
    ["Thalassemia", values.thal],
  ];
}

function featureValuesFromInputFeatures(features: Record<string, number | string | null>): Record<string, string> {
  return {
    age: valueString(features.age),
    sex: categoricalLabel(features.sex, { "0": "Female", "1": "Male" }),
    cp: categoricalLabel(features.cp, {
      "1": "Typical angina",
      "2": "Atypical angina",
      "3": "Non-anginal pain",
      "4": "Asymptomatic",
    }),
    trestbps: withUnit(features.trestbps, "mmHg"),
    chol: withUnit(features.chol, "mg/dL"),
    fbs: categoricalLabel(features.fbs, { "0": "No", "1": "Yes" }),
    restecg: categoricalLabel(features.restecg, {
      "0": "Normal",
      "1": "ST-T wave abnormality",
      "2": "Left ventricular hypertrophy",
    }),
    thalach: valueString(features.thalach),
    exang: categoricalLabel(features.exang, { "0": "No", "1": "Yes" }),
    oldpeak: valueString(features.oldpeak),
    slope: categoricalLabel(features.slope, { "1": "Upsloping", "2": "Flat", "3": "Downsloping" }),
    ca: valueString(features.ca),
    thal: categoricalLabel(features.thal, { "3": "Normal", "6": "Fixed defect", "7": "Reversible defect" }),
  };
}

function categoricalLabel(value: number | string | null | undefined, labels: Record<string, string>) {
  const key = valueString(value);
  return labels[key] ?? (key || "Unavailable");
}

function withUnit(value: number | string | null | undefined, unit: string) {
  const text = valueString(value);
  return text ? `${text} ${unit}` : "Unavailable";
}

function valueString(value: number | string | null | undefined) {
  return value === null || value === undefined || value === "" ? "" : String(value);
}

function modelSelectionFromKey(modelName: string): AssessmentModel {
  const match = (Object.entries(modelProfiles) as Array<[AssessmentModel, { key: string }]>)
    .find(([, profile]) => profile.key === modelName);
  return match?.[0] ?? "Random Forest";
}
