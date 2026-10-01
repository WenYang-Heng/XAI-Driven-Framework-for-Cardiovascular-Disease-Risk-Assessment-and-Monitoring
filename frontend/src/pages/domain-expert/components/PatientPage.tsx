import { useEffect, useState } from 'react';
import { ClipboardPlus } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PatientDetail } from '../types';
import { clinicalActionLabels, featureMeta, historyKeys, measurementKeys } from '../constants';
import { ApiError, clinicianApi } from '../api';
import { formatDate, formatFeatureValue, percent } from '../utils';
import { Button } from '../../../components/ui/Button';
import { Card, CardHeader } from '../../../components/ui/Card';
import { ErrorBanner, LoadingCard, ReviewStatusBadge, RiskPill, SourceTag } from './Shared';

export function PatientPage({
  clinicianId,
  patientCaseId,
  onNewAssessment,
  onOpenAssessment,
}: {
  clinicianId: string;
  patientCaseId: string;
  onNewAssessment: () => void;
  onOpenAssessment: (resultId: string) => void;
}) {
  const [detail, setDetail] = useState<PatientDetail | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let current = true;
    clinicianApi
      .patient(clinicianId, patientCaseId)
      .then((body) => current && setDetail(body))
      .catch((caught: ApiError) => current && setError(caught));
    return () => {
      current = false;
    };
  }, [clinicianId, patientCaseId]);

  if (error) {
    return <ErrorBanner message={error.message} details={error.details} />;
  }
  if (!detail) {
    return <LoadingCard label="Loading patient…" />;
  }

  const { patient, measurements, assessments } = detail;
  const now = Date.now();
  const trend = [...assessments]
    .reverse()
    .map((row) => ({ date: formatDate(row.assessed_at), risk: Math.round(row.risk_score * 1000) / 10 }));

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-950">{patient.display_name || patient.patient_reference_id}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {patient.patient_reference_id}
              {patient.date_of_birth ? ` · born ${formatDate(patient.date_of_birth)}` : ""}
            </p>
          </div>
          <Button onClick={onNewAssessment}>
            <ClipboardPlus className="h-4 w-4" />
            New assessment
          </Button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {historyKeys.map((key) => {
            const source = patient.history_sources?.[key];
            const days = source?.updated_at ? Math.floor((now - Date.parse(source.updated_at)) / 86_400_000) : null;
            return (
              <div key={key} className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">{featureMeta[key].label}</p>
                <p className="mt-1 font-semibold text-slate-900">{formatFeatureValue(key, patient[key])}</p>
                <SourceTag source={source?.source} daysOld={days} />
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-6">
        <CardHeader title="Risk over time" subtitle="Each point is one assessment. Dashed lines mark the moderate (10%) and high (20%) bands." />
        {trend.length > 1 ? (
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ left: 0, right: 16, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis unit="%" tick={{ fontSize: 12 }} domain={[0, (max: number) => Math.max(30, Math.ceil(max / 10) * 10)]} />
                <Tooltip formatter={(value) => [`${value}%`, "10-year CHD risk"]} />
                <ReferenceLine y={10} stroke="#f59e0b" strokeDasharray="4 4" />
                <ReferenceLine y={20} stroke="#ef4444" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="risk" stroke="#0891b2" strokeWidth={3} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            {trend.length ? `One assessment so far (${percent(assessments[0].risk_score)}). The trend appears after the next one.` : "No assessments yet."}
          </p>
        )}
      </Card>

      <Card className="p-6">
        <CardHeader title="Assessments" />
        {assessments.length ? (
          <div className="mt-5 overflow-x-auto rounded-[18px] border border-slate-200">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-bold">Date</th>
                  <th className="px-4 py-3 font-bold">Risk</th>
                  <th className="px-4 py-3 font-bold">Review</th>
                  <th className="px-4 py-3 font-bold">Action taken</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assessments.map((row) => (
                  <tr key={row.result_id} onClick={() => onOpenAssessment(row.result_id)} className="cursor-pointer hover:bg-cyan-50/50">
                    <td className="px-4 py-3 text-slate-700">
                      {formatDate(row.assessed_at)}
                      {row.visit_label ? <span className="block text-xs text-slate-500">{row.visit_label}</span> : null}
                    </td>
                    <td className="px-4 py-3"><RiskPill level={row.risk_level} score={row.risk_score} /></td>
                    <td className="px-4 py-3"><ReviewStatusBadge status={row.review_status} /></td>
                    <td className="px-4 py-3 text-slate-600">{row.clinical_action ? clinicalActionLabels[row.clinical_action] : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">Run the first assessment to see this patient's risk.</p>
        )}
      </Card>

      <Card className="p-6">
        <CardHeader title="Readings" subtitle="Vitals and lab results recorded at each visit." />
        {measurements.length ? (
          <div className="mt-5 overflow-x-auto rounded-[18px] border border-slate-200">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-bold">Date</th>
                  {measurementKeys.map((key) => (
                    <th key={key} className="px-4 py-3 font-bold">{featureMeta[key].label}</th>
                  ))}
                  <th className="px-4 py-3 font-bold">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {measurements.map((row) => (
                  <tr key={row.measurement_id}>
                    <td className="px-4 py-3 text-slate-700">{formatDate(row.measured_at)}</td>
                    {measurementKeys.map((key) => (
                      <td key={key} className="px-4 py-3 text-slate-600">{row[key] ?? "–"}</td>
                    ))}
                    <td className="px-4 py-3 text-xs text-slate-500">{row.source.replace("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">No readings recorded yet.</p>
        )}
      </Card>
    </div>
  );
}
