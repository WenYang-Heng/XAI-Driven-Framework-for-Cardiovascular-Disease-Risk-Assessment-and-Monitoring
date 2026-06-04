import { API_BASE_URL } from "../../domain-expert/constants";

export type GenerateActionPlanRequest = {
  assessmentId: string;
  userId: string;
  regenerate?: boolean;
};

export async function generateActionPlan({
  assessmentId,
  userId,
  regenerate = false,
}: GenerateActionPlanRequest) {
  const response = await fetch(`${API_BASE_URL}/api/action-plans/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      assessment_id: assessmentId,
      user_id: userId,
      regenerate,
    }),
  });

  if (!response.ok) {
    throw new Error("Unable to generate action plan.");
  }

  return response.json();
}
