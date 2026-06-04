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
  bpKnown: "known" | "unknown";
  systolicBp: number;
  cholesterolKnown: "known" | "unknown";
  cholesterol: number;
  glucose: "normal" | "borderline" | "high";
  diabetes: "no" | "prediabetes" | "yes" | "unsure";
  smoking: "no" | "former" | "yes";
  activity: "low" | "medium" | "high";
  weightCategory: "healthy" | "overweight" | "obese" | "unsure";
  bpMedication: "no" | "yes" | "unsure";
  familyHistory: "no" | "yes" | "unsure";
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
  bpKnown: "known",
  systolicBp: 132,
  cholesterolKnown: "known",
  cholesterol: 210,
  glucose: "normal",
  diabetes: "unsure",
  smoking: "no",
  activity: "medium",
  weightCategory: "unsure",
  bpMedication: "unsure",
  familyHistory: "unsure",
  symptoms: "none",
};

export function calculateDemoRisk(form: AssessmentForm) {
  let score = 4;
  score += Math.max(0, (form.age - 35) * 0.28);
  score += form.sex === "male" ? 1.8 : 0.8;
  score += form.bpKnown === "known" ? Math.max(0, (form.systolicBp - 115) * 0.13) : 1.2;
  score += form.cholesterolKnown === "known" ? Math.max(0, (form.cholesterol - 180) * 0.035) : 0.9;
  score += form.glucose === "high" ? 3.3 : form.glucose === "borderline" ? 1.4 : 0;
  score += form.diabetes === "yes" ? 3.2 : form.diabetes === "prediabetes" ? 1.5 : form.diabetes === "unsure" ? 0.7 : 0;
  score += form.smoking === "yes" ? 4.4 : form.smoking === "former" ? 1.2 : 0;
  score += form.activity === "low" ? 3.2 : form.activity === "medium" ? 1.1 : 0;
  score += form.weightCategory === "obese" ? 2.4 : form.weightCategory === "overweight" ? 1.2 : form.weightCategory === "unsure" ? 0.4 : 0;
  score += form.bpMedication === "yes" ? 0.8 : form.bpMedication === "unsure" ? 0.4 : 0;
  score += form.familyHistory === "yes" ? 2.2 : form.familyHistory === "unsure" ? 0.8 : 0;
  score += form.symptoms === "urgent" ? 5 : form.symptoms === "mild" ? 1.5 : 0;

  return Math.min(38, Math.max(5, Math.round(score * 10) / 10));
}

export function buildRiskFactors(form: AssessmentForm): RiskFactor[] {
  const factors: RiskFactor[] = [];

  if (form.bpKnown === "known" && form.systolicBp >= 130) {
    factors.push({
      name: "Blood Pressure",
      type: "Modifiable",
      impact: form.systolicBp >= 140 ? "High impact" : "Medium impact",
      description:
        "Your blood pressure reading is above the usual healthy range. Lowering it may help reduce strain on your heart and blood vessels.",
      action: "Track blood pressure, reduce salty food, and ask a healthcare professional if readings stay high.",
    });
  }

  if (form.activity !== "high") {
    factors.push({
      name: "Physical Activity",
      type: "Modifiable",
      impact: form.activity === "low" ? "High impact" : "Medium impact",
      description:
        "Being less active can affect weight, blood pressure, cholesterol, and long-term heart health.",
      action: "Start with a realistic walking or light exercise target and increase gradually.",
    });
  }

  if (form.cholesterolKnown === "known" && form.cholesterol >= 200) {
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
      impact: form.smoking === "yes" ? "High impact" : "Medium impact",
      description:
        "Smoking can damage blood vessels and increase the chance of cardiovascular problems.",
      action: "Consider a smoking reduction or cessation plan with proper support.",
    });
  }

  if (form.weightCategory === "overweight" || form.weightCategory === "obese") {
    factors.push({
      name: "Weight Category",
      type: "Modifiable",
      impact: form.weightCategory === "obese" ? "High impact" : "Medium impact",
      description:
        "Weight category can affect blood pressure, glucose control, cholesterol, and long-term cardiovascular risk.",
      action: "Focus on gradual, sustainable changes in activity, monitoring, and follow-up care.",
    });
  }

  if (form.diabetes === "yes" || form.glucose === "high") {
    factors.push({
      name: "Blood Sugar Control",
      type: "Modifiable",
      impact: "High impact",
      description:
        "High blood sugar or diabetes can increase the risk of blood vessel and heart problems over time.",
      action: "Track glucose if advised and discuss care targets with a healthcare professional.",
    });
  }

  if (form.familyHistory === "yes" || form.age >= 55) {
    factors.push({
      name: form.familyHistory === "yes" ? "Family History" : "Age Group",
      type: "Non-modifiable",
      impact: "Medium impact",
      description:
        "This factor cannot be changed, but it helps explain why regular monitoring and healthier habits matter.",
      action: "Focus on modifiable factors such as activity, smoking, and blood pressure monitoring.",
    });
  }

  return factors.length ? factors.slice(0, 3) : fallbackRiskFactors;
}
