import type { GuidedPlanForm, PlanItem, RiskFactor } from "./types";

export const initialGuidedPlan: GuidedPlanForm = {
  focus: "activity",
  readiness: "medium",
  timeAvailable: "10 min",
  barrier: "busy",
  reminder: "evening",
};

export const fallbackPlans: PlanItem[] = [
  {
    title: "Walk 30 minutes, 5 days per week",
    priority: "High Priority",
    factor: "Physical activity",
    timeframe: "This week",
    difficulty: "Moderate",
    reason:
      "Regular activity supports blood pressure, cholesterol, glucose control, weight, sleep, and overall heart health.",
    nextStep: "Start with 10 minutes after dinner today, then increase gradually.",
    barrier: "If 30 minutes feels too much, split it into three 10-minute walks.",
    measure: "Minutes active per week",
  },
  {
    title: "Reduce salty food at two meals per day",
    priority: "High Priority",
    factor: "Blood pressure",
    timeframe: "Next 7 days",
    difficulty: "Moderate",
    reason:
      "Lowering salt intake can help users manage blood pressure, which is a major modifiable CVD risk factor.",
    nextStep: "Choose one lower-salt option for lunch and dinner.",
    barrier: "If eating outside, ask for sauce or gravy separately.",
    measure: "Lower-salt meals completed",
  },
  {
    title: "Prepare a BP check routine",
    priority: "Medium Priority",
    factor: "Monitoring",
    timeframe: "Twice weekly",
    difficulty: "Easy",
    reason:
      "Consistent monitoring helps users notice patterns and discuss changes with a healthcare professional.",
    nextStep: "Set a morning reminder for two fixed days each week.",
    barrier: "Keep the monitor in a visible place so it is easier to remember.",
    measure: "Blood pressure readings logged",
  },
];

export function buildPlans(riskFactors: RiskFactor[]): PlanItem[] {
  const generated = riskFactors
    .filter((factor) => factor.type === "Modifiable")
    .map((factor, index): PlanItem => {
      if (factor.name.toLowerCase().includes("pressure")) {
        return {
          ...fallbackPlans[1],
          priority: index === 0 ? "High Priority" : "Medium Priority",
          factor: factor.name,
          reason: factor.description,
        };
      }

      if (factor.name.toLowerCase().includes("activity")) {
        return {
          ...fallbackPlans[0],
          priority: index === 0 ? "High Priority" : "Medium Priority",
          factor: factor.name,
          reason: factor.description,
        };
      }

      if (factor.name.toLowerCase().includes("cholesterol")) {
        return {
          title: "Add fibre-rich food to one meal daily",
          priority: index === 0 ? "High Priority" : "Medium Priority",
          factor: factor.name,
          timeframe: "Next 14 days",
          difficulty: "Moderate",
          reason: factor.description,
          nextStep: "Add oats, beans, fruit, or vegetables to one meal today.",
          barrier: "If cooking is difficult, start with fruit or ready-to-eat fibre options.",
          measure: "Heart-friendly meals completed",
        };
      }

      if (factor.name.toLowerCase().includes("smoking")) {
        return {
          title: "Create a nicotine reduction plan",
          priority: "High Priority",
          factor: factor.name,
          timeframe: "This week",
          difficulty: "Challenging",
          reason: factor.description,
          nextStep: "Pick one trigger time and replace it with a safer routine.",
          barrier: "Use support from a healthcare professional or quitline if cravings are strong.",
          measure: "Nicotine-free trigger moments",
        };
      }

      return {
        ...fallbackPlans[2],
        factor: factor.name,
        reason: factor.description,
      };
    });

  return generated.length ? generated.slice(0, 4) : fallbackPlans;
}

export function buildGuidedPlan(form: GuidedPlanForm): PlanItem {
  const focusPlan = {
    activity: {
      title: `Walk for ${form.timeAvailable} after dinner`,
      factor: "Physical activity",
      measure: "Active minutes completed",
      reason:
        "Physical activity is one of the most practical ways to support blood pressure, glucose control, sleep, and heart health.",
    },
    diet: {
      title: "Choose one heart-friendlier meal swap",
      factor: "Food choices",
      measure: "Heart-friendly meals completed",
      reason:
        "Small diet changes can support cholesterol, blood pressure, glucose control, and long-term cardiovascular health.",
    },
    "blood-pressure": {
      title: "Create a blood pressure check routine",
      factor: "Blood pressure",
      measure: "Blood pressure readings logged",
      reason:
        "Regular monitoring helps users understand patterns and discuss persistent high readings with a healthcare professional.",
    },
    smoking: {
      title: "Replace one nicotine trigger moment",
      factor: "Nicotine exposure",
      measure: "Nicotine-free trigger moments",
      reason:
        "Reducing nicotine exposure can meaningfully support heart and blood vessel health.",
    },
    monitoring: {
      title: "Log one health measurement",
      factor: "Monitoring",
      measure: "Health logs completed",
      reason:
        "A simple monitoring routine helps users notice changes and stay consistent with their care plan.",
    },
  }[form.focus];

  const barrierPlan = {
    busy: "Attach the action to an existing routine so it does not require extra planning.",
    "low-energy": "Use the smallest version of the action on low-energy days.",
    cost: "Choose a no-cost option first, such as walking, food swaps, or home monitoring.",
    forgetful: "Use a reminder and keep the needed item visible.",
  }[form.barrier];

  const nextStep = {
    low: "Start with the smallest version once this week.",
    medium: `Try it for ${form.timeAvailable} on three days this week.`,
    high: `Do it for ${form.timeAvailable} on five days this week.`,
  }[form.readiness];

  return {
    title: focusPlan.title,
    priority: form.readiness === "high" ? "High Priority" : "Medium Priority",
    factor: focusPlan.factor,
    timeframe: form.reminder === "weekend" ? "This weekend" : `Next ${form.reminder}`,
    difficulty: form.readiness === "low" ? "Easy" : "Moderate",
    reason: focusPlan.reason,
    nextStep,
    barrier: barrierPlan,
    measure: focusPlan.measure,
  };
}

export function priorityTone(priority: PlanItem["priority"]) {
  if (priority === "High Priority") return "amber";
  if (priority === "Medium Priority") return "cyan";
  return "slate";
}
