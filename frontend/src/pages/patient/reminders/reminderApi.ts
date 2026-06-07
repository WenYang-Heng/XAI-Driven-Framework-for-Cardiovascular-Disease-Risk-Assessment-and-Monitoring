import { API_BASE_URL } from "../../domain-expert/constants";

export type ReminderStatus = "scheduled" | "completed";
export type ReminderRepeat =
  | "once"
  | "daily"
  | "weekly"
  | "custom"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";
export type ReminderCustomMode = "interval" | "selected_days";
export type ReminderCustomUnit = "minutes" | "hours" | "days" | "weeks";

export type ReminderRecord = {
  reminder_id: string;
  user_id: string;
  title: string;
  description?: string | null;
  reminder_time: string;
  linked_item?: string | null;
  repeat_interval: ReminderRepeat;
  custom_mode?: ReminderCustomMode | null;
  custom_interval?: number | null;
  custom_unit?: ReminderCustomUnit | null;
  selected_days?: ReminderRepeat[];
  status: ReminderStatus;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ReminderInput = {
  user_id: string;
  title: string;
  description?: string;
  reminder_time: string;
  linked_item?: string;
  repeat_interval: ReminderRepeat;
  custom_mode?: ReminderCustomMode;
  custom_interval?: number;
  custom_unit?: ReminderCustomUnit;
  selected_days?: ReminderRepeat[];
};

export async function fetchReminders(userId: string) {
  const response = await fetch(`${API_BASE_URL}/api/reminders/${encodeURIComponent(userId)}`);
  if (!response.ok) {
    throw new Error("Unable to load reminders.");
  }
  const data = await response.json();
  return (data.items ?? []) as ReminderRecord[];
}

export async function createReminder(payload: ReminderInput) {
  const response = await fetch(`${API_BASE_URL}/api/reminders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("Unable to create reminder.");
  }
  const data = await response.json();
  return data.reminder as ReminderRecord;
}

export async function completeReminder(reminderId: string, userId: string) {
  const response = await fetch(`${API_BASE_URL}/api/reminders/${encodeURIComponent(reminderId)}?user_id=${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "completed" }),
  });
  if (!response.ok) {
    throw new Error("Unable to complete reminder.");
  }
  const data = await response.json();
  return data.reminder as ReminderRecord;
}

export async function updateReminder(reminderId: string, userId: string, payload: Partial<ReminderInput> & { status?: ReminderStatus }) {
  const response = await fetch(`${API_BASE_URL}/api/reminders/${encodeURIComponent(reminderId)}?user_id=${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("Unable to update reminder.");
  }
  const data = await response.json();
  return data.reminder as ReminderRecord;
}

export async function deleteReminder(reminderId: string, userId: string) {
  const response = await fetch(`${API_BASE_URL}/api/reminders/${encodeURIComponent(reminderId)}?user_id=${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Unable to delete reminder.");
  }
}
