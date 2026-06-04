import type { LucideIcon } from "lucide-react";

export type RiskCategory = {
  label: string;
  tone: "green" | "amber" | "red";
};

export type RiskFactor = {
  name: string;
  type: "Modifiable" | "Non-modifiable";
  impact: string;
  description: string;
  action: string;
};

export type ActionPlanPageProps = {
  currentCategory: RiskCategory;
  riskFactors: RiskFactor[];
};

export type PlanItem = {
  title: string;
  priority: "High Priority" | "Medium Priority" | "Supportive";
  factor: string;
  timeframe: string;
  difficulty: "Easy" | "Moderate" | "Challenging";
  reason: string;
  nextStep: string;
  barrier: string;
  measure: string;
};

export type GuidedPlanForm = {
  focus: "activity" | "diet" | "blood-pressure" | "smoking" | "monitoring";
  readiness: "low" | "medium" | "high";
  timeAvailable: "5 min" | "10 min" | "30 min";
  barrier: "busy" | "low-energy" | "cost" | "forgetful";
  reminder: "morning" | "evening" | "weekend";
};

export type PlanIcon = LucideIcon;
