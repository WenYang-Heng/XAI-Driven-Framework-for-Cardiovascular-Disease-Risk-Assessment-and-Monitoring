import { AlertCircle } from "lucide-react";
import type { RiskCategory } from "./types";

type RiskScoreCardProps = {
  score: number;
  category: RiskCategory;
  lastAssessedAt?: string | null;
};

const categoryTheme = {
  green: {
    badge: "bg-emerald-50 text-emerald-700",
    message:
      "Your risk is currently in the lower range. Keeping healthy routines consistent can help maintain this result.",
  },
  amber: {
    badge: "bg-amber-100 text-orange-700",
    message:
      "Your risk is not in the highest category, but improving blood pressure and activity level may help reduce it.",
  },
  red: {
    badge: "bg-red-50 text-red-700",
    message:
      "Your risk is in the higher range. Consider discussing this result with a healthcare professional and focus on safer, gradual changes.",
  },
};

export function RiskScoreCard({ score, category, lastAssessedAt }: RiskScoreCardProps) {
  const theme = categoryTheme[category.tone];
  const markerPosition = Math.min(100, Math.max(0, score));

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-soft">
      <div className="flex h-full flex-col px-7 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-950 md:text-base">
              Probability of developing cardiovascular disease
            </p>
            <strong className="mt-2 block text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
              {score}%
            </strong>
            <span className={`mt-3 inline-flex w-fit rounded-full px-4 py-1.5 text-sm font-bold ${theme.badge}`}>
              {category.label}
            </span>
          </div>
          {lastAssessedAt ? (
            <div className="shrink-0 rounded-2xl bg-slate-50 px-4 py-2 text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Last assessed</p>
              <p className="mt-1 text-sm font-bold text-slate-700">{formatLastAssessed(lastAssessedAt)}</p>
            </div>
          ) : null}
        </div>

        <div className="mt-6">
          <div className="relative h-2.5 rounded-full bg-gradient-to-r from-emerald-400 via-amber-300 to-red-400 shadow-inner">
            <span
              className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-white/80"
              style={{ left: "30%" }}
            />
            <span
              className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-white/80"
              style={{ left: "70%" }}
            />
            <span
              className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-slate-950 shadow-md"
              style={{ left: `${markerPosition}%` }}
            />
          </div>
          <div className="relative mt-4 h-6 text-sm font-medium leading-6 text-slate-600">
            <span className="absolute left-0 text-xs font-medium leading-6 text-slate-400">0%</span>
            <span className="absolute -translate-x-1/2 text-slate-600" style={{ left: "15%" }}>Low</span>
            <span className="absolute -translate-x-1/2 text-xs font-medium leading-6 text-slate-400" style={{ left: "30%" }}>30%</span>
            <span className="absolute -translate-x-1/2 text-slate-600" style={{ left: "50%" }}>Moderate</span>
            <span className="absolute -translate-x-1/2 text-xs font-medium leading-6 text-slate-400" style={{ left: "70%" }}>70%</span>
            <span className="absolute -translate-x-1/2 text-slate-600" style={{ left: "85%" }}>High</span>
            <span className="absolute right-0 text-xs font-medium leading-6 text-slate-400">100%</span>
          </div>
        </div>

        <p className="mt-6 text-base leading-7 text-slate-800 md:text-lg">
          {theme.message}
        </p>

        <div className="mt-auto flex items-start gap-3 rounded-2xl border border-cyan-100 bg-cyan-50 px-5 py-4 text-sm leading-6 text-cyan-900">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" />
          <div>
            <p className="leading-5 font-bold">Disclaimer</p>
            <p className="mt-1 text-cyan-800">
              This result is an estimate for health awareness only. It is not a medical diagnosis and should not replace advice from a healthcare professional. If your result is high, unclear, or you have concerning symptoms, please seek professional medical advice.
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

function formatLastAssessed(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value));
}
