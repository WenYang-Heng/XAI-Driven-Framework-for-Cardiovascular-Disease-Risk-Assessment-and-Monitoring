import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, FileClock, Inbox } from 'lucide-react';
import type { AssessmentListItem, Worklist as WorklistData } from '../types';
import { clinicalActionLabels } from '../constants';
import { ApiError, clinicianApi } from '../api';
import { formatDate } from '../utils';
import { Card, CardHeader } from '../../../components/ui/Card';
import { EmptyState, ErrorBanner, LoadingCard, MetricCard, ReviewStatusBadge, RiskPill } from './Shared';

export function Worklist({
  clinicianId,
  onOpenAssessment,
  onOpenPatients,
}: {
  clinicianId: string;
  onOpenAssessment: (resultId: string) => void;
  onOpenPatients: () => void;
}) {
  const [data, setData] = useState<WorklistData | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let current = true;
    clinicianApi
      .worklist(clinicianId)
      .then((body) => current && setData(body))
      .catch((caught: ApiError) => current && setError(caught));
    return () => {
      current = false;
    };
  }, [clinicianId]);

  if (error) {
    return <ErrorBanner message={error.message} details={error.details} />;
  }
  if (!data) {
    return <LoadingCard label="Loading your worklist…" />;
  }

  const isEmpty = !data.needs_review.length && !data.drafts.length && !data.recently_signed_off.length;
  if (isEmpty) {
    return (
      <EmptyState
        icon={Inbox}
        title="Nothing to review yet"
        description="Assessments you run will appear here until you sign them off. Start by opening a patient."
        actionLabel="Go to patients"
        onAction={onOpenPatients}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          icon={AlertTriangle}
          label="High risk, not reviewed"
          value={String(data.counts.high_risk_unreviewed)}
          tone={data.counts.high_risk_unreviewed ? "red" : "green"}
        />
        <MetricCard icon={ClipboardList} label="Waiting for review" value={String(data.counts.needs_review)} tone="amber" />
        <MetricCard icon={FileClock} label="Draft reviews" value={String(data.counts.drafts)} tone="cyan" />
      </div>

      <AssessmentTable
        title="Needs review"
        subtitle="Highest risk first. Open one to check the drivers and sign it off."
        rows={data.needs_review}
        empty="All assessments have been reviewed."
        onOpen={onOpenAssessment}
      />
      {data.drafts.length ? (
        <AssessmentTable
          title="Draft reviews"
          subtitle="Reviews you started but haven't signed off."
          rows={data.drafts}
          empty=""
          onOpen={onOpenAssessment}
        />
      ) : null}
      {data.recently_signed_off.length ? (
        <AssessmentTable
          title="Recently signed off"
          rows={data.recently_signed_off}
          empty=""
          onOpen={onOpenAssessment}
          showAction
        />
      ) : null}
    </div>
  );
}

function AssessmentTable({
  title,
  subtitle,
  rows,
  empty,
  onOpen,
  showAction = false,
}: {
  title: string;
  subtitle?: string;
  rows: AssessmentListItem[];
  empty: string;
  onOpen: (resultId: string) => void;
  showAction?: boolean;
}) {
  return (
    <Card className="p-6">
      <CardHeader title={title} subtitle={subtitle} />
      {rows.length ? (
        <div className="mt-5 overflow-x-auto rounded-[18px] border border-slate-200">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-bold">Patient</th>
                <th className="px-4 py-3 font-bold">Risk</th>
                <th className="px-4 py-3 font-bold">Assessed</th>
                <th className="px-4 py-3 font-bold">{showAction ? "Action taken" : "Status"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr
                  key={row.result_id}
                  onClick={() => onOpen(row.result_id)}
                  className="cursor-pointer transition hover:bg-cyan-50/50"
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{row.display_name || row.patient_reference_id}</p>
                    {row.display_name ? <p className="text-xs text-slate-500">{row.patient_reference_id}</p> : null}
                  </td>
                  <td className="px-4 py-3"><RiskPill level={row.risk_level} score={row.risk_score} /></td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(row.assessed_at)}</td>
                  <td className="px-4 py-3">
                    {showAction && row.clinical_action ? (
                      <span className="flex items-center gap-2 text-slate-700">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        {clinicalActionLabels[row.clinical_action]}
                      </span>
                    ) : (
                      <ReviewStatusBadge status={row.review_status} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">{empty}</p>
      )}
    </Card>
  );
}
