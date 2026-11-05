import type { AssessmentModelSelection, AssessmentMode, PatientForm } from './types';

export type NumericFeatureName = "age" | "trestbps" | "chol" | "thalach" | "oldpeak";
export type CategoricalFeatureName = "sex" | "cp" | "fbs" | "restecg" | "exang" | "slope" | "ca" | "thal";
export type UciFeatureName = NumericFeatureName | CategoricalFeatureName;

type FieldValidationTone = "error" | "warning";

export type FieldValidationState = {
  tone: FieldValidationTone;
  message: string;
} | null;

type NumericValidationRule = {
  featureName: NumericFeatureName;
  formField: keyof PatientForm;
  label: string;
  allowedRange: [number, number];
  trainingRange: [number, number];
  unit?: string;
  normalReferenceRange?: string;
};

type CategoricalValidationRule = {
  featureName: CategoricalFeatureName;
  formField: keyof PatientForm;
  label: string;
  supportedValues: Record<string, string>;
};

const numericValidationRules: NumericValidationRule[] = [
  {
    featureName: "age",
    formField: "age",
    label: "Age",
    allowedRange: [1, 120],
    trainingRange: [29, 77],
    unit: "years",
  },
  {
    featureName: "trestbps",
    formField: "restingBp",
    label: "Resting Blood Pressure",
    allowedRange: [60, 260],
    trainingRange: [94, 200],
    unit: "mmHg",
    normalReferenceRange: "Normal systolic reference: <120 mmHg",
  },
  {
    featureName: "chol",
    formField: "cholesterol",
    label: "Serum Cholesterol",
    allowedRange: [80, 700],
    trainingRange: [126, 564],
    unit: "mg/dL",
    normalReferenceRange: "Desirable total cholesterol: <200 mg/dL",
  },
  {
    featureName: "thalach",
    formField: "maxHeartRate",
    label: "Maximum Heart Rate",
    allowedRange: [40, 250],
    trainingRange: [71, 202],
    unit: "bpm",
  },
  {
    featureName: "oldpeak",
    formField: "oldpeak",
    label: "ST Depression / Oldpeak",
    allowedRange: [0, 10],
    trainingRange: [0, 6.2],
  },
];

const categoricalValidationRules: CategoricalValidationRule[] = [
  {
    featureName: "sex",
    formField: "sex",
    label: "Sex",
    supportedValues: {
      "0": "Female",
      "1": "Male",
    },
  },
  {
    featureName: "cp",
    formField: "chestPain",
    label: "Chest Pain Type",
    supportedValues: {
      "1": "Typical angina",
      "2": "Atypical angina",
      "3": "Non-anginal pain",
      "4": "Asymptomatic",
    },
  },
  {
    featureName: "fbs",
    formField: "fastingBloodSugar",
    label: "Fasting Blood Sugar",
    supportedValues: {
      "0": "False",
      "1": "True, fasting blood sugar > 120 mg/dL",
    },
  },
  {
    featureName: "restecg",
    formField: "restingEcg",
    label: "Resting ECG",
    supportedValues: {
      "0": "Normal",
      "1": "ST-T wave abnormality",
      "2": "Probable or definite left ventricular hypertrophy",
    },
  },
  {
    featureName: "exang",
    formField: "exerciseAngina",
    label: "Exercise-Induced Angina",
    supportedValues: {
      "0": "No",
      "1": "Yes",
    },
  },
  {
    featureName: "slope",
    formField: "slope",
    label: "Slope",
    supportedValues: {
      "1": "Upsloping",
      "2": "Flat",
      "3": "Downsloping",
    },
  },
  {
    featureName: "ca",
    formField: "vessels",
    label: "Number of Major Vessels Coloured by Fluoroscopy",
    supportedValues: {
      "0": "0",
      "1": "1",
      "2": "2",
      "3": "3",
    },
  },
  {
    featureName: "thal",
    formField: "thalassemia",
    label: "Thal",
    supportedValues: {
      "3": "Normal",
      "6": "Fixed defect",
      "7": "Reversible defect",
    },
  },
];

export const requiredSingleFields: Array<keyof PatientForm> = [
  ...numericValidationRules.map((rule) => rule.formField),
  ...categoricalValidationRules.map((rule) => rule.formField),
];

export function validateClinicalRange(featureName: NumericFeatureName, rawValue: string) {
  const rule = numericValidationRules.find((item) => item.featureName === featureName);
  if (!rule || !rawValue.trim()) {
    return true;
  }

  const value = Number(rawValue);
  return Number.isFinite(value) && value >= rule.allowedRange[0] && value <= rule.allowedRange[1];
}

export function validateCategoricalEncoding(featureName: CategoricalFeatureName, rawValue: string) {
  const rule = categoricalValidationRules.find((item) => item.featureName === featureName);
  if (!rule || !rawValue.trim()) {
    return true;
  }

  return Object.keys(rule.supportedValues).includes(rawValue);
}

export function checkTrainingRangeWarning(featureName: NumericFeatureName, rawValue: string) {
  const rule = numericValidationRules.find((item) => item.featureName === featureName);
  if (!rule || !rawValue.trim() || !validateClinicalRange(featureName, rawValue)) {
    return false;
  }

  const value = Number(rawValue);
  return value < rule.trainingRange[0] || value > rule.trainingRange[1];
}

export function getValidationSummary(
  form: PatientForm,
  selectedModel: AssessmentModelSelection,
  assessmentMode: AssessmentMode,
  batchFile: File | null,
  hasBatchPreview: boolean,
) {
  const missingValues = requiredSingleFields.filter((field) => !form[field].trim());
  const invalidValues: Array<{ field: keyof PatientForm; featureName: UciFeatureName; label: string; message: string }> = [];
  const trainingRangeWarnings: Array<{ field: keyof PatientForm; featureName: NumericFeatureName; label: string; message: string }> = [];
  const fieldStates: Partial<Record<keyof PatientForm, FieldValidationState>> = {};

  numericValidationRules.forEach((rule) => {
    const rawValue = form[rule.formField];
    if (!rawValue.trim()) {
      return;
    }

    if (!validateClinicalRange(rule.featureName, rawValue)) {
      const message = "Invalid value. Please enter a clinically plausible value.";
      invalidValues.push({ field: rule.formField, featureName: rule.featureName, label: rule.label, message });
      fieldStates[rule.formField] = { tone: "error", message };
      return;
    }

    if (checkTrainingRangeWarning(rule.featureName, rawValue)) {
      const message = "This value is outside the model's training range. The assessment can continue, but prediction reliability may be reduced.";
      trainingRangeWarnings.push({ field: rule.formField, featureName: rule.featureName, label: rule.label, message });
      fieldStates[rule.formField] = { tone: "warning", message };
    }
  });

  categoricalValidationRules.forEach((rule) => {
    const rawValue = form[rule.formField];
    if (!rawValue.trim() || validateCategoricalEncoding(rule.featureName, rawValue)) {
      return;
    }

    const message = "Invalid category. Please select one of the supported UCI feature values.";
    invalidValues.push({ field: rule.formField, featureName: rule.featureName, label: rule.label, message });
    fieldStates[rule.formField] = { tone: "error", message };
  });

  const readinessStatus = getAssessmentReadiness({
    assessmentMode,
    batchFile,
    hasBatchPreview,
    invalidValues,
    missingValues,
    selectedModel,
    trainingRangeWarnings,
  });
  const completedRequired = requiredSingleFields.length - missingValues.length;
  const canRun = assessmentMode === "single"
    ? Boolean(selectedModel) && missingValues.length === 0 && invalidValues.length === 0
    : Boolean(selectedModel) && Boolean(batchFile);

  return {
    canRun,
    completedRequired,
    fieldStates,
    invalidValues,
    missingValues,
    readinessStatus,
    requiredTotal: requiredSingleFields.length,
    trainingRangeWarnings,
  };
}

export function getAssessmentReadiness({
  assessmentMode,
  batchFile,
  hasBatchPreview,
  invalidValues,
  missingValues,
  selectedModel,
  trainingRangeWarnings,
}: {
  assessmentMode: AssessmentMode;
  batchFile: File | null;
  hasBatchPreview: boolean;
  invalidValues: unknown[];
  missingValues: unknown[];
  selectedModel: AssessmentModelSelection;
  trainingRangeWarnings: unknown[];
}) {
  if (!selectedModel || (assessmentMode === "batch" && !batchFile)) {
    return "Incomplete";
  }

  if (assessmentMode === "batch") {
    return hasBatchPreview ? "Ready for assessment" : "Incomplete";
  }

  if (missingValues.length > 0) {
    return "Incomplete";
  }

  if (invalidValues.length > 0) {
    return "Invalid input";
  }

  if (trainingRangeWarnings.length > 0) {
    return "Ready with warnings";
  }

  return "Ready for assessment";
}
