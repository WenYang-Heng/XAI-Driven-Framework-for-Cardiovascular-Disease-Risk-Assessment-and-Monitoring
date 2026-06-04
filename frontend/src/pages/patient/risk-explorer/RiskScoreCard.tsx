import { Badge } from "../../../components/ui/Badge";
import type { RiskCategory } from "./types";

type RiskScoreCardProps = {
  score: number;
  category: RiskCategory;
};

const categoryTheme = {
  green: {
    header: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700",
    message:
      "Your risk is currently in the lower range. Keeping healthy routines consistent can help maintain this result.",
  },
  amber: {
    header: "bg-orange-500",
    badge: "bg-amber-100 text-orange-700",
    message:
      "Your risk is not in the highest category, but improving blood pressure and activity level may help reduce it.",
  },
  red: {
    header: "bg-red-500",
    badge: "bg-red-50 text-red-700",
    message:
      "Your risk is in the higher range. Consider discussing this result with a healthcare professional and focus on safer, gradual changes.",
  },
};

export function RiskScoreCard({ score, category }: RiskScoreCardProps) {
  const theme = categoryTheme[category.tone];
  const markerPosition = Math.min(100, Math.max(0, (score / 30) * 100));

  return (
    <article className="overflow-hidden rounded-[32px] border border-amber-200 bg-white shadow-soft">
      <div className={`${theme.header} px-7 py-6 text-white`}>
        <p className="text-base font-medium md:text-lg">Risk category</p>
        <h3 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
          {category.label}
        </h3>
      </div>

      <div className="px-7 py-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-base font-medium text-slate-500 md:text-lg">Estimated score</p>
            <strong className="mt-2 block text-5xl font-semibold tracking-tight text-slate-950 md:text-6xl">
              {score}%
            </strong>
          </div>
          <span className={`w-fit rounded-full px-5 py-2 text-base font-bold ${theme.badge}`}>
            {category.tone === "green" ? "On track" : category.tone === "amber" ? "Needs attention" : "High attention"}
          </span>
        </div>

        <div className="mt-8">
          <div className="relative h-4 rounded-full bg-gradient-to-r from-emerald-400 via-yellow-400 via-orange-400 to-red-500">
            <div
              className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-white/80"
              style={{ left: "33.33%" }}
            />
            <div
              className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-white/80"
              style={{ left: "66.66%" }}
            />
            <div
              className="absolute top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-slate-950 shadow-lg"
              style={{ left: `${markerPosition}%` }}
            />
          </div>

          <div className="mt-4 grid grid-cols-3 text-base font-medium text-slate-500">
            <span>Low</span>
            <span className="text-center">Moderate</span>
            <span className="text-right">High</span>
          </div>
          <div className="mt-3 grid grid-cols-4 text-sm text-slate-400">
            <span>0%</span>
            <span className="text-center">10%</span>
            <span className="text-center">20%</span>
            <span className="text-right">30%+</span>
          </div>
        </div>

        <p className="mx-auto mt-6 max-w-xl text-center text-sm leading-6 text-slate-500">
          The scale uses a smooth gradient from low to high risk. Scores above 30% are shown at the end of the scale.
        </p>

        <p className="mt-7 text-lg leading-8 text-slate-800 md:text-xl">
          {theme.message}
        </p>

        <div className="mt-6">
          <Badge tone={category.tone}>Estimated risk, not a diagnosis</Badge>
        </div>
      </div>
    </article>
  );
}
