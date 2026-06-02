import type { AssessmentModel, BatchApiRow, FeatureContribution, PatientForm, PredictionResult, XaiExplanation } from './types';
import { batchTemplateColumns, featureLabels, modelProfiles } from './constants';

export function formToPredictionPayload(form: PatientForm, selectedModel: AssessmentModel, userId?: string) {
  return {
    user_id: userId,
    patient_reference_id: form.patientId,
    assessment_date: new Date().toISOString().slice(0, 10),
    visit_label: "Single assessment",
    model_name: modelProfiles[selectedModel].key,
    age: Number(form.age),
    sex: Number(form.sex),
    cp: Number(form.chestPain),
    trestbps: Number(form.restingBp),
    chol: Number(form.cholesterol),
    fbs: Number(form.fastingBloodSugar),
    restecg: Number(form.restingEcg),
    thalach: Number(form.maxHeartRate),
    exang: Number(form.exerciseAngina),
    oldpeak: Number(form.oldpeak),
    slope: Number(form.slope),
    ca: Number(form.vessels),
    thal: Number(form.thalassemia),
  };
}

export function riskLabel(level?: string) {
  if (!level) {
    return "Pending";
  }
  return `${level.charAt(0).toUpperCase()}${level.slice(1)}`;
}

export function riskTone(level?: string): "green" | "amber" | "red" | "slate" {
  if (level === "high" || level === "High") {
    return "red";
  }
  if (level === "moderate" || level === "Moderate") {
    return "amber";
  }
  if (level === "low" || level === "Low") {
    return "green";
  }
  return "slate";
}

export function sortedByMagnitude(contributions: FeatureContribution[] = []) {
  return [...contributions].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

export function displayContributions(contributions: FeatureContribution[] = []) {
  return contributions.map((item) => ({
    ...item,
    featureLabel: featureLabels[item.feature] ?? item.feature,
  }));
}

export function topPositiveContributors(contributions: FeatureContribution[], count = 3) {
  return displayContributions(contributions)
    .sort((a, b) => b.value - a.value)
    .slice(0, count);
}

export function topReducingContributors(contributions: FeatureContribution[], count = 1) {
  return displayContributions(contributions)
    .sort((a, b) => a.value - b.value)
    .slice(0, count);
}

export function topMagnitudeContributors(contributions: FeatureContribution[], count = 3) {
  return displayContributions(sortedByMagnitude(contributions)).slice(0, count);
}

export function contributorNames(contributions: { featureLabel: string }[]) {
  return contributions.map((item) => item.featureLabel).join(", ");
}

export function buildOutcomeSummary(prediction: PredictionResult) {
  const upward = topPositiveContributors(prediction.xai.shap.contributions, 3);
  const reducing = topReducingContributors(prediction.xai.shap.contributions, 1);
  const limeTop = topMagnitudeContributors(prediction.xai.lime.contributions, 3);
  const overlap = upward
    .map((item) => item.featureLabel)
    .filter((name) => limeTop.some((limeItem) => limeItem.featureLabel === name));
  const agreement = overlap.length
    ? `SHAP and LIME both highlight ${overlap.join(", ")}, so the explanation is reasonably consistent.`
    : "SHAP and LIME emphasize different local drivers, so the explanation should be reviewed carefully.";

  return {
    headline: `The model classified this assessment as ${riskLabel(prediction.risk_level).toLowerCase()} risk.`,
    cards: [
      `The prediction was mainly driven upward by ${contributorNames(upward)}.`,
      `${reducing[0]?.featureLabel ?? "One feature"} had the strongest reducing effect in this model output.`,
      agreement,
      "This explanation supports clinical review and should not be treated as a standalone diagnosis.",
    ],
  };
}

export function buildShapSummary(prediction: PredictionResult) {
  const upward = topPositiveContributors(prediction.xai.shap.contributions, 3);
  const reducing = topReducingContributors(prediction.xai.shap.contributions, 1);

  return {
    howToRead:
      "SHAP shows how each feature moved this patient's risk score away from the model's average baseline. Orange factors increased the predicted risk, while green factors reduced it.",
    patientMeaning: `For this assessment, ${contributorNames(upward)} pushed the risk estimate upward. ${reducing[0]?.featureLabel ?? "One feature"} had the strongest reducing effect.`,
  };
}

export function buildLimeSummary(prediction: PredictionResult) {
  const limeTop = topMagnitudeContributors(prediction.xai.lime.contributions, 3);
  const shapTop = topPositiveContributors(prediction.xai.shap.contributions, 3);
  const overlap = limeTop
    .map((item) => item.featureLabel)
    .filter((name) => shapTop.some((shapItem) => shapItem.featureLabel === name));

  return {
    howToRead:
      "LIME gives a local check of this single prediction by testing similar input patterns around the patient record.",
    patientMeaning: `The strongest local LIME drivers were ${contributorNames(limeTop)}.`,
    agreement: overlap.length
      ? `This aligns with SHAP on ${overlap.join(", ")}.`
      : "This does not strongly overlap with the top SHAP drivers, so the explanation should be interpreted with extra care.",
  };
}

export function fallbackXai(riskScore = 0.82, explanation: string[] = []): XaiExplanation {
  const contributions = batchTemplateColumns.filter((feature) => feature !== "patient_reference_id").map((feature) => {
    return { feature, value: 0 };
  });

  return {
    shap: {
      base_value: 0.5,
      final_value: riskScore,
      contributions,
    },
    lime: {
      contributions,
    },
    summary:
      explanation.length > 0
        ? explanation
        : ["Run an assessment to generate model-specific rationale and XAI summaries."],
  };
}

export function batchAggregateContributions(rows: BatchApiRow[]) {
  const totals = new Map<string, number>();
  rows.forEach((row) => {
    row.xai?.shap.contributions.forEach((item) => {
      totals.set(item.feature, (totals.get(item.feature) ?? 0) + Math.abs(item.value));
    });
  });

  return batchTemplateColumns
    .filter((feature) => feature !== "patient_reference_id")
    .map((feature) => ({
      feature,
      featureLabel: featureLabels[feature] ?? feature,
      value: rows.length ? Number(((totals.get(feature) ?? 0) / rows.length).toFixed(4)) : 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}
