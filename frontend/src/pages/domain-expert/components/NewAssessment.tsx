import { AlertCircle, Brain, CheckCircle2, ClipboardList, Download, FileSpreadsheet, Gauge, RotateCcw, Upload } from 'lucide-react';
import type { AssessmentMode, AssessmentModelSelection, BatchPreviewResponse, PatientForm, PatientReferenceMode } from '../types';
import { assessmentModelOptions, batchTemplateCsv, csvFeatureGuide, modelProfiles } from '../constants';
import { SelectField, TextField } from './Shared';
import { getValidationSummary, type FieldValidationState } from '../validation';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardHeader } from '../../../components/ui/Card';

export function NewAssessment({
  form,
  selectedModel,
  isAssessmentLoading,
  assessmentError,
  assessmentMode,
  batchFile,
  batchPreview,
  patientReferenceMode,
  singleBatchPatientReference,
  onAssessmentModeChange,
  onModelChange,
  updateField,
  onBatchFileSelected,
  onPatientReferenceModeChange,
  onSingleBatchPatientReferenceChange,
  onRun,
  onRunBatch,
  onClear,
}: {
  form: PatientForm;
  selectedModel: AssessmentModelSelection;
  isAssessmentLoading: boolean;
  assessmentError: string | null;
  assessmentMode: AssessmentMode;
  batchFile: File | null;
  batchPreview: BatchPreviewResponse | null;
  patientReferenceMode: PatientReferenceMode;
  singleBatchPatientReference: string;
  onAssessmentModeChange: (mode: AssessmentMode) => void;
  onModelChange: (model: AssessmentModelSelection) => void;
  updateField: (field: keyof PatientForm, value: string) => void;
  onBatchFileSelected: (file: File | null) => void;
  onPatientReferenceModeChange: (mode: PatientReferenceMode) => void;
  onSingleBatchPatientReferenceChange: (value: string) => void;
  onRun: () => void;
  onRunBatch: () => void;
  onClear: () => void;
}) {
  const validation = getValidationSummary(form, selectedModel, assessmentMode, batchFile, Boolean(batchPreview));
  const selectedModelStatus = selectedModel ? modelProfiles[selectedModel].status : "Waiting for selection";
  const handleSubmit = assessmentMode === "single"
    ? () => {
      if (validation.trainingRangeWarnings.length > 0) {
        const shouldContinue = window.confirm(
          "Some values are outside the model's training range. The assessment can continue, but prediction reliability may be reduced.",
        );
        if (!shouldContinue) {
          return;
        }
      }
      onRun();
    }
    : onRunBatch;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <Card className="p-6">
        <CardHeader
          title="New Assessment Setup"
          subtitle="Choose a single patient assessment or upload a CSV file using the model feature schema."
        />

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <AssessmentModeCard
            active={assessmentMode === "single"}
            icon={ClipboardList}
            title="Single Patient Data Entry"
            description="Enter one patient's clinical features and run an individual risk assessment."
            onClick={() => onAssessmentModeChange("single")}
          />
          <AssessmentModeCard
            active={assessmentMode === "batch"}
            icon={FileSpreadsheet}
            title="Batch CSV Assessment"
            description="Upload a CSV file with the required model features for row-by-row assessment."
            onClick={() => onAssessmentModeChange("batch")}
          />
        </section>

        <section className="mt-6 rounded-[22px] border border-cyan-100 bg-gradient-to-br from-cyan-50/80 via-white to-white p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-xl">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
                  <Brain className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-cyan-700">
                    Controlled Research Configuration
                  </p>
                  <h3 className="mt-1 text-base font-bold text-slate-950">
                    Model Configuration
                  </h3>
                </div>
              </div>

              <div className="mt-5 max-w-sm">
                <SelectField
                  label="Assessment Model"
                  value={selectedModel}
                  onChange={(value) => onModelChange(value as AssessmentModelSelection)}
                  options={assessmentModelOptions.map((model) => [model, model])}
                  placeholder="Select assessment model"
                />
              </div>
            </div>
          </div>

          <p className="mt-5 rounded-2xl border border-cyan-100 bg-white/70 px-4 py-3 text-sm leading-6 text-cyan-800">
            The selected model will be used to generate the risk score, risk
            category, and XAI explanations for this assessment.
          </p>
        </section>

        {assessmentMode === "single" ? (
          <SinglePatientEntry
            form={form}
            fieldStates={validation.fieldStates}
            updateField={updateField}
          />
        ) : (
          <BatchAssessmentEntry
            fileName={batchFile?.name ?? null}
            preview={batchPreview}
            patientReferenceMode={patientReferenceMode}
            singleBatchPatientReference={singleBatchPatientReference}
            onFileSelected={onBatchFileSelected}
            onPatientReferenceModeChange={onPatientReferenceModeChange}
            onSingleBatchPatientReferenceChange={onSingleBatchPatientReferenceChange}
          />
        )}

        {assessmentError ? (
          <p className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {assessmentError}
          </p>
        ) : null}

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
          <p className="max-w-xl text-sm text-slate-500">
            This system provides risk assessment support and does not provide
            medical diagnosis.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={onClear}>
              <RotateCcw className="h-4 w-4" />
              Clear Form
            </Button>
            <Button
              disabled={isAssessmentLoading || !validation.canRun}
              onClick={handleSubmit}
            >
              {assessmentMode === "single" ? (
                <Gauge className="h-4 w-4" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {isAssessmentLoading
                ? "Running..."
                : assessmentMode === "single"
                  ? "Run Assessment"
                  : batchPreview
                    ? "Confirm and Process Batch"
                    : "Validate and Preview CSV"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="h-fit p-6">
        <CardHeader title="Input Validation Summary" />
        <div className="mt-5 space-y-3">
          {[
            {
              label: assessmentMode === "single"
                ? `Required features: ${validation.completedRequired} / ${validation.requiredTotal}`
                : "Required features: validated from uploaded CSV",
              valid: assessmentMode === "single" ? validation.missingValues.length === 0 : Boolean(batchPreview),
            },
            {
              label: assessmentMode === "single"
                ? `Missing values: ${validation.missingValues.length}`
                : `Selected file: ${batchFile?.name ?? "None"}`,
              valid: assessmentMode === "single" ? validation.missingValues.length === 0 : Boolean(batchFile),
            },
            {
              label: assessmentMode === "single"
                ? `Invalid values: ${validation.invalidValues.length}`
                : "Accepted formats: CSV",
              valid: validation.invalidValues.length === 0,
            },
            {
              label: assessmentMode === "single"
                ? `Out-of-training-range warnings: ${validation.trainingRangeWarnings.length}`
                : "Out-of-training-range warnings: handled after CSV validation",
              valid: validation.trainingRangeWarnings.length === 0,
            },
            {
              label: `Selected model: ${selectedModel || "Not selected"}`,
              valid: Boolean(selectedModel),
            },
            {
              label: `Model status: ${selectedModelStatus}`,
              valid: Boolean(selectedModel),
            },
            {
              label: `Assessment readiness: ${validation.readinessStatus}`,
              valid: validation.readinessStatus === "Ready for assessment" || validation.readinessStatus === "Ready with warnings",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"
            >
              {item.valid ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
              ) : (
                <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
              )}
              {item.label}
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-[20px] border border-cyan-100 bg-cyan-50 p-4 text-sm leading-6 text-cyan-800">
          Inputs follow the UCI Heart Disease feature schema. Clinical plausibility ranges are used to block unrealistic values.
          Training ranges are based on the cleaned UCI dataset and are used to warn when inputs fall outside the model's training distribution.
        </div>
      </Card>
    </div>
  );
}

export function AssessmentModeCard({
  active,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: typeof ClipboardList;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[22px] border p-5 text-left transition focus:outline-none focus:ring-4 focus:ring-cyan-100 ${
        active
          ? "border-cyan-300 bg-cyan-50 text-cyan-950 shadow-sm"
          : "border-slate-200 bg-white text-slate-700 hover:border-cyan-200 hover:bg-cyan-50/60"
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
            active ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-500"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {description}
          </p>
        </div>
      </div>
    </button>
  );
}

export function SinglePatientEntry({
  form,
  fieldStates,
  updateField,
}: {
  form: PatientForm;
  fieldStates: Partial<Record<keyof PatientForm, FieldValidationState>>;
  updateField: (field: keyof PatientForm, value: string) => void;
}) {
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <TextField
        label="Patient Reference ID"
        value={form.patientId}
        onChange={(value) => updateField("patientId", value)}
        placeholder="Leave blank for new patient"
      />
      <TextField
        label="Age"
        type="number"
        value={form.age}
        onChange={(value) => updateField("age", value)}
        validationMessage={fieldStates.age?.message}
        validationTone={fieldStates.age?.tone}
      />
      <SelectField
        label="Sex"
        value={form.sex}
        onChange={(value) => updateField("sex", value)}
        options={[
          ["0", "Female"],
          ["1", "Male"],
        ]}
        validationMessage={fieldStates.sex?.message}
        validationTone={fieldStates.sex?.tone}
      />
      <SelectField
        label="Chest Pain Type"
        value={form.chestPain}
        onChange={(value) => updateField("chestPain", value)}
        options={[
          ["1", "Typical angina"],
          ["2", "Atypical angina"],
          ["3", "Non-anginal pain"],
          ["4", "Asymptomatic"],
        ]}
        validationMessage={fieldStates.chestPain?.message}
        validationTone={fieldStates.chestPain?.tone}
      />
      <TextField
        label="Resting Blood Pressure"
        unit="mmHg"
        type="number"
        value={form.restingBp}
        onChange={(value) => updateField("restingBp", value)}
        validationMessage={fieldStates.restingBp?.message}
        validationTone={fieldStates.restingBp?.tone}
      />
      <TextField
        label="Serum Cholesterol"
        unit="mg/dL"
        type="number"
        value={form.cholesterol}
        onChange={(value) => updateField("cholesterol", value)}
        validationMessage={fieldStates.cholesterol?.message}
        validationTone={fieldStates.cholesterol?.tone}
      />
      <SelectField
        label="Fasting Blood Sugar > 120 mg/dL"
        value={form.fastingBloodSugar}
        onChange={(value) => updateField("fastingBloodSugar", value)}
        options={[
          ["0", "No"],
          ["1", "Yes"],
        ]}
        validationMessage={fieldStates.fastingBloodSugar?.message}
        validationTone={fieldStates.fastingBloodSugar?.tone}
      />
      <SelectField
        label="Resting ECG Result"
        value={form.restingEcg}
        onChange={(value) => updateField("restingEcg", value)}
        options={[
          ["0", "Normal"],
          ["1", "ST-T wave abnormality"],
          ["2", "Left ventricular hypertrophy"],
        ]}
        validationMessage={fieldStates.restingEcg?.message}
        validationTone={fieldStates.restingEcg?.tone}
      />
      <TextField
        label="Maximum Heart Rate Achieved"
        type="number"
        value={form.maxHeartRate}
        onChange={(value) => updateField("maxHeartRate", value)}
        validationMessage={fieldStates.maxHeartRate?.message}
        validationTone={fieldStates.maxHeartRate?.tone}
      />
      <SelectField
        label="Exercise-Induced Angina"
        value={form.exerciseAngina}
        onChange={(value) => updateField("exerciseAngina", value)}
        options={[
          ["0", "No"],
          ["1", "Yes"],
        ]}
        validationMessage={fieldStates.exerciseAngina?.message}
        validationTone={fieldStates.exerciseAngina?.tone}
      />
      <TextField
        label="ST Depression / Oldpeak"
        type="number"
        step="0.1"
        value={form.oldpeak}
        onChange={(value) => updateField("oldpeak", value)}
        validationMessage={fieldStates.oldpeak?.message}
        validationTone={fieldStates.oldpeak?.tone}
      />
      <SelectField
        label="Slope of Peak Exercise ST Segment"
        value={form.slope}
        onChange={(value) => updateField("slope", value)}
        options={[
          ["1", "Upsloping"],
          ["2", "Flat"],
          ["3", "Downsloping"],
        ]}
        validationMessage={fieldStates.slope?.message}
        validationTone={fieldStates.slope?.tone}
      />
      <SelectField
        label="Number of Major Vessels Coloured by Fluoroscopy"
        value={form.vessels}
        onChange={(value) => updateField("vessels", value)}
        options={[
          ["0", "0"],
          ["1", "1"],
          ["2", "2"],
          ["3", "3"],
        ]}
        validationMessage={fieldStates.vessels?.message}
        validationTone={fieldStates.vessels?.tone}
      />
      <SelectField
        label="Thalassemia Result"
        value={form.thalassemia}
        onChange={(value) => updateField("thalassemia", value)}
        options={[
          ["3", "Normal"],
          ["6", "Fixed defect"],
          ["7", "Reversible defect"],
        ]}
        validationMessage={fieldStates.thalassemia?.message}
        validationTone={fieldStates.thalassemia?.tone}
      />
    </div>
  );
}

export function BatchAssessmentEntry({
  fileName,
  preview,
  patientReferenceMode,
  singleBatchPatientReference,
  onFileSelected,
  onPatientReferenceModeChange,
  onSingleBatchPatientReferenceChange,
}: {
  fileName: string | null;
  preview: BatchPreviewResponse | null;
  patientReferenceMode: PatientReferenceMode;
  singleBatchPatientReference: string;
  onFileSelected: (file: File | null) => void;
  onPatientReferenceModeChange: (mode: PatientReferenceMode) => void;
  onSingleBatchPatientReferenceChange: (value: string) => void;
}) {
  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(
    batchTemplateCsv,
  )}`;

  return (
    <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(320px,0.82fr)_minmax(520px,1.18fr)]">
      <div className="rounded-[22px] border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-950">
              Upload Batch CSV
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Upload a CSV where each row contains the required model features.
              Results will be generated row by row for the selected model.
            </p>
          </div>
          <a
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50 focus:outline-none focus:ring-4 focus:ring-cyan-100"
            href={templateHref}
            download="cardioxai_batch_prediction_template.csv"
          >
            <Download className="h-4 w-4" />
            Download Template
          </a>
        </div>

        <label className="mt-6 flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-[22px] border-2 border-dashed border-cyan-200 bg-cyan-50/50 px-5 py-7 text-center transition hover:border-cyan-300 hover:bg-cyan-50">
          <Upload className="h-9 w-9 text-cyan-600" />
          <span className="mt-4 text-sm font-bold text-slate-950">
            {fileName ?? "Choose a CSV file"}
          </span>
          <span className="mt-2 max-w-md text-sm leading-6 text-slate-500">
            The CSV header must match the feature names exactly.
          </span>
          <input
            className="sr-only"
            type="file"
            accept=".csv,.xlsx,.xls,text/csv"
            onChange={(event) =>
              onFileSelected(event.target.files?.[0] ?? null)
            }
          />
        </label>

        <div className="mt-6 rounded-[22px] border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-sm font-bold text-slate-950">Patient Reference Mode</h3>
          <div className="mt-4 grid gap-3">
            {[
              ["csv_column", "Use patient_reference_id column from CSV"],
              ["auto_generate", "Auto-generate patient reference IDs"],
              ["single_case", "Apply one patient reference to all rows"],
            ].map(([value, label]) => (
              <label key={value} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
                <input
                  type="radio"
                  checked={patientReferenceMode === value}
                  onChange={() => onPatientReferenceModeChange(value as PatientReferenceMode)}
                />
                {label}
              </label>
            ))}
          </div>
          {patientReferenceMode === "single_case" ? (
            <div className="mt-4">
              <TextField
                label="Single Patient Reference ID"
                value={singleBatchPatientReference}
                onChange={onSingleBatchPatientReferenceChange}
              />
            </div>
          ) : null}
        </div>

        <div className="mt-6 rounded-[22px] border border-cyan-100 bg-cyan-50 p-5">
          <h3 className="text-sm font-bold text-cyan-950">
            How to prepare your CSV
          </h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              "Download the template.",
              "Keep the header names unchanged.",
              "Fill one patient per row.",
              "Upload the completed CSV and run batch assessment.",
            ].map((step, index) => (
              <div
                key={step}
                className="flex gap-3 rounded-2xl bg-white/80 px-4 py-3 text-sm leading-6 text-cyan-900"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-xs font-bold text-white">
                  {index + 1}
                </span>
                <span>{step}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-cyan-800">
            Template values are encoded for the model. Keep the column names as
            shown and use the accepted values in the guide.
          </p>
        </div>
      </div>

      <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-5">
        <h3 className="text-sm font-bold text-slate-950">
          CSV Feature Guide
        </h3>
        <div className="mt-4 max-h-[620px] overflow-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-xs">
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[32%]" />
              <col className="w-[46%]" />
            </colgroup>
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {["Column", "Field", "Accepted values"].map((heading) => (
                  <th key={heading} className="px-3 py-3 font-bold">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {csvFeatureGuide.map(([column, field, acceptedValues]) => (
                <tr key={column}>
                  <td className="break-words px-3 py-3 font-bold text-slate-900">{column}</td>
                  <td className="px-3 py-3 text-slate-600">{field}</td>
                  <td className="px-3 py-3 leading-5 text-slate-600">{acceptedValues}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-5 text-sm leading-6 text-slate-500">
          Numeric encodings are shown here because CSV uploads must match the
          model feature schema exactly.
        </p>
      </div>

      {preview ? (
        <div className="lg:col-span-2 rounded-[22px] border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-950">Batch Mapping Preview</h3>
              <p className="mt-1 text-sm text-slate-500">
                Review patient reference mapping before confirming model processing.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="cyan">{preview.summary.valid_rows} valid</Badge>
              <Badge tone={preview.summary.invalid_rows ? "amber" : "green"}>{preview.summary.invalid_rows} invalid</Badge>
              <Badge tone="purple">{preview.summary.new_patient_cases} new cases</Badge>
            </div>
          </div>
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {["Row", "Patient Reference", "Mapping", "Status", "Errors"].map((heading) => (
                    <th key={heading} className="px-4 py-3 font-bold">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.rows.slice(0, 12).map((row) => (
                  <tr key={row.row_number}>
                    <td className="px-4 py-3 font-bold text-slate-950">{row.row_number}</td>
                    <td className="px-4 py-3 text-slate-700">{row.patient_reference_id ?? "--"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.existing_patient_case_id ? "Existing case" : row.will_create_patient_case ? "Create new case" : "--"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={row.status === "valid" ? "green" : "amber"}>{row.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.errors.join("; ") || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.rows.length > 12 ? (
            <p className="mt-3 text-sm text-slate-500">Showing first 12 rows of {preview.rows.length}.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
