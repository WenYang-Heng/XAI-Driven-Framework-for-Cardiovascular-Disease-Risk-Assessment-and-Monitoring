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
