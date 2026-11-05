import type { ChatbotPageContext } from "./ChatbotContext";

export function guidedQuestionsForContext(context: ChatbotPageContext, lastAssistantReply = "") {
  const dynamicQuestions = [
    ...questionsFromReply(lastAssistantReply),
    ...questionsFromContext(context),
  ];
  const baseQuestions = baseQuestionsForPage(context.page);
  return uniqueQuestions([...dynamicQuestions, ...baseQuestions]).slice(0, 5);
}

function baseQuestionsForPage(page: string) {
  switch (page) {
    case "assessment_result":
      return [
        "What does my risk score mean?",
        "What should I focus on first?",
        "What does it mean if some inputs are missing?",
      ];
    case "action_plan":
      return [
        "Which action should I start with?",
        "Give me examples for this action",
        "How can I make this easier?",
      ];
    case "reminders":
      return [
        "How do reminders work?",
        "What reminders are due soon?",
        "Can I change or cancel a reminder?",
      ];
    case "assessment_form":
      return [
        "What if I don't know my blood pressure?",
        "How should I choose my activity level?",
        "Can I leave some values unknown?",
      ];
    case "dashboard":
      return [
        "Summarize my latest result",
        "What should I do today?",
        "What does my risk category mean?",
      ];
    default:
      return [
        "How do I use this app?",
        "What is a CVD risk score?",
        "What can this chatbot help with?",
      ];
  }
}

function questionsFromContext(context: ChatbotPageContext) {
  const questions: string[] = [];
  const riskCategory = String(context.risk_category ?? context.latest_risk_category ?? "").toLowerCase();
  const confidenceLevel = String(context.confidence_level ?? "").toLowerCase();
  const topFactors = getStringList(context.top_factors);
  const missingInputs = getStringList(context.missing_inputs);
  const reminders = Array.isArray(context.reminders) ? context.reminders : [];

  if (riskCategory === "high") {
    questions.push("What should I focus on first?");
    questions.push("How can I lower my risk safely?");
  } else if (riskCategory === "moderate") {
    questions.push("What changes would help most?");
  } else if (riskCategory === "low") {
    questions.push("How can I keep my risk low?");
  }

  if (confidenceLevel === "low" || confidenceLevel === "medium") {
    questions.push("What missing values should I add?");
  }

  if (missingInputs.some((input) => includesAny(input, ["blood pressure", "diastolic", "systolic"]))) {
    questions.push("How do I track my blood pressure?");
  }

  if (factorIncludes(topFactors, ["cholesterol"])) {
    questions.push("How can I improve my cholesterol?");
    questions.push("What fibre-rich foods can I try?");
  }

  if (factorIncludes(topFactors, ["activity", "exercise", "physical"])) {
    questions.push("How can I increase activity safely?");
    questions.push("What is a realistic walking goal?");
  }

  if (factorIncludes(topFactors, ["blood pressure", "systolic", "diastolic"])) {
    questions.push("How can I monitor blood pressure?");
  }

  if (context.page === "action_plan") {
    questions.push("How do I set a reminder for this?");
  }

  if (context.page === "reminders" && reminders.length) {
    questions.push("What reminders are due soon?");
  }

  return questions;
}

function questionsFromReply(reply: string) {
  const lowered = reply.toLowerCase();
  const questions: string[] = [];
  if (!lowered) {
    return questions;
  }

  if (lowered.includes("physical activity") || lowered.includes("walk")) {
    questions.push("How can I start walking more?");
  }
  if (lowered.includes("blood pressure")) {
    questions.push("How do I track my blood pressure?");
  }
  if (lowered.includes("cholesterol")) {
    questions.push("What foods help with cholesterol?");
  }
  if (lowered.includes("reminder")) {
    questions.push("Help me set a reminder");
  }
  if (lowered.includes("would you like") && !questions.length) {
    questions.push("What is one simple next step?");
  }

  return questions;
}

function getStringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item).toLowerCase()) : [];
}

function factorIncludes(factors: string[], terms: string[]) {
  return factors.some((factor) => includesAny(factor, terms));
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function uniqueQuestions(questions: string[]) {
  const seen = new Set<string>();
  return questions.filter((question) => {
    const key = question.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function legacyGuidedQuestionsForContext(context: ChatbotPageContext) {
  switch (context.page) {
    case "assessment_result":
      return [
        "What does my risk score mean?",
        "Why is my risk category this level?",
        "What should I focus on first?",
        "Why is my confidence level low or medium?",
        "What does it mean if some inputs are missing?",
      ];
    case "action_plan":
      return [
        "Which action should I start with?",
        "Can you explain this action plan?",
        "Give me examples for this action",
        "How can I track my progress?",
        "How can I make this easier?",
      ];
    case "reminders":
      return [
        "How do reminders work?",
        "How can I set a reminder for an action item?",
        "What reminders are due soon?",
        "Can I change or cancel a reminder?",
      ];
    case "assessment_form":
      return [
        "What if I don't know my blood pressure?",
        "How should I choose my activity level?",
        "What does cholesterol category mean?",
        "Can I leave some values unknown?",
      ];
    case "dashboard":
      return [
        "Summarize my latest result",
        "What should I do today?",
        "How do I create an action plan?",
        "What does my risk category mean?",
      ];
    default:
      return [
        "How do I use this app?",
        "What is a CVD risk score?",
        "How do action plans work?",
        "What can this chatbot help with?",
      ];
  }
}
