import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Lock, Scale } from 'lucide-react';
import type {
  AssessmentDetail,
  ClinicalAction,
  FeatureKey,
  ModelAgreement,
  Review,
  ReviewInput,
  RiskLevel,
} from '../types';
import { clinicalActionLabels, featureMeta, modelLabels } from '../constants';
import { ApiError, clinicianApi } from '../api';
import { formatDate, formatFeatureValue, percent, riskLabel, sortedByMagnitude } from '../utils';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardHeader } from '../../../components/ui/Card';
import { ErrorBanner, LoadingCard, RiskBandLegend, RiskGauge, SelectField, SourceTag } from './Shared';
import { TechnicalXai, deriveAgreement } from './Xai';

export function ClinicalReview({
  clinicianId,
  resultId,
  agreement,
  onOpenPatient,
}: {
  clinicianId: string;
  resultId: string;
  /** Only available straight after running the assessment. */
  agreement: ModelAgreement | null;
  onOpenPatient: (patientCaseId: string) => void;
}) {
  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let current = true;
    clinicianApi
      .assessment(clinicianId, resultId)
      .then((body) => current && setAssessment(body))
      .catch((caught: ApiError) => current && setError(caught));
    return () => {
      current = false;
    };
  }, [clinicianId, resultId]);

  const patientValues = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(assessment?.input_features ?? {}).map(([key, value]) => [key, formatFeatureValue(key, value)]),
      ),
    [assessment],
  );

  if (error) {
    return <ErrorBanner message={error.message} details={error.details} />;
  }
  if (!assessment) {
    return <LoadingCard label="Loading assessment…" />;
  }

  const patient = assessment.patient;
  const drivers = sortedByMagnitude(assessment.xai?.shap.contributions ?? []).slice(0, 6);
  const xaiAgreement = assessment.xai ? deriveAgreement(assessment.xai) : null;
  const outOf100 = Math.round(assessment.risk_score * 100);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            {patient ? (
              <button
                type="button"
                onClick={() => onOpenPatient(patient.patient_case_id)}
                className="text-left text-xl font-bold text-slate-950 hover:text-cyan-700"
              >
                {patient.display_name || patient.patient_reference_id}
              </button>
            ) : null}
            <p className="mt-1 text-sm text-slate-500">
              Assessed {formatDate(assessment.assessed_at)}
              {assessment.visit_label ? ` · ${assessment.visit_label}` : ""} · {modelLabels[assessment.model_name]}
            </p>
          </div>
          {assessment.my_review?.review_status === "signed_off" ? (
            <Badge tone="green"><Lock className="mr-1 h-3 w-3" />Signed off {formatDate(assessment.my_review.signed_off_at)}</Badge>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="p-6">
          <RiskGauge riskScore={assessment.risk_score} riskLevel={assessment.risk_level} />
          <p className="mt-5 text-center text-sm leading-6 text-slate-600">
            Of 100 people with these values, about <strong className="text-slate-900">{outOf100}</strong> would be expected to develop
            coronary heart disease within 10 years.
          </p>
          <div className="mt-5"><RiskBandLegend /></div>
          {agreement?.available ? <AgreementCard agreement={agreement} /> : null}
        </Card>

        <Card className="p-6">
          <CardHeader
            title="What's driving this estimate"
            subtitle="The values that moved this patient's risk most, compared with an average patient (SHAP)."
          />
          {drivers.length ? (
            <ul className="mt-5 space-y-3">
              {drivers.map((driver) => {
                const meta = featureMeta[driver.feature as FeatureKey];
                const raises = driver.value >= 0;
                return (
                  <li key={driver.feature} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${raises ? "bg-orange-50 text-orange-600" : "bg-emerald-50 text-emerald-600"}`}>
                        {raises ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900">
                          {meta?.label ?? driver.feature}: {patientValues[driver.feature] ?? "–"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {raises ? "Adds" : "Takes off"} about {(Math.abs(driver.value) * 100).toFixed(1)} percentage points
                        </p>
                      </div>
                    </div>
                    {meta?.modifiable ? <Badge tone="cyan">Modifiable</Badge> : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">No explanation was stored for this assessment.</p>
          )}
          {assessment.explanation?.length ? (
            <ul className="mt-5 space-y-2 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              {assessment.explanation.map((line) => <li key={line}>• {line}</li>)}
            </ul>
          ) : null}
          {xaiAgreement && xaiAgreement.level === "Low" ? (
            <p className="mt-4 flex items-start gap-2 text-sm text-amber-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              SHAP and LIME disagree on many drivers for this patient. Treat the explanation with caution.
            </p>
          ) : null}
        </Card>
      </div>

      <Card className="p-6">
        <CardHeader title="Inputs used" subtitle="The exact values sent to the model, and where each came from." />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(featureMeta) as FeatureKey[]).map((key) => {
            const source = assessment.input_sources?.[key];
            return (
              <div key={key} className={`rounded-2xl p-4 ${source?.stale ? "bg-amber-50" : "bg-slate-50"}`}>
                <p className="text-xs font-bold uppercase text-slate-500">{featureMeta[key].label}</p>
                <p className="mt-1 font-semibold text-slate-900">{patientValues[key] ?? "–"}</p>
                <SourceTag source={source?.source} stale={source?.stale} />
              </div>
            );
          })}
        </div>
      </Card>

      <VerdictForm
        clinicianId={clinicianId}
        resultId={resultId}
        modelRisk={assessment.risk_level}
        existing={assessment.my_review}
        onSaved={(review) => setAssessment((current) => (current ? { ...current, my_review: review } : current))}
      />

      {assessment.xai ? (
        <details className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-soft">
          <summary className="cursor-pointer text-base font-bold text-slate-950">Technical details: SHAP, LIME and their agreement</summary>
          <div className="mt-5">
            <TechnicalXai xai={assessment.xai} riskScore={assessment.risk_score} patientFeatureValues={patientValues} />
          </div>
        </details>
      ) : null}
    </div>
  );
}

function AgreementCard({ agreement }: { agreement: ModelAgreement }) {
  return (
    <div className={`mt-5 rounded-2xl border p-4 ${agreement.agrees ? "border-emerald-100 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
      <p className={`flex items-center gap-2 text-sm font-bold ${agreement.agrees ? "text-emerald-800" : "text-amber-800"}`}>
        <Scale className="h-4 w-4" />
        {agreement.agrees ? "All models agree" : "Models disagree"}
      </p>
      {agreement.message ? <p className="mt-1 text-xs leading-5 text-amber-800">{agreement.message}</p> : null}
      <ul className="mt-3 space-y-1 text-xs text-slate-700">
        {agreement.scores.map((score) => (
          <li key={score.model_name} className="flex justify-between">
            <span className={score.is_selected ? "font-bold" : ""}>
              {modelLabels[score.model_name]}{score.is_selected ? " (used)" : ""}
            </span>
            <span>{percent(score.risk_score)} · {riskLabel(score.risk_level)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VerdictForm({
  clinicianId,
  resultId,
  modelRisk,
  existing,
  onSaved,
}: {
  clinicianId: string;
  resultId: string;
  modelRisk: RiskLevel;
  existing: Review | null;
  onSaved: (review: Review) => void;
}) {
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(existing?.clinician_risk_level ?? modelRisk);
  const [flagged, setFlagged] = useState<FeatureKey[]>(existing?.flagged_features ?? []);
  const [action, setAction] = useState<ClinicalAction | "">(existing?.clinical_action ?? "");
  const [confidence, setConfidence] = useState(String(existing?.confidence_level ?? ""));
  const [comment, setComment] = useState(existing?.feedback_comment ?? "");
  const [forRetraining, setForRetraining] = useState(existing?.use_for_future_retraining ?? false);
  const [error, setError] = useState<ApiError | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedDraft, setSavedDraft] = useState(false);

  if (existing?.review_status === "signed_off") {
    return (
      <Card className="p-6">
        <CardHeader title="Your verdict" subtitle="Signed off. Signed reviews are locked so they stay a reliable record." />
        <dl className="mt-5 grid gap-4 text-sm md:grid-cols-3">
          <div>
            <dt className="text-xs font-bold uppercase text-slate-500">Your risk judgement</dt>
            <dd className="mt-1 font-semibold text-slate-900">
              {riskLabel(existing.clinician_risk_level)}
              {existing.clinician_risk_level && existing.clinician_risk_level !== modelRisk ? " (overrode model)" : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase text-slate-500">Action taken</dt>
            <dd className="mt-1 font-semibold text-slate-900">{existing.clinical_action ? clinicalActionLabels[existing.clinical_action] : "–"}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase text-slate-500">Drivers flagged as clinically wrong</dt>
            <dd className="mt-1 font-semibold text-slate-900">
              {existing.flagged_features?.length ? existing.flagged_features.map((key) => featureMeta[key]?.label ?? key).join(", ") : "None"}
            </dd>
          </div>
        </dl>
        {existing.feedback_comment ? <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">{existing.feedback_comment}</p> : null}
      </Card>
    );
  }

  async function save(signOff: boolean) {
    setIsSaving(true);
    setError(null);
    setSavedDraft(false);
    const payload: ReviewInput = {
      clinician_risk_level: riskLevel,
      confidence_level: confidence ? Number(confidence) : null,
      flagged_features: flagged,
      clinical_action: action || null,
      feedback_comment: comment.trim() || null,
      use_for_future_retraining: forRetraining,
      sign_off: signOff,
    };
    try {
      const review = await clinicianApi.review(clinicianId, resultId, payload);
      onSaved(review);
      setSavedDraft(!signOff);
    } catch (caught) {
      setError(caught as ApiError);
    } finally {
      setIsSaving(false);
    }
  }

  const toggleFlag = (key: FeatureKey) =>
    setFlagged((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));

  return (
    <Card className="p-6">
      <CardHeader
        title="Your verdict"
        subtitle="Your judgement is the final decision. Overrides and flagged drivers are reported to the model team to improve the model."
      />
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <SelectField
          label="Your risk judgement"
          value={riskLevel}
          onChange={(value) => setRiskLevel(value as RiskLevel)}
          options={(["low", "moderate", "high"] as RiskLevel[]).map((level) => [
            level,
            `${riskLabel(level)}${level === modelRisk ? " (agrees with model)" : ""}`,
          ])}
        />
        <SelectField
          label="Action taken"
          value={action}
          onChange={(value) => setAction(value as ClinicalAction)}
          options={Object.entries(clinicalActionLabels) as [string, string][]}
          placeholder="Choose before signing off"
        />
        <SelectField
          label="Confidence in your judgement"
          value={confidence}
          onChange={setConfidence}
          options={[["1", "1 · Very unsure"], ["2", "2"], ["3", "3 · Moderate"], ["4", "4"], ["5", "5 · Very confident"]]}
          placeholder="Optional"
        />
      </div>

      <p className="mt-6 text-sm font-semibold text-slate-700">Flag any driver that doesn't make clinical sense for this patient</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(Object.keys(featureMeta) as FeatureKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => toggleFlag(key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
              flagged.includes(key) ? "bg-red-50 text-red-700 ring-red-200" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {featureMeta[key].label}
          </button>
        ))}
      </div>

      <label className="mt-6 block">
        <span className="text-sm font-semibold text-slate-700">Notes</span>
        <textarea
          className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 p-4 text-sm outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Why you agree or disagree, and anything the model can't see"
        />
      </label>
      <label className="mt-4 flex items-center gap-3 text-sm text-slate-700">
        <input type="checkbox" className="h-4 w-4 accent-cyan-600" checked={forRetraining} onChange={(event) => setForRetraining(event.target.checked)} />
        This case can be used to evaluate or retrain the model
      </label>

      {error ? <div className="mt-5"><ErrorBanner message={error.message} details={error.details} /></div> : null}

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        {savedDraft ? <span className="flex items-center gap-1 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />Draft saved</span> : null}
        <Button variant="secondary" disabled={isSaving} onClick={() => save(false)}>Save draft</Button>
        <Button disabled={isSaving || !action} onClick={() => save(true)} title={action ? undefined : "Choose the action taken first"}>
          <Lock className="h-4 w-4" />
          Sign off
        </Button>
      </div>
    </Card>
  );
}
