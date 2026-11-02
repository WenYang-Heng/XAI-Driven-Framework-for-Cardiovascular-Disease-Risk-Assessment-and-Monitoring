import { supabase } from "../../lib/supabase";
import { API_BASE_URL } from "../domain-expert/constants";

export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Calls an admin endpoint with the current Supabase session token. */
export async function adminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = await supabase?.auth.getSession();
  const token = session?.data.session?.access_token;
  const headers = new Headers(init.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (init.body) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/admin${path}`, { ...init, headers });
  } catch {
    throw new AdminApiError("Cannot reach server-api. Check that it is running and retry.", 0);
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const detail = typeof payload?.detail === "string" ? payload.detail : `Request failed (${response.status})`;
    throw new AdminApiError(detail, response.status);
  }
  return (await response.json()) as T;
}

export async function recordSessionEvent(event: "login" | "logout", userId?: string) {
  if (!userId) {
    return;
  }
  try {
    await fetch(`${API_BASE_URL}/api/activity/${event}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
  } catch {
    // Audit logging must never block signing in or out.
  }
}
