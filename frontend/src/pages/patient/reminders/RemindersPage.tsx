import { useState } from "react";
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

type ReminderTone = "green" | "amber" | "cyan";

type Reminder = {
  title: string;
  time: string;
  linked: string;
  repeat: string;
  status: string;
  tone: ReminderTone;
};

const reminders: Reminder[] = [
  {
    title: "Evening walk",
    time: "Today, 6:00 PM",
    linked: "Walk 8,000 steps daily",
    repeat: "Daily",
    status: "Due today",
    tone: "cyan",
  },
  {
    title: "Blood pressure check",
    time: "Tomorrow, 9:00 AM",
    linked: "Monitoring",
    repeat: "Twice weekly",
    status: "Upcoming",
    tone: "amber",
  },
  {
    title: "Weekly goal review",
    time: "Sunday, 8:00 PM",
    linked: "Goal progress",
    repeat: "Weekly",
    status: "Scheduled",
    tone: "green",
  },
];

const reminderTemplates = [
  "Take a blood pressure reading",
  "Go for a planned walk",
  "Review weekly goal progress",
];

export function RemindersPage() {
  const [view, setView] = useState<"overview" | "create">("overview");

  if (view === "create") {
    return <CreateReminderPage onBack={() => setView("overview")} />;
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
        <ReminderMetric icon={Bell} label="Today" value="1" tone="cyan" />
        <ReminderMetric icon={CalendarClock} label="This week" value="3" tone="green" />
        <ReminderMetric icon={Repeat} label="Repeating" value="3" tone="amber" />
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

          <div className="grid gap-4">
            {reminders.map((reminder) => (
              <ReminderCard key={reminder.title} reminder={reminder} />
            ))}
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

function CreateReminderPage({ onBack }: { onBack: () => void }) {
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
            <input className="form-input" placeholder="e.g. Evening walk" />
          </FormLabel>
          <FormLabel label="Related goal">
            <select className="form-input">
              <option>Walk 8,000 steps daily</option>
              <option>Reduce salty food</option>
              <option>Blood pressure check</option>
            </select>
          </FormLabel>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormLabel label="Date">
              <input className="form-input" type="date" />
            </FormLabel>
            <FormLabel label="Time">
              <input className="form-input" type="time" />
            </FormLabel>
          </div>
          <FormLabel label="Repeat">
            <select className="form-input">
              <option>Daily</option>
              <option>Weekly</option>
              <option>Once</option>
            </select>
          </FormLabel>
          <Button className="w-full">
            Create reminder
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

export function ReminderSummary() {
  return (
    <Card className="p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <CardHeader title="Reminders" subtitle="Today" />
        <Button variant="ghost">Manage</Button>
      </div>
      <div className="grid gap-3">
        {reminders.slice(0, 2).map((reminder) => (
          <div key={reminder.title} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
              <Bell className="h-4 w-4" />
            </span>
            <div>
              <strong className="block text-sm text-slate-900">{reminder.title}</strong>
              <p className="mt-1 text-xs text-slate-500">{reminder.time}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ReminderCard({ reminder }: { reminder: Reminder }) {
  return (
    <article className="rounded-[20px] border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-4">
          <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${toneClass(reminder.tone)}`}>
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold tracking-tight text-slate-900">{reminder.title}</h3>
              <Badge tone={reminder.tone}>{reminder.status}</Badge>
            </div>
            <p className="mt-2 flex items-center gap-2 text-slate-600">
              <Clock3 className="h-4 w-4 text-slate-400" />
              {reminder.time}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <IconButton label="Edit reminder">
            <Edit3 className="h-4 w-4" />
          </IconButton>
          <IconButton label="Complete reminder">
            <CheckCircle2 className="h-4 w-4" />
          </IconButton>
          <IconButton label="Delete reminder">
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
          <p className="mt-2">{reminder.linked}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
          <span className="flex items-center gap-2 font-semibold text-slate-900">
            <Repeat className="h-4 w-4 text-cyan-700" />
            Repeat
          </span>
          <p className="mt-2">{reminder.repeat}</p>
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

function IconButton({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="grid h-10 w-10 place-items-center rounded-2xl border border-slate-200 text-slate-500 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"
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
