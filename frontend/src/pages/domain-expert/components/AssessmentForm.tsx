import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, Play } from 'lucide-react';
import type { AssessmentRunResponse, FeatureKey, HistoryKey, MeasurementInput, Prefill } from '../types';
import { featureMeta, historyKeys } from '../constants';
import { ApiError, clinicianApi } from '../api';
import { formatFeatureValue } from '../utils';
import { Button } from '../../../components/ui/Button';
import { Card, CardHeader } from '../../../components/ui/Card';
import { ErrorBanner, LoadingCard, SelectField, SourceTag, TextField } from './Shared';

type ReadingKey = "sys_bp" | "dia_bp" | "heart_rate" | "height_cm" | "weight_kg" | "tot_chol" | "glucose";

const vitalFields: { key: ReadingKey; label: string; unit: string; feature?: FeatureKey }[] = [
  { key: "sys_bp", label: "Systolic BP", unit: "mmHg", feature: "sys_bp" },
  { key: "dia_bp", label: "Diastolic BP", unit: "mmHg", feature: "dia_bp" },
  { key: "heart_rate", label: "Resting heart rate", unit: "bpm", feature: "heart_rate" },
  { key: "height_cm", label: "Height", unit: "cm" },
  { key: "weight_kg", label: "Weight", unit: "kg" },
];
const labFields: { key: ReadingKey; label: string; unit: string; feature: FeatureKey }[] = [
  { key: "tot_chol", label: "Total cholesterol", unit: "mg/dL", feature: "tot_chol" },
  { key: "glucose", label: "Glucose", unit: "mg/dL", feature: "glucose" },
];
const readingRanges: Record<ReadingKey, [number, number]> = {
  sys_bp: [70, 300],
  dia_bp: [40, 160],
  heart_rate: [30, 200],
  height_cm: [100, 250],
  weight_kg: [25, 300],
  tot_chol: [80, 700],
  glucose: [40, 500],
};

export function AssessmentForm({
  clinicianId,
  patientCaseId,
  onCompleted,
  onCancel,
}: {
  clinicianId: string;
  patientCaseId: string;
  onCompleted: (result: AssessmentRunResponse) => void;
  onCancel: () => void;
}) {
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [readings, setReadings] = useState<Partial<Record<ReadingKey, string>>>({});
  const [history, setHistory] = useState<Partial<Record<HistoryKey, string>>>({});
  const [historyConfirmed, setHistoryConfirmed] = useState(false);
  const [visitLabel, setVisitLabel] = useState("");
  const [submitError, setSubmitError] = useState<ApiError | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let current = true;
    clinicianApi
      .prefill(clinicianId, patientCaseId)
      .then((body) => {
        if (!current) {
          return;
        }
        setPrefill(body);
        setHistory(
          Object.fromEntries(
            historyKeys.map((key) => [key, body.fields[key].value === null ? "" : String(body.fields[key].value)]),
          ),
        );
      })
      .catch((caught: ApiError) => current && setLoadError(caught));
    return () => {
      current = false;
    };
  }, [clinicianId, patientCaseId]);

  const bmiPreview = useMemo(() => {
    const height = Number(readings.height_cm);
    const weight = Number(readings.weight_kg);
    return height && weight ? Math.round((weight / (height / 100) ** 2) * 10) / 10 : null;
  }, [readings.height_cm, readings.weight_kg]);

  if (loadError) {
    return <ErrorBanner message={loadError.message} details={loadError.details} />;
  }
  if (!prefill) {
    return <LoadingCard label="Loading the patient's latest values…" />;
  }

  const readingErrors = Object.fromEntries(
    (Object.entries(readings) as [ReadingKey, string][])
      .filter(([, value]) => value !== "")
      .map(([key, value]) => {
        const [low, high] = readingRanges[key];
        const number = Number(value);
        return [key, Number.isFinite(number) && number >= low && number <= high ? null : `Enter a value between ${low} and ${high}.`];
      })
      .filter(([, message]) => message),
  ) as Partial<Record<ReadingKey, string>>;

  const providedToday = new Set<FeatureKey>([
    ...(Object.entries(readings) as [ReadingKey, string][])
      .filter(([key, value]) => value !== "" && !readingErrors[key])
      .flatMap(([key]) => (key === "height_cm" || key === "weight_kg" ? [] : [key as FeatureKey])),
    ...(bmiPreview ? (["bmi"] as FeatureKey[]) : []),
    ...historyKeys.filter((key) => history[key] !== ""),
  ]);
  const stillMissing = prefill.missing.filter((key) => !providedToday.has(key));
  const staleNotUpdated = prefill.stale.filter((key) => !providedToday.has(key));
  const historyChanged = historyKeys.some(
    (key) => history[key] !== "" && String(prefill.fields[key].value ?? "") !== history[key],
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (stillMissing.length || Object.keys(readingErrors).length) {
      return;
    }
    setIsRunning(true);
    setSubmitError(null);

    const measurement: MeasurementInput = Object.fromEntries(
      (Object.entries(readings) as [ReadingKey, string][])
        .filter(([, value]) => value !== "")
        .map(([key, value]) => [key, Number(value)]),
    );
    const sendHistory = historyConfirmed || historyChanged;
    try {
      const result = await clinicianApi.runAssessment(clinicianId, patientCaseId, {
        measurement: Object.keys(measurement).length ? { ...measurement, source: "clinician" } : undefined,
        history: sendHistory
          ? (Object.fromEntries(
              historyKeys.filter((key) => history[key] !== "").map((key) => [key, Number(history[key])]),
            ) as Partial<Record<HistoryKey, number>>)
          : undefined,
        visit_label: visitLabel.trim() || undefined,
      });
      onCompleted(result);
    } catch (caught) {
      setSubmitError(caught as ApiError);
      setIsRunning(false);
    }
  }

  const readingField = (field: { key: ReadingKey; label: string; unit: string; feature?: FeatureKey }) => {
    const previous = field.feature ? prefill.fields[field.feature] : null;
    return (
      <TextField
        key={field.key}
        label={field.label}
        type="number"
        unit={field.unit}
        value={readings[field.key] ?? ""}
        onChange={(value) => setReadings((current) => ({ ...current, [field.key]: value }))}
        placeholder={previous?.value !== null && previous?.value !== undefined ? `Last: ${previous.value}` : "Required"}
        validationMessage={readingErrors[field.key] ?? undefined}
        validationTone={readingErrors[field.key] ? "error" : previous?.stale && !readings[field.key] ? "warning" : undefined}
        helperText={
          readings[field.key]
            ? <span className="text-xs font-semibold text-emerald-700">New reading today</span>
            : previous ? <SourceTag source={previous.source} daysOld={previous.days_old} stale={previous.stale} /> : undefined
        }
      />
    );
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card className="p-6">
        <CardHeader
          title="Today's readings"
          subtitle="Leave a field blank to reuse the last recorded value shown underneath it."
        />
        <div className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-5">{vitalFields.map(readingField)}</div>
        <p className="mt-3 text-xs text-slate-500">
          BMI:{" "}
          {bmiPreview
            ? <strong className="text-slate-800">{bmiPreview} kg/m² (from today's height and weight)</strong>
            : prefill.fields.bmi.value === null
              ? <span className="font-semibold text-red-600">not recorded. Enter height and weight.</span>
              : <>{formatFeatureValue("bmi", prefill.fields.bmi.value)} <SourceTag source={prefill.fields.bmi.source} daysOld={prefill.fields.bmi.days_old} stale={prefill.fields.bmi.stale} /></>}
        </p>
        <h3 className="mt-6 text-sm font-bold text-slate-900">Lab results</h3>
        <div className="mt-3 grid gap-4 md:grid-cols-3 xl:grid-cols-5">{labFields.map(readingField)}</div>
      </Card>

      <Card className="p-6">
        <CardHeader
          title="Confirm medical history"
          subtitle="Check these with the patient. Changing a value, or ticking the box below, records it as verified by you."
        />
        <div className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-4">
          {historyKeys.map((key) =>
            key === "cigs_per_day" ? (
              <TextField
                key={key}
                label={featureMeta[key].label}
                type="number"
                value={history[key] ?? ""}
                onChange={(value) => setHistory((current) => ({ ...current, [key]: value }))}
                disabled={history.current_smoker === "0"}
                helperText={<SourceTag source={prefill.fields[key].source} daysOld={prefill.fields[key].days_old} />}
              />
            ) : (
              <SelectField
                key={key}
                label={featureMeta[key].label}
                value={history[key] ?? ""}
                onChange={(value) =>
                  setHistory((current) => ({
                    ...current,
                    [key]: value,
                    ...(key === "current_smoker" && value === "0" ? { cigs_per_day: "0" } : {}),
                  }))
                }
                options={key === "sex" ? [["1", "Male"], ["0", "Female"]] : [["1", "Yes"], ["0", "No"]]}
                helperText={<SourceTag source={prefill.fields[key].source} daysOld={prefill.fields[key].days_old} />}
              />
            ),
          )}
        </div>
        <label className="mt-5 flex items-center gap-3 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 accent-cyan-600"
            checked={historyConfirmed}
            onChange={(event) => setHistoryConfirmed(event.target.checked)}
          />
          I confirmed this history with the patient today
        </label>
      </Card>

      <Card className="p-6">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <TextField label="Visit label (optional)" value={visitLabel} onChange={setVisitLabel} placeholder="e.g. Annual review" />
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
            <Button type="submit" disabled={isRunning || stillMissing.length > 0 || Object.keys(readingErrors).length > 0}>
              <Play className="h-4 w-4" />
              {isRunning ? "Running…" : "Run assessment"}
            </Button>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          {stillMissing.length ? (
            <p className="flex items-center gap-2 font-semibold text-red-700">
              <AlertTriangle className="h-4 w-4" />
              Still needed: {stillMissing.map((key) => featureMeta[key].label).join(", ")}
            </p>
          ) : (
            <p className="flex items-center gap-2 font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              All 14 model inputs are available.
            </p>
          )}
          {staleNotUpdated.length ? (
            <p className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              Using out-of-date values for {staleNotUpdated.map((key) => featureMeta[key].label).join(", ")}. Consider re-measuring.
            </p>
          ) : null}
        </div>
        {submitError ? <div className="mt-4"><ErrorBanner message={submitError.message} details={submitError.details} /></div> : null}
      </Card>
    </form>
  );
}
