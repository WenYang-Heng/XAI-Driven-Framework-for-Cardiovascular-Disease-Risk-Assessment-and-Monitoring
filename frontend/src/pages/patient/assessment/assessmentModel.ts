export type RiskFactor = {
  name: string;
  type: "Modifiable" | "Non-modifiable";
  impact: string;
  description: string;
  action: string;
};

export type AssessmentForm = {
  age: number;
  sex: "female" | "male";
  heightCm: number;
  bpInputType: "exact" | "category" | "unknown";
  systolicBp: number;
  diastolicBp: number;
  bpCategory: "normal" | "above_normal" | "well_above_normal";
  cholesterolInputType: "exact" | "category" | "unknown";
  cholesterol: number;
  cholesterolCategory: "normal" | "above_normal" | "well_above_normal";
  glucoseInputType: "exact" | "category" | "unknown";
  glucose: number;
  glucoseCategory: "normal" | "above_normal" | "well_above_normal";
  diabetes: "no" | "prediabetes" | "yes" | "unsure";
  smoking: "no" | "yes";
  activity: "no" | "yes";
  weightKg: number;
  alcoholIntake: "yes" | "no";
  symptoms: "none" | "mild" | "urgent";
};

export const fallbackRiskFactors: RiskFactor[] = [
  {
    name: "High Blood Pressure",
    type: "Modifiable",
    impact: "High impact",
    description:
      "Blood pressure is one of your strongest risk contributors. Improving it may help lower your estimated CVD risk.",
    action: "Reduce salt intake and monitor blood pressure regularly.",
  },
  {
    name: "Low Physical Activity",
    type: "Modifiable",
    impact: "Medium impact",
    description:
      "Low activity level can affect weight, heart health, and blood circulation over time.",
    action: "Start with achievable walking or light exercise goals.",
  },
  {
    name: "Age Group",
    type: "Non-modifiable",
    impact: "Medium impact",
    description:
      "Age is considered because cardiovascular risk usually increases over time.",
    action: "Focus on modifiable factors such as activity, blood pressure, smoking, and monitoring.",
  },
];

export const initialAssessment: AssessmentForm = {
  age: 45,
  sex: "female",
  heightCm: 165,
  bpInputType: "exact",
  systolicBp: 132,
  diastolicBp: 84,
  bpCategory: "above_normal",
  cholesterolInputType: "exact",
  cholesterol: 210,
  cholesterolCategory: "above_normal",
  glucoseInputType: "category",
  glucose: 95,
  glucoseCategory: "normal",
  diabetes: "unsure",
  smoking: "no",
  activity: "yes",
  weightKg: 70,
  alcoholIntake: "no",
  symptoms: "none",
};

export function calculateDemoRisk(form: AssessmentForm) {
  let score = 4;
  score += Math.max(0, (form.age - 35) * 0.28);
  score += form.sex === "male" ? 1.8 : 0.8;
  score += form.bpInputType === "exact" ? Math.max(0, (form.systolicBp - 115) * 0.13) : 1.2;
  score += form.cholesterolInputType === "exact" ? Math.max(0, (form.cholesterol - 180) * 0.035) : 0.9;
  score += glucoseCategory(form) === "well_above_normal" ? 3.3 : glucoseCategory(form) === "above_normal" ? 1.4 : 0;
  score += form.diabetes === "yes" ? 3.2 : form.diabetes === "prediabetes" ? 1.5 : form.diabetes === "unsure" ? 0.7 : 0;
  score += form.smoking === "yes" ? 4.4 : 0;
  score += form.activity === "no" ? 3.2 : 0;
  score += bmi(form) >= 30 ? 2.4 : bmi(form) >= 25 ? 1.2 : 0;
  score += form.symptoms === "urgent" ? 5 : form.symptoms === "mild" ? 1.5 : 0;

  return Math.min(38, Math.max(5, Math.round(score * 10) / 10));
}

export function buildRiskFactors(form: AssessmentForm): RiskFactor[] {
  const factors: RiskFactor[] = [];

  if (form.bpInputType === "exact" && form.systolicBp >= 130) {
    factors.push({
      name: "Blood Pressure",
      type: "Modifiable",
      impact: form.systolicBp >= 140 ? "High impact" : "Medium impact",
      description:
        "Your blood pressure reading is above the usual healthy range. Lowering it may help reduce strain on your heart and blood vessels.",
      action: "Track blood pressure, reduce salty food, and ask a healthcare professional if readings stay high.",
    });
  }

  if (form.activity === "no") {
    factors.push({
      name: "Physical Activity",
      type: "Modifiable",
      impact: "High impact",
      description:
        "Being less active can affect weight, blood pressure, cholesterol, and long-term heart health.",
      action: "Start with a realistic walking or light exercise target and increase gradually.",
    });
  }

  if (form.cholesterolInputType === "exact" && form.cholesterol >= 200) {
    factors.push({
      name: "Cholesterol",
      type: "Modifiable",
      impact: "Medium impact",
      description:
        "Higher cholesterol can contribute to fatty build-up in blood vessels over time.",
      action: "Choose more fibre-rich foods and discuss follow-up testing with a healthcare professional.",
    });
  }

  if (form.smoking !== "no") {
    factors.push({
      name: "Smoking Status",
      type: "Modifiable",
      impact: "High impact",
      description:
        "Smoking can damage blood vessels and increase the chance of cardiovascular problems.",
      action: "Consider a smoking reduction or cessation plan with proper support.",
    });
  }

  if (bmi(form) >= 25) {
    factors.push({
      name: "Weight / BMI",
      type: "Modifiable",
      impact: bmi(form) >= 30 ? "High impact" : "Medium impact",
      description:
        "Weight category can affect blood pressure, glucose control, cholesterol, and long-term cardiovascular risk.",
      action: "Focus on gradual, sustainable changes in activity, monitoring, and follow-up care.",
    });
  }

  if (form.diabetes === "yes" || glucoseCategory(form) === "well_above_normal") {
    factors.push({
      name: "Blood Sugar Control",
      type: "Modifiable",
      impact: "High impact",
      description:
        "High blood sugar or diabetes can increase the risk of blood vessel and heart problems over time.",
      action: "Track glucose if advised and discuss care targets with a healthcare professional.",
    });
  }

  if (form.age >= 55) {
    factors.push({
      name: "Age Group",
      type: "Non-modifiable",
      impact: "Medium impact",
      description:
        "This factor cannot be changed, but it helps explain why regular monitoring and healthier habits matter.",
      action: "Focus on modifiable factors such as activity, smoking, and blood pressure monitoring.",
    });
  }

  return factors.length ? factors.slice(0, 3) : fallbackRiskFactors;
}

function bmi(form: AssessmentForm) {
  return form.weightKg / ((form.heightCm / 100) ** 2);
}

function glucoseCategory(form: AssessmentForm) {
  if (form.glucoseInputType === "exact") {
    if (form.glucose >= 126) return "well_above_normal";
    if (form.glucose >= 100) return "above_normal";
    return "normal";
  }
  if (form.glucoseInputType === "category") {
    return form.glucoseCategory;
  }
  return "normal";
}
