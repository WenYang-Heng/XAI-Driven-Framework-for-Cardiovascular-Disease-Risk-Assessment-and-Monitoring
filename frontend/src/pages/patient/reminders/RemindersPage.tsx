import { useMemo, useState } from "react";
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Edit3,
  Plus,
  Repeat,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card, CardHeader } from "../../../components/ui/Card";
import {
  createReminder,
  deleteReminder,
  sendTestReminderEmail,
  updateReminder,
  type ReminderRecord,
  type ReminderCustomMode,
  type ReminderCustomUnit,
  type ReminderRepeat,
} from "./reminderApi";

type ReminderTone = "green" | "amber" | "cyan";

type RemindersPageProps = {
  userId?: string;
  reminders: ReminderRecord[];
  onRefresh: () => Promise<void>;
};

const daysOfWeek = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
] as const;

const repeatOptions: { value: ReminderRepeat; label: string }[] = [
  { value: "once", label: "Once" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "custom", label: "Custom" },
  ...daysOfWeek,
];

const demoReminderEmailDelayMs = 5000;
const demoReminderEmailTo = import.meta.env.VITE_DEMO_REMINDER_EMAIL_TO as string | undefined;
const demoReminderRecipientName = "Wen Yang";

export function RemindersPage({ userId, reminders, onRefresh }: RemindersPageProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<ReminderRecord | null>(null);
  const [deletingReminder, setDeletingReminder] = useState<ReminderRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const metrics = useMemo(() => reminderMetrics(reminders), [reminders]);

  function openCreateReminder() {
    setEditingReminder(null);
    setIsCreateOpen(true);
  }

  function openEditReminder(reminder: ReminderRecord) {
    setEditingReminder(reminder);
    setIsCreateOpen(true);
  }

  async function handleDelete() {
    if (!userId) {
      setError("Sign in before deleting reminders.");
      return;
    }
    if (!deletingReminder) {
      return;
    }
    setIsDeleting(true);
    setError(null);
    try {
      await deleteReminder(deletingReminder.reminder_id, userId);
      await onRefresh();
      setDeletingReminder(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete reminder.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className="grid gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">Reminders</h2>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ReminderMetric icon={Bell} label="Today" value={metrics.today.toString()} tone="cyan" />
        <ReminderMetric icon={CalendarClock} label="This week" value={metrics.thisWeek.toString()} tone="green" />
        <ReminderMetric icon={Repeat} label="Repeating" value={metrics.repeating.toString()} tone="amber" />
      </div>

      <div>
        <Card className="p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardHeader title="Upcoming reminders" subtitle="Edit or delete scheduled health actions." />
            <Button onClick={() => openCreateReminder()}>
              <Plus className="h-4 w-4" />
              New reminder
            </Button>
          </div>

          {error ? (
            <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm leading-6 text-red-700">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4">
            {reminders.length ? (
              reminders.map((reminder) => (
                <ReminderCard
                  key={reminder.reminder_id}
                  reminder={reminder}
                  onDelete={() => setDeletingReminder(reminder)}
                  onEdit={() => openEditReminder(reminder)}
                />
              ))
            ) : (
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-6">
                <h3 className="font-bold tracking-tight text-slate-950">No reminders yet</h3>
                <p className="mt-2 leading-7 text-slate-600">
                  Create a reminder for one practical action, such as a walk, blood pressure check, or weekly review.
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {isCreateOpen ? (
        <CreateReminderModal
          key={editingReminder?.reminder_id ?? "blank"}
          userId={userId}
          reminder={editingReminder}
          onCreated={async () => {
            await onRefresh();
            setIsCreateOpen(false);
            setEditingReminder(null);
          }}
          onClose={() => {
            setIsCreateOpen(false);
            setEditingReminder(null);
          }}
        />
      ) : null}
      {deletingReminder ? (
        <DeleteReminderModal
          reminder={deletingReminder}
          isDeleting={isDeleting}
          onClose={() => {
            if (!isDeleting) {
              setDeletingReminder(null);
            }
          }}
          onConfirm={handleDelete}
        />
      ) : null}
    </section>
  );
}

function DeleteReminderModal({
  reminder,
  isDeleting,
  onClose,
  onConfirm,
}: {
  reminder: ReminderRecord;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[28px] bg-white p-7 text-center shadow-2xl md:p-10">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-500">
          <Trash2 className="h-6 w-6" />
        </span>
        <div className="mt-5">
          <h2 className="text-xl font-bold tracking-tight text-slate-950 md:text-2xl">
            Are you sure you want to delete this reminder?
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            This will delete <span className="font-semibold text-slate-900">{reminder.title}</span>.
          </p>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-red-100 bg-red-100 px-5 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isDeleting ? "Deleting..." : "Delete reminder"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateReminderModal({
  userId,
  reminder,
  onCreated,
  onClose,
}: {
  userId?: string;
  reminder?: ReminderRecord | null;
  onCreated: () => Promise<void>;
  onClose: () => void;
}) {
  const initialDateTime = reminder ? new Date(reminder.reminder_time) : getMinimumReminderDateTime();
  const normalizedInitial = normalizeReminderDateTime(initialDateTime);
  const [title, setTitle] = useState(reminder?.title ?? "");
  const [date, setDate] = useState(() => formatDateInput(normalizedInitial));
  const [time, setTime] = useState(() => formatTimeInput(normalizedInitial));
  const [repeat, setRepeat] = useState<ReminderRepeat>(reminder?.repeat_interval ?? "once");
  const [customMode, setCustomMode] = useState<ReminderCustomMode>(reminder?.custom_mode ?? "interval");
  const [customInterval, setCustomInterval] = useState(() => String(reminder?.custom_interval ?? 1));
  const [customUnit, setCustomUnit] = useState<ReminderCustomUnit>(reminder?.custom_unit ?? "days");
  const [selectedDays, setSelectedDays] = useState<ReminderRepeat[]>(reminder?.selected_days ?? []);
  const [isDaysOpen, setIsDaysOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const minimumDateTime = getMinimumReminderDateTime();

  function handleRepeatChange(value: ReminderRepeat) {
    setRepeat(value);
    if (value !== "custom") {
      setCustomMode("interval");
      setCustomInterval("1");
      setCustomUnit("days");
      setSelectedDays([]);
      setIsDaysOpen(false);
    }
  }

  function handleCustomModeChange(value: ReminderCustomMode) {
    setCustomMode(value);
    if (value === "interval") {
      setSelectedDays([]);
      setIsDaysOpen(false);
    } else {
      setCustomInterval("1");
      setCustomUnit("days");
    }
  }

  function handleDateTimeChange(nextDate: string, nextTime: string) {
    setDate(nextDate);
    setTime(nextTime);
  }

  async function handleSave() {
    if (!userId) {
      setError("Sign in before creating reminders.");
      return;
    }
    if (!title.trim()) {
      setError("Enter a reminder title.");
      return;
    }
    const rawDateTime = new Date(`${date}T${time}`);
    if (!isReminderDateTimeValid(rawDateTime)) {
      setError("Reminder time cannot be earlier than the current time.");
      return;
    }
    const selectedDateTime = normalizeReminderDateTime(rawDateTime);
    if (selectedDateTime.getTime() !== rawDateTime.getTime()) {
      setDate(formatDateInput(selectedDateTime));
      setTime(formatTimeInput(selectedDateTime));
    }
    const normalizedRepeat = normalizeReminderPayload({
      repeat,
      customMode,
      customInterval,
      customUnit,
      selectedDays,
    });
    if ("error" in normalizedRepeat) {
      setError(normalizedRepeat.error);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const payload = {
        user_id: userId,
        title: title.trim(),
        reminder_time: selectedDateTime.toISOString(),
        ...normalizedRepeat.payload,
      };
      if (reminder) {
        await updateReminder(reminder.reminder_id, userId, payload);
      } else {
        const createdReminder = await createReminder(payload);
        window.setTimeout(() => {
          void sendTestReminderEmail(createdReminder.reminder_id, userId, demoReminderEmailTo, demoReminderRecipientName).catch((caught) => {
            console.error("Unable to send demo reminder email.", caught);
          });
        }, demoReminderEmailDelayMs);
      }
      await onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save reminder.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div className="relative max-h-[calc(100vh-4rem)] w-full max-w-lg overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl md:p-8">
        <button
          type="button"
          aria-label="Close reminder form"
          title="Close reminder form"
          onClick={onClose}
          className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="pr-10 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
            {reminder ? "Edit health reminder" : "Create a health reminder"}
          </h2>
        </div>

        <div className="mt-7 grid gap-4">
          <FormLabel label="Reminder title">
            <input
              className="form-input"
              value={title}
              placeholder="e.g. Evening walk"
              onChange={(event) => setTitle(event.target.value)}
            />
          </FormLabel>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormLabel label="Date">
              <input
                className="form-input"
                type="date"
                min={formatDateInput(minimumDateTime)}
                value={date}
                onChange={(event) => handleDateTimeChange(event.target.value, time)}
              />
            </FormLabel>
            <FormLabel label="Time">
              <input
                className="form-input"
                type="time"
                value={time}
                onChange={(event) => handleDateTimeChange(date, event.target.value)}
              />
            </FormLabel>
          </div>
          {!isReminderDateTimeValid(new Date(`${date}T${time}`)) ? (
            <p className="text-sm font-medium text-red-600">
              Reminder time cannot be earlier than the current time.
            </p>
          ) : null}
          <div>
            <span className="text-sm font-semibold text-slate-700">Repeat</span>
            <p className="mt-1 text-sm text-slate-500">Set a schedule for this reminder</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <select
                className="form-input"
                value={repeat}
                onChange={(event) => handleRepeatChange(event.target.value as ReminderRepeat)}
              >
                {repeatOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              {repeat === "custom" ? (
                <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={customMode === "selected_days"}
                    onClick={() => handleCustomModeChange(customMode === "selected_days" ? "interval" : "selected_days")}
                    className={`flex h-7 w-12 items-center rounded-full p-1 transition ${
                      customMode === "selected_days" ? "bg-cyan-600" : "bg-slate-200"
                    }`}
                  >
                    <span
                      className={`h-5 w-5 rounded-full bg-white shadow-sm transition ${
                        customMode === "selected_days" ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                  Custom days
                </label>
              ) : null}
            </div>
          </div>
          {repeat === "custom" ? (
            <div className="grid gap-4">
              {customMode === "interval" ? (
                <div className="grid gap-4 sm:grid-cols-[1fr_1.2fr]">
                  <FormLabel label="Every">
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      value={customInterval}
                      onChange={(event) => setCustomInterval(event.target.value)}
                    />
                  </FormLabel>
                  <label className="flex items-end">
                    <select className="form-input" value={customUnit} onChange={(event) => setCustomUnit(event.target.value as ReminderCustomUnit)}>
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                      <option value="weeks">Weeks</option>
                    </select>
                  </label>
                </div>
              ) : (
                <div className="relative">
                  <span className="text-sm font-semibold text-slate-700">Selected days</span>
                  <button
                    type="button"
                    onClick={() => setIsDaysOpen((current) => !current)}
                    className="mt-1 flex min-h-12 w-full flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700"
                  >
                    {selectedDays.length ? (
                      selectedDays.map((day) => (
                        <span key={day} className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
                          {dayLabel(day)}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400">Choose days</span>
                    )}
                  </button>
                  {isDaysOpen ? (
                    <div className="absolute bottom-full z-10 mb-2 grid w-full gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                      {daysOfWeek.map((day) => (
                        <label key={day.value} className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-cyan-50">
                          <input
                            type="checkbox"
                            checked={selectedDays.includes(day.value)}
                            onChange={() => setSelectedDays((current) => toggleDay(current, day.value))}
                          />
                          {day.label}
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm leading-6 text-red-700">
              {error}
            </div>
          ) : null}
          <Button className="mt-2 w-full" disabled={isSaving} onClick={handleSave}>
            {isSaving ? "Saving..." : reminder ? "Save reminder" : "Create reminder"}
            <CheckCircle2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ReminderSummary({
  reminders = [],
  onManage,
}: {
  reminders?: ReminderRecord[];
  onManage?: () => void;
}) {
  const upcoming = reminders.filter((reminder) => reminder.status === "scheduled").slice(0, 2);

  return (
    <Card className="p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <CardHeader title="Reminders" subtitle="Today" />
        <Button variant="ghost" onClick={onManage}>Manage</Button>
      </div>
      <div className="grid gap-3">
        {upcoming.length ? (
          upcoming.map((reminder) => (
            <div key={reminder.reminder_id} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
              <span className="grid h-9 w-9 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
                <Bell className="h-4 w-4" />
              </span>
              <div>
                <strong className="block text-sm text-slate-900">{reminder.title}</strong>
                <p className="mt-1 text-xs text-slate-500">{formatReminderTime(reminder.reminder_time)}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            No upcoming reminders yet.
          </div>
        )}
      </div>
    </Card>
  );
}

function ReminderCard({
  reminder,
  onDelete,
  onEdit,
}: {
  reminder: ReminderRecord;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const tone = reminderTone(reminder);
  return (
    <article className="rounded-[20px] border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-4">
          <div className={`grid h-16 w-16 shrink-0 place-items-center rounded-3xl ${toneClass(tone)}`}>
            <Bell className="h-7 w-7" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold tracking-tight text-slate-900">{reminder.title}</h3>
              <Badge tone={tone}>{reminderStatusLabel(reminder)}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <ReminderPill icon={CalendarClock} label={formatReminderDate(reminder.reminder_time)} />
              <ReminderPill icon={Clock3} label={formatReminderTime(reminder.reminder_time)} />
              <ReminderPill icon={Repeat} label={repeatLabel(reminder.repeat_interval)} />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <ReminderActionButton tone="edit" label="Edit" onClick={onEdit} icon={Edit3} />
          <ReminderActionButton tone="delete" label="Delete" onClick={onDelete} icon={Trash2} />
        </div>
      </div>
    </article>
  );
}

function ReminderActionButton({
  tone,
  label,
  onClick,
  icon: Icon,
}: {
  tone: "edit" | "delete";
  label: string;
  onClick: () => void;
  icon: typeof Bell;
}) {
  const toneClassName =
    tone === "edit"
      ? "border-blue-100 bg-blue-50 text-blue-700 hover:border-blue-200 hover:bg-blue-100"
      : "border-red-100 bg-red-50 text-red-700 hover:border-red-200 hover:bg-red-100";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition ${toneClassName}`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function ReminderPill({ icon: Icon, label }: { icon: typeof Bell; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
      <Icon className="h-3.5 w-3.5 text-cyan-700" />
      {label}
    </span>
  );
}

function ReminderMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Bell;
  label: string;
  value: string;
  tone: ReminderTone;
}) {
  return (
    <Card className="p-5">
      <div className={`grid h-11 w-11 place-items-center rounded-2xl ${toneClass(tone)}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-500">{label}</p>
      <strong className="mt-1 block text-3xl font-bold tracking-tight text-slate-950">{value}</strong>
    </Card>
  );
}

function toneClass(tone: ReminderTone) {
  return {
    cyan: "bg-cyan-50 text-cyan-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
  }[tone];
}

function FormLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function reminderMetrics(reminders: ReminderRecord[]) {
  const today = new Date();
  const weekFromNow = new Date();
  weekFromNow.setDate(today.getDate() + 7);

  return reminders.reduce(
    (acc, reminder) => {
      if (reminder.status !== "scheduled") {
        return acc;
      }
      const reminderDate = new Date(reminder.reminder_time);
      if (reminderDate.toDateString() === today.toDateString()) {
        acc.today += 1;
      }
      if (reminderDate >= today && reminderDate <= weekFromNow) {
        acc.thisWeek += 1;
      }
      if (reminder.repeat_interval !== "once") {
        acc.repeating += 1;
      }
      return acc;
    },
    { today: 0, thisWeek: 0, repeating: 0 },
  );
}

function reminderTone(reminder: ReminderRecord): ReminderTone {
  if (reminder.status === "completed") {
    return "green";
  }
  const now = new Date();
  const reminderDate = new Date(reminder.reminder_time);
  if (reminderDate.toDateString() === now.toDateString()) {
    return "cyan";
  }
  return "amber";
}

function reminderStatusLabel(reminder: ReminderRecord) {
  if (reminder.status === "completed") {
    return "Completed";
  }
  const now = new Date();
  const reminderDate = new Date(reminder.reminder_time);
  if (reminderDate.toDateString() === now.toDateString()) {
    return "Due today";
  }
  return "Upcoming";
}

function repeatLabel(value: ReminderRepeat) {
  return repeatOptions.find((option) => option.value === value)?.label ?? "Once";
}

function dayLabel(value: ReminderRepeat) {
  return daysOfWeek.find((day) => day.value === value)?.label ?? value;
}

function toggleDay(current: ReminderRepeat[], day: ReminderRepeat) {
  return current.includes(day) ? current.filter((item) => item !== day) : [...current, day];
}

function getMinimumReminderDateTime(now = new Date()) {
  return now;
}

function isReminderDateTimeValid(value: Date) {
  return toMinuteTimestamp(value) >= toMinuteTimestamp(new Date());
}

function normalizeReminderDateTime(value: Date) {
  return value;
}

function toMinuteTimestamp(value: Date) {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
    value.getHours(),
    value.getMinutes(),
  ).getTime();
}

function formatDateInput(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function formatTimeInput(value: Date) {
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

function normalizeReminderPayload({
  repeat,
  customMode,
  customInterval,
  customUnit,
  selectedDays,
}: {
  repeat: ReminderRepeat;
  customMode: ReminderCustomMode;
  customInterval: string;
  customUnit: ReminderCustomUnit;
  selectedDays: ReminderRepeat[];
}):
  | { payload: { repeat_interval: ReminderRepeat; custom_mode?: ReminderCustomMode; custom_interval?: number; custom_unit?: ReminderCustomUnit; selected_days?: ReminderRepeat[] } }
  | { error: string } {
  if (repeat !== "custom") {
    return { payload: { repeat_interval: repeat } };
  }
  if (customMode === "interval") {
    const interval = Number(customInterval);
    if (!Number.isFinite(interval) || interval <= 0) {
      return { error: "Enter a custom interval greater than 0." };
    }
    return {
      payload: {
        repeat_interval: "custom",
        custom_mode: "interval",
        custom_interval: interval,
        custom_unit: customUnit,
        selected_days: [],
      },
    };
  }
  if (!selectedDays.length) {
    return { error: "Choose at least one day for the custom reminder." };
  }
  return {
    payload: {
      repeat_interval: "custom",
      custom_mode: "selected_days",
      selected_days: selectedDays,
    },
  };
}

function formatReminderDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatReminderTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    timeStyle: "short",
  }).format(new Date(value));
}
