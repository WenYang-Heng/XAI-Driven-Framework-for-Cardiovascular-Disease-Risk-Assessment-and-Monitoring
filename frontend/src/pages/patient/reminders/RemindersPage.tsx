import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Edit3,
  Link2,
  Plus,
  Repeat,
  Trash2,
} from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card, CardHeader } from "../../../components/ui/Card";
import {
  completeReminder,
  createReminder,
  deleteReminder,
  type ReminderRecord,
  type ReminderRepeat,
} from "./reminderApi";

type ReminderTone = "green" | "amber" | "cyan";

type RemindersPageProps = {
  userId?: string;
  reminders: ReminderRecord[];
  onRefresh: () => Promise<void>;
};

const reminderTemplates = [
  "Take a blood pressure reading",
  "Go for a planned walk",
  "Review weekly goal progress",
];

export function RemindersPage({ userId, reminders, onRefresh }: RemindersPageProps) {
  const [view, setView] = useState<"overview" | "create">("overview");
  const [error, setError] = useState<string | null>(null);

  const metrics = useMemo(() => reminderMetrics(reminders), [reminders]);

  async function handleComplete(reminderId: string) {
    if (!userId) {
      setError("Sign in before updating reminders.");
      return;
    }
    try {
      await completeReminder(reminderId, userId);
      await onRefresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update reminder.");
    }
  }

  async function handleDelete(reminderId: string) {
    if (!userId) {
      setError("Sign in before deleting reminders.");
      return;
    }
    try {
      await deleteReminder(reminderId, userId);
      await onRefresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete reminder.");
    }
  }

  if (view === "create") {
    return (
      <CreateReminderPage
        userId={userId}
        onCreated={async () => {
          await onRefresh();
          setView("overview");
        }}
        onBack={() => setView("overview")}
      />
    );
  }

  return (
    <section className="grid gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-cyan-700">Reminder management</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
            Plan health reminders
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Link reminders to goals and action plans so important health tasks are easy to remember and simple to manage.
          </p>
        </div>
        <Button onClick={() => setView("create")}>
          <Plus className="h-4 w-4" />
          New reminder
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ReminderMetric icon={Bell} label="Today" value={metrics.today.toString()} tone="cyan" />
        <ReminderMetric icon={CalendarClock} label="This week" value={metrics.thisWeek.toString()} tone="green" />
        <ReminderMetric icon={Repeat} label="Repeating" value={metrics.repeating.toString()} tone="amber" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.8fr]">
        <Card className="p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardHeader title="Upcoming reminders" subtitle="Edit, complete, or delete scheduled health actions." />
            <div className="flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
              <button className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-950 shadow-sm">
                List
              </button>
              <button className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500">
                Calendar
              </button>
            </div>
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
                  onComplete={() => handleComplete(reminder.reminder_id)}
                  onDelete={() => handleDelete(reminder.reminder_id)}
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

        <div className="grid gap-6">
          <Card className="p-6">
            <CardHeader title="Quick templates" subtitle="Create common reminders faster." />
            <div className="mt-5 grid gap-3">
              {reminderTemplates.map((template) => (
                <button
                  key={template}
                  onClick={() => setView("create")}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left text-sm font-semibold text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50"
                >
                  <span>{template}</span>
                  <Plus className="h-4 w-4 text-cyan-700" />
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

function CreateReminderPage({
  userId,
  onCreated,
  onBack,
}: {
  userId?: string;
  onCreated: () => Promise<void>;
  onBack: () => void;
}) {
  const [title, setTitle] = useState("");
  const [linkedItem, setLinkedItem] = useState("Action plan");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("09:00");
  const [repeat, setRepeat] = useState<ReminderRepeat>("none");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!userId) {
      setError("Sign in before creating reminders.");
      return;
    }
    if (!title.trim()) {
      setError("Enter a reminder title.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await createReminder({
        user_id: userId,
        title: title.trim(),
        description: linkedItem ? `Linked to ${linkedItem}` : undefined,
        reminder_time: new Date(`${date}T${time}`).toISOString(),
        linked_item: linkedItem,
        repeat_interval: repeat,
      });
      await onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create reminder.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="grid gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-cyan-700">Reminder management</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
            Create a health reminder
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Schedule a reminder and connect it to a goal or action plan so the next step is easier to follow.
          </p>
        </div>
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back to reminders
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.8fr]">
        <Card className="grid content-start gap-4 p-6">
          <CardHeader title="Reminder details" subtitle="Connect it to a goal or action." />
          <FormLabel label="Reminder title">
            <input
              className="form-input"
              value={title}
              placeholder="e.g. Evening walk"
              onChange={(event) => setTitle(event.target.value)}
            />
          </FormLabel>
          <FormLabel label="Related goal">
            <select className="form-input" value={linkedItem} onChange={(event) => setLinkedItem(event.target.value)}>
              <option>Action plan</option>
              <option>Walking goal</option>
              <option>Lower-salt meal</option>
              <option>Blood pressure check</option>
              <option>Weekly review</option>
            </select>
          </FormLabel>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormLabel label="Date">
              <input className="form-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </FormLabel>
            <FormLabel label="Time">
              <input className="form-input" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
            </FormLabel>
          </div>
          <FormLabel label="Repeat">
            <select className="form-input" value={repeat} onChange={(event) => setRepeat(event.target.value as ReminderRepeat)}>
              <option value="none">Once</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="twice_weekly">Twice weekly</option>
            </select>
          </FormLabel>
          {error ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm leading-6 text-red-700">
              {error}
            </div>
          ) : null}
          <Button className="w-full" disabled={isSaving} onClick={handleCreate}>
            {isSaving ? "Creating..." : "Create reminder"}
            <CheckCircle2 className="h-4 w-4" />
          </Button>
        </Card>

        <Card className="p-6">
          <CardHeader title="Quick templates" subtitle="Use common health actions as a starting point." />
          <div className="mt-5 grid gap-3">
            {reminderTemplates.map((template) => (
              <div key={template} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">
                {template}
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-2xl border border-cyan-100 bg-cyan-50 p-4 text-sm leading-6 text-cyan-800">
            Link reminders to actions that are realistic and safe to repeat.
          </div>
        </Card>
      </div>
    </section>
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
  onComplete,
  onDelete,
}: {
  reminder: ReminderRecord;
  onComplete: () => void;
  onDelete: () => void;
}) {
  const tone = reminderTone(reminder);
  return (
    <article className="rounded-[20px] border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-4">
          <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${toneClass(tone)}`}>
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold tracking-tight text-slate-900">{reminder.title}</h3>
              <Badge tone={tone}>{reminderStatusLabel(reminder)}</Badge>
            </div>
            <p className="mt-2 flex items-center gap-2 text-slate-600">
              <Clock3 className="h-4 w-4 text-slate-400" />
              {formatReminderTime(reminder.reminder_time)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <IconButton label="Edit reminder">
            <Edit3 className="h-4 w-4" />
          </IconButton>
          <IconButton label="Complete reminder" onClick={onComplete} disabled={reminder.status === "completed"}>
            <CheckCircle2 className="h-4 w-4" />
          </IconButton>
          <IconButton label="Delete reminder" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
          <span className="flex items-center gap-2 font-semibold text-slate-900">
            <Link2 className="h-4 w-4 text-cyan-700" />
            Linked to
          </span>
          <p className="mt-2">{reminder.linked_item || "General health reminder"}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
          <span className="flex items-center gap-2 font-semibold text-slate-900">
            <Repeat className="h-4 w-4 text-cyan-700" />
            Repeat
          </span>
          <p className="mt-2">{repeatLabel(reminder.repeat_interval)}</p>
        </div>
      </div>
    </article>
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

function IconButton({
  label,
  children,
  onClick,
  disabled = false,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-10 w-10 place-items-center rounded-2xl border border-slate-200 text-slate-500 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
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
      if (reminder.repeat_interval !== "none") {
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
  return {
    none: "Once",
    daily: "Daily",
    weekly: "Weekly",
    twice_weekly: "Twice weekly",
  }[value];
}

function formatReminderTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
