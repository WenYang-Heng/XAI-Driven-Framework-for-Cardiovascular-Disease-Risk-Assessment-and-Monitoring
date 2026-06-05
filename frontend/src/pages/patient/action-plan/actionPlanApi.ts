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

export async function fetchActionPlan({
  assessmentId,
  userId,
}: {
  assessmentId: string;
  userId: string;
}) {
  const response = await fetch(
    `${API_BASE_URL}/api/action-plans/assessment/${encodeURIComponent(assessmentId)}?user_id=${encodeURIComponent(userId)}`,
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Unable to load action plan.");
  }

  return response.json();
}
