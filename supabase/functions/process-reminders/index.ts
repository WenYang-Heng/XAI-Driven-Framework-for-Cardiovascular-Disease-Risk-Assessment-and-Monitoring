import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ReminderRecord = {
  reminder_id: string;
  user_id: string;
  title: string;
  description?: string | null;
  reminder_time: string;
  repeat_interval?: string | null;
  custom_mode?: string | null;
  custom_interval?: number | null;
  custom_unit?: string | null;
  selected_days?: string[] | null;
  notification_channel?: string | null;
};

type UserProfile = {
  user_id: string;
  email?: string | null;
  full_name?: string | null;
};

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const jsonHeaders = { "Content-Type": "application/json" };

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed." }, 405);
  }

  const expectedToken = Deno.env.get("REMINDER_PROCESSOR_TOKEN") ?? "";
  if (expectedToken && request.headers.get("X-Reminder-Processor-Token") !== expectedToken) {
    return jsonResponse({ success: false, error: "Invalid reminder processor token." }, 403);
  }

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = getSupabaseSecretKey();
  const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const emailFrom = Deno.env.get("REMINDER_EMAIL_FROM") ?? "CardioXAI <onboarding@resend.dev>";
  const dryRun = new URL(request.url).searchParams.get("dry_run") === "true";
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? "25");

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: reminders, error } = await supabase
    .from("reminders")
    .select("*")
    .eq("status", "scheduled")
    .eq("email_enabled", true)
    .eq("notification_channel", "email")
    .is("notified_at", null)
    .is("notification_error", null)
    .lte("reminder_time", new Date().toISOString())
    .order("reminder_time", { ascending: true })
    .limit(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 25);

  if (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }

  const dueReminders = (reminders ?? []) as ReminderRecord[];
  const profilesByUserId = await loadProfilesByUserId(
    supabase,
    [...new Set(dueReminders.map((reminder) => reminder.user_id))],
  );
  const results = [];

  for (const reminder of dueReminders) {
    const profile = profilesByUserId.get(reminder.user_id);
    const email = profile?.email;
    if (!email) {
      const errorMessage = "User email is missing.";
      if (!dryRun) {
        await markReminderError(supabase, reminder.reminder_id, errorMessage);
      }
      results.push({ reminder_id: reminder.reminder_id, status: "failed", error: errorMessage });
      continue;
    }

    const subject = `Reminder: ${reminder.title}`;
    const body = reminderEmailBody(reminder, profile);
    if (dryRun) {
      results.push({ reminder_id: reminder.reminder_id, status: "dry_run", to: email, subject });
      continue;
    }
    if (!resendApiKey) {
      results.push({ reminder_id: reminder.reminder_id, status: "skipped", error: "RESEND_API_KEY is not configured." });
      continue;
    }

    try {
      const messageId = await sendEmail(resendApiKey, emailFrom, email, subject, body);
      await markReminderSent(supabase, reminder);
      results.push({ reminder_id: reminder.reminder_id, status: "sent", provider: "resend", message_id: messageId });
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : "Unable to send reminder email.";
      await markReminderError(supabase, reminder.reminder_id, errorMessage);
      results.push({ reminder_id: reminder.reminder_id, status: "failed", error: errorMessage });
    }
  }

  return jsonResponse({
    success: true,
    processed: results.length,
    sent: results.filter((result) => result.status === "sent").length,
    failed: results.filter((result) => result.status === "failed").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    dry_run: dryRun,
    results,
  });
});

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

function getSupabaseSecretKey() {
  const explicitKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY");
  if (explicitKey) {
    return explicitKey;
  }

  const secretKeysJson = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!secretKeysJson) {
    throw new Error("SUPABASE_SECRET_KEYS or SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  try {
    const secretKeys = JSON.parse(secretKeysJson) as Record<string, string>;
    const firstSecretKey = Object.values(secretKeys).find(Boolean);
    if (firstSecretKey) {
      return firstSecretKey;
    }
  } catch {
    throw new Error("SUPABASE_SECRET_KEYS is not valid JSON.");
  }

  throw new Error("SUPABASE_SECRET_KEYS does not contain a usable key.");
}

async function loadProfilesByUserId(supabase: ReturnType<typeof createClient>, userIds: string[]) {
  const profiles = new Map<string, UserProfile>();
  if (!userIds.length) {
    return profiles;
  }

  const { data } = await supabase
    .from("user_profiles")
    .select("user_id,email,full_name")
    .in("user_id", userIds);

  for (const profile of (data ?? []) as UserProfile[]) {
    profiles.set(profile.user_id, profile);
  }
  return profiles;
}

async function sendEmail(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  text: string,
) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = await response.json();
  return payload.id as string | undefined;
}

async function markReminderSent(supabase: ReturnType<typeof createClient>, reminder: ReminderRecord) {
  const nextTime = nextReminderTime(reminder);
  const payload = nextTime
    ? { reminder_time: nextTime, notified_at: null, notification_error: null, updated_at: new Date().toISOString() }
    : { notified_at: new Date().toISOString(), notification_error: null, updated_at: new Date().toISOString() };

  await supabase.from("reminders").update(payload).eq("reminder_id", reminder.reminder_id);
}

async function markReminderError(supabase: ReturnType<typeof createClient>, reminderId: string, error: string) {
  await supabase
    .from("reminders")
    .update({ notification_error: error, updated_at: new Date().toISOString() })
    .eq("reminder_id", reminderId);
}

function reminderEmailBody(reminder: ReminderRecord, profile?: UserProfile) {
  const name = profile?.full_name || "there";
  const details = reminder.description ? `${reminder.description}\n\n` : "";
  return [
    `Hi ${name},`,
    "",
    "This is your CardioXAI reminder:",
    "",
    reminder.title,
    "",
    `Scheduled time: ${reminder.reminder_time}`,
    "",
    details.trim(),
    "",
    "This reminder supports your self-management plan and does not replace medical advice or prescribed treatment.",
  ].filter(Boolean).join("\n");
}

function nextReminderTime(reminder: ReminderRecord) {
  const repeat = reminder.repeat_interval ?? "once";
  const current = new Date(reminder.reminder_time);
  if (repeat === "once" || repeat === "none") {
    return null;
  }
  if (repeat === "daily") {
    return addTime(current, 1, "days").toISOString();
  }
  if (repeat === "weekly") {
    return addTime(current, 1, "weeks").toISOString();
  }
  if (repeat in WEEKDAY_INDEX) {
    return nextWeekday(current, WEEKDAY_INDEX[repeat]).toISOString();
  }
  if (repeat === "custom" && reminder.custom_mode === "interval") {
    return addTime(current, reminder.custom_interval ?? 1, reminder.custom_unit ?? "days").toISOString();
  }
  if (repeat === "custom" && reminder.custom_mode === "selected_days") {
    const indexes = (reminder.selected_days ?? [])
      .filter((day) => day in WEEKDAY_INDEX)
      .map((day) => WEEKDAY_INDEX[day])
      .sort((left, right) => left - right);
    if (indexes.length) {
      return indexes.map((index) => nextWeekday(current, index)).sort((left, right) => left.getTime() - right.getTime())[0].toISOString();
    }
  }
  return null;
}

function addTime(date: Date, amount: number, unit: string) {
  const next = new Date(date);
  if (unit === "minutes") next.setUTCMinutes(next.getUTCMinutes() + amount);
  else if (unit === "hours") next.setUTCHours(next.getUTCHours() + amount);
  else if (unit === "weeks") next.setUTCDate(next.getUTCDate() + amount * 7);
  else next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function nextWeekday(date: Date, weekday: number) {
  const next = new Date(date);
  let daysAhead = (weekday - next.getUTCDay() + 7) % 7;
  if (daysAhead === 0) {
    daysAhead = 7;
  }
  next.setUTCDate(next.getUTCDate() + daysAhead);
  return next;
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: jsonHeaders });
}
