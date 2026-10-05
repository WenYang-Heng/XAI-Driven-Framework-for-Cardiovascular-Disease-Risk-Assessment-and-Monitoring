import { useEffect, useState } from 'react';
import { ArrowRight, Loader2, RotateCcw } from 'lucide-react';
import type { FeatureKey, RiskLevel, WhatIfResult } from '../types';
import { featureMeta } from '../constants';
import { ApiError, clinicianApi } from '../api';
import { percent, riskLabel, riskTone } from '../utils';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardHeader } from '../../../components/ui/Card';
import { ErrorBanner } from './Shared';

type SliderKey = "cigs_per_day" | "sys_bp" | "dia_bp" | "tot_chol" | "bmi" | "glucose" | "heart_rate";

// Slider ranges cover realistic treatment targets, widened to include the patient's own value.
const sliders: { key: SliderKey; min: number; max: number; step: number; target?: string }[] = [
  { key: "sys_bp", min: 90, max: 200, step: 1, target: "< 130 mmHg" },
  { key: "dia_bp", min: 50, max: 120, step: 1, target: "< 80 mmHg" },
  { key: "tot_chol", min: 120, max: 350, step: 5, target: "< 200 mg/dL" },
  { key: "bmi", min: 16, max: 45, step: 0.5, target: "18.5–25" },
  { key: "glucose", min: 60, max: 250, step: 1 },
  { key: "heart_rate", min: 45, max: 120, step: 1 },
  { key: "cigs_per_day", min: 0, max: 60, step: 1 },
];

export function WhatIfPanel({
  clinicianId,
  resultId,
  baseline,
  baselineRisk,
  baselineLevel,
}: {
  clinicianId: string;
  resultId: string;
  baseline: Partial<Record<FeatureKey, number>>;
  baselineRisk: number;
  baselineLevel: RiskLevel;
}) {
  const [values, setValues] = useState<Partial<Record<FeatureKey, number>>>(baseline);
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const changes = Object.fromEntries(
    (Object.entries(values) as [FeatureKey, number][]).filter(([key, value]) => baseline[key] !== value),
  ) as Partial<Record<FeatureKey, number>>;
  const changeKey = JSON.stringify(changes);
  const hasChanges = Object.keys(changes).length > 0;

  useEffect(() => {
    if (!hasChanges) {
      setResult(null);
      setError(null);
      return;
    }
    let current = true;
    // Wait for the slider to settle before re-scoring.
    const timer = window.setTimeout(() => {
      setIsLoading(true);
      clinicianApi
        .whatIf(clinicianId, resultId, JSON.parse(changeKey))
        .then((body) => {
          if (current) {
            setResult(body);
            setError(null);
          }
        })
        .catch((caught: ApiError) => current && setError(caught))
        .finally(() => current && setIsLoading(false));
    }, 350);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [clinicianId, resultId, changeKey, hasChanges]);

  const isSmoker = values.current_smoker === 1;
  const set = (key: FeatureKey, value: number) =>
    setValues((current) => ({
      ...current,
      [key]: value,
      ...(key === "current_smoker" && value === 0 ? { cigs_per_day: 0 } : {}),
      ...(key === "current_smoker" && value === 1 && !current.cigs_per_day ? { cigs_per_day: baseline.cigs_per_day || 10 } : {}),
    }));

  const shownRisk = result?.risk_score ?? baselineRisk;
  const shownLevel = result?.risk_level ?? baselineLevel;
  const points = result ? Math.round(result.change * 1000) / 10 : 0;

  return (
    <Card className="p-6 print:hidden">
      <CardHeader
        title="What if?"
        subtitle="Change the factors that treatment or lifestyle can affect, and see the same model's new estimate. Nothing is saved."
        action={
          hasChanges ? (
            <Button variant="secondary" onClick={() => setValues(baseline)}>
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          ) : null
        }
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          {baseline.current_smoker === 1 || isSmoker ? (
            <label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-800">
              <input
                type="checkbox"
                className="h-4 w-4 accent-cyan-600"
                checked={!isSmoker}
                onChange={(event) => set("current_smoker", event.target.checked ? 0 : 1)}
              />
              Quits smoking
            </label>
          ) : null}
          {sliders
            .filter((slider) => slider.key !== "cigs_per_day" || isSmoker)
            .map((slider) => {
              const value = values[slider.key] ?? 0;
              const original = baseline[slider.key] ?? 0;
              const min = Math.min(slider.min, original);
              const max = Math.max(slider.max, original);
              const changed = value !== original;
              return (
                <div key={slider.key}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-semibold text-slate-800">{featureMeta[slider.key].label}</span>
                    <span className={changed ? "font-bold text-cyan-700" : "text-slate-600"}>
                      {changed ? `${original} → ` : ""}
                      {value} {featureMeta[slider.key].unit}
                    </span>
                  </div>
                  <input
                    type="range"
                    className="mt-2 w-full accent-cyan-600"
                    min={min}
                    max={max}
                    step={slider.step}
                    value={value}
                    onChange={(event) => set(slider.key, Number(event.target.value))}
                    aria-label={featureMeta[slider.key].label}
                  />
                  {slider.target ? <p className="text-xs text-slate-400">Typical target {slider.target}</p> : null}
                </div>
              );
            })}
        </div>

        <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-5 text-center xl:self-start">
          <p className="text-xs font-bold uppercase text-slate-500">10-year CHD risk</p>
          <div className="mt-3 flex items-center justify-center gap-3">
            <span className="text-xl font-semibold text-slate-400">{percent(baselineRisk)}</span>
            <ArrowRight className="h-5 w-5 text-slate-400" />
            <span className="text-4xl font-bold text-slate-950">
              {isLoading ? <Loader2 className="h-8 w-8 animate-spin text-cyan-600" /> : percent(shownRisk)}
            </span>
          </div>
          <div className="mt-3">
            <Badge tone={riskTone(shownLevel)}>{riskLabel(shownLevel)} risk</Badge>
          </div>
          {result && !isLoading ? (
            <p className={`mt-3 text-sm font-semibold ${points < 0 ? "text-emerald-700" : points > 0 ? "text-red-700" : "text-slate-600"}`}>
              {points === 0 ? "No change" : `${points > 0 ? "+" : ""}${points} percentage points`}
            </p>
          ) : (
            <p className="mt-3 text-sm text-slate-500">{hasChanges ? "Calculating…" : "Move a slider to compare"}</p>
          )}
          <p className="mt-4 text-xs leading-5 text-slate-500">
            This shows how the model responds, not a proven treatment effect.
          </p>
        </div>
      </div>

      {error ? <div className="mt-5"><ErrorBanner message={error.message} details={error.details} /></div> : null}
    </Card>
  );
}
