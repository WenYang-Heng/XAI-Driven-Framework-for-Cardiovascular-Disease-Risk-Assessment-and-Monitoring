import { useEffect, useState, type FormEvent } from 'react';
import { Search, UserPlus, Users, X } from 'lucide-react';
import type { HistoryKey, Patient, PatientListItem } from '../types';
import { featureMeta, historyKeys } from '../constants';
import { ApiError, clinicianApi } from '../api';
import { formatDate } from '../utils';
import { Button } from '../../../components/ui/Button';
import { Card, CardHeader } from '../../../components/ui/Card';
import { EmptyState, ErrorBanner, LoadingCard, ReviewStatusBadge, RiskPill, SelectField, TextField } from './Shared';

export function Patients({
  clinicianId,
  onOpenPatient,
}: {
  clinicianId: string;
  onOpenPatient: (patientCaseId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<PatientListItem[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    let current = true;
    // Debounce typing so every keystroke doesn't hit the API.
    const timer = window.setTimeout(() => {
      clinicianApi
        .listPatients(clinicianId, query.trim() || undefined)
        .then((items) => {
          if (current) {
            setPatients(items);
            setError(null);
          }
        })
        .catch((caught: ApiError) => current && setError(caught));
    }, 250);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [clinicianId, query]);

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <label className="flex min-h-12 flex-1 items-center gap-3 rounded-2xl border border-slate-200 px-4 focus-within:border-cyan-400 focus-within:ring-4 focus-within:ring-cyan-100">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              className="w-full bg-transparent text-sm outline-none"
              placeholder="Search by name or patient reference"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <Button onClick={() => setIsCreating(true)}>
            <UserPlus className="h-4 w-4" />
            New patient
          </Button>
        </div>
      </Card>

      {isCreating ? (
        <NewPatientForm
          clinicianId={clinicianId}
          onCancel={() => setIsCreating(false)}
          onCreated={(patient) => onOpenPatient(patient.patient_case_id)}
        />
      ) : null}

      {error ? <ErrorBanner message={error.message} details={error.details} /> : null}
      {!patients && !error ? <LoadingCard label="Loading patients…" /> : null}
      {patients && !patients.length ? (
        <EmptyState
          icon={Users}
          title={query ? "No matching patients" : "No patients yet"}
          description={query ? "Try a different name or reference." : "Add your first patient to start assessing their 10-year CHD risk."}
          actionLabel={query ? undefined : "New patient"}
          onAction={query ? undefined : () => setIsCreating(true)}
        />
      ) : null}

      {patients?.length ? (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 font-bold">Patient</th>
                <th className="px-5 py-3 font-bold">Latest risk</th>
                <th className="px-5 py-3 font-bold">Last assessed</th>
                <th className="px-5 py-3 font-bold">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {patients.map((patient) => (
                <tr
                  key={patient.patient_case_id}
                  onClick={() => onOpenPatient(patient.patient_case_id)}
                  className="cursor-pointer transition hover:bg-cyan-50/50"
                >
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-900">{patient.display_name || patient.patient_reference_id}</p>
                    <p className="text-xs text-slate-500">{patient.patient_reference_id}</p>
                  </td>
                  <td className="px-5 py-4"><RiskPill level={patient.latest_risk_level} score={patient.latest_risk_score} /></td>
                  <td className="px-5 py-4 text-slate-600">{formatDate(patient.latest_assessed_at)}</td>
                  <td className="px-5 py-4">
                    {patient.latest_result_id ? <ReviewStatusBadge status={patient.latest_review_status} /> : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}
    </div>
  );
}

const yesNo: [string, string][] = [["1", "Yes"], ["0", "No"]];

function NewPatientForm({
  clinicianId,
  onCancel,
  onCreated,
}: {
  clinicianId: string;
  onCancel: () => void;
  onCreated: (patient: Patient) => void;
}) {
  const [reference, setReference] = useState("");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [historySource, setHistorySource] = useState<"clinician" | "self_reported">("clinician");
  const [history, setHistory] = useState<Partial<Record<HistoryKey, string>>>({});
  const [error, setError] = useState<ApiError | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const setField = (key: HistoryKey, value: string) =>
    setHistory((current) => ({
      ...current,
      [key]: value,
      // Non-smokers smoke zero cigarettes; keep the two fields consistent.
      ...(key === "current_smoker" && value === "0" ? { cigs_per_day: "0" } : {}),
    }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!dob || history.sex === undefined) {
      setError(new ApiError("Date of birth and sex are required."));
      return;
    }
    setIsSaving(true);
    setError(null);
    const numericHistory = Object.fromEntries(
      Object.entries(history)
        .filter(([, value]) => value !== "" && value !== undefined)
        .map(([key, value]) => [key, Number(value)]),
    ) as Partial<Record<HistoryKey, number>>;
    try {
      const patient = await clinicianApi.createPatient(clinicianId, {
        patient_reference_id: reference.trim() || undefined,
        display_name: name.trim() || undefined,
        date_of_birth: dob,
        history_source: historySource,
        ...numericHistory,
      });
      onCreated(patient);
    } catch (caught) {
      setError(caught as ApiError);
      setIsSaving(false);
    }
  }

  return (
    <Card className="p-6">
      <form onSubmit={submit}>
        <CardHeader
          title="New patient"
          subtitle="Stable details only. Blood pressure, cholesterol and other readings are entered at each assessment."
          action={
            <Button type="button" variant="ghost" onClick={onCancel} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          }
        />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <TextField label="Name (optional)" value={name} onChange={setName} placeholder="Leave blank to stay pseudonymous" />
          <TextField label="Patient reference (optional)" value={reference} onChange={setReference} placeholder="Auto-generated if blank" />
          <TextField label="Date of birth" type="date" value={dob} onChange={setDob} />
        </div>

        <h3 className="mt-6 text-sm font-bold text-slate-900">Medical history</h3>
        <div className="mt-3 grid gap-4 md:grid-cols-4">
          <SelectField
            label="Sex"
            value={history.sex ?? ""}
            onChange={(value) => setField("sex", value)}
            options={[["1", "Male"], ["0", "Female"]]}
          />
          {historyKeys
            .filter((key) => key !== "sex" && key !== "cigs_per_day")
            .map((key) => (
              <SelectField
                key={key}
                label={featureMeta[key].label}
                value={history[key] ?? ""}
                onChange={(value) => setField(key, value)}
                options={yesNo}
              />
            ))}
          <TextField
            label="Cigarettes per day"
            type="number"
            value={history.cigs_per_day ?? ""}
            onChange={(value) => setField("cigs_per_day", value)}
            disabled={history.current_smoker === "0"}
          />
          <SelectField
            label="History reported by"
            value={historySource}
            onChange={(value) => setHistorySource(value as "clinician" | "self_reported")}
            options={[["clinician", "Clinician"], ["self_reported", "Patient (self-reported)"]]}
          />
        </div>

        {error ? <div className="mt-5"><ErrorBanner message={error.message} details={error.details} /></div> : null}

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Create patient"}</Button>
        </div>
      </form>
    </Card>
  );
}
