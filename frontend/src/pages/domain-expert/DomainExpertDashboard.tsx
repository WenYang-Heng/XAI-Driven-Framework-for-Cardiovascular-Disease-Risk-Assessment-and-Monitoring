import { useState } from 'react';
import { ChevronLeft, LogIn } from 'lucide-react';
import type { DomainExpertUser, ModelAgreement, NavKey, View } from './types';
import { navMeta } from './constants';
import { MobileNav, Sidebar, TopHeader } from './components/Layout';
import { Worklist } from './components/Worklist';
import { Patients } from './components/Patients';
import { PatientPage } from './components/PatientPage';
import { AssessmentForm } from './components/AssessmentForm';
import { ClinicalReview } from './components/ClinicalReview';
import { ModelEvidence } from './components/ModelEvidence';
import { EmptyState } from './components/Shared';

const viewMeta: Record<"patient" | "assess" | "review", { title: string; subtitle: string }> = {
  patient: { title: "Patient", subtitle: "Profile, risk over time and past assessments." },
  assess: { title: "New assessment", subtitle: "Confirm the patient's details and enter today's readings." },
  review: { title: "Clinical review", subtitle: "Check the estimate and its drivers, then record your verdict." },
};

export function DomainExpertDashboard({
  currentUser,
  onLogout,
}: {
  currentUser?: DomainExpertUser;
  onLogout?: () => void;
}) {
  const [history, setHistory] = useState<View[]>([{ name: "worklist" }]);
  // Model agreement is returned when an assessment runs but isn't stored, so keep it for this session.
  const [agreements, setAgreements] = useState<Record<string, ModelAgreement>>({});
  const view = history[history.length - 1];
  const clinicianId = currentUser?.id;

  const navigate = (next: View) => setHistory((current) => [...current, next]);
  const goTop = (key: NavKey) => setHistory([{ name: key }]);
  const goBack = () => setHistory((current) => (current.length > 1 ? current.slice(0, -1) : current));

  const activeNav: NavKey | null =
    view.name === "worklist" || view.name === "patients" || view.name === "models" ? view.name : null;
  const meta = activeNav ? navMeta[activeNav] : viewMeta[view.name as keyof typeof viewMeta];

  const breadcrumb = history.length > 1 ? (
    <button
      type="button"
      onClick={goBack}
      className="mb-2 flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-cyan-700"
    >
      <ChevronLeft className="h-4 w-4" />
      Back
    </button>
  ) : null;

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-950">
      <div className="flex min-h-screen">
        <Sidebar active={activeNav} onChange={goTop} />

        <section className="min-w-0 flex-1 px-4 py-5 lg:px-8">
          <MobileNav active={activeNav} onChange={goTop} />
          <TopHeader
            title={meta.title}
            subtitle={meta.subtitle}
            currentUser={currentUser}
            onLogout={onLogout}
            breadcrumb={breadcrumb}
          />

          <div className="mt-7">
            {!clinicianId ? (
              <EmptyState icon={LogIn} title="Sign in required" description="Sign in with a clinician account to see your patients." />
            ) : null}

            {clinicianId && view.name === "worklist" ? (
              <Worklist
                clinicianId={clinicianId}
                onOpenAssessment={(resultId) => navigate({ name: "review", resultId })}
                onOpenPatients={() => goTop("patients")}
              />
            ) : null}

            {clinicianId && view.name === "patients" ? (
              <Patients
                clinicianId={clinicianId}
                onOpenPatient={(patientCaseId) => navigate({ name: "patient", patientCaseId })}
              />
            ) : null}

            {clinicianId && view.name === "patient" ? (
              <PatientPage
                key={view.patientCaseId}
                clinicianId={clinicianId}
                patientCaseId={view.patientCaseId}
                onNewAssessment={() => navigate({ name: "assess", patientCaseId: view.patientCaseId })}
                onOpenAssessment={(resultId) => navigate({ name: "review", resultId })}
              />
            ) : null}

            {clinicianId && view.name === "assess" ? (
              <AssessmentForm
                clinicianId={clinicianId}
                patientCaseId={view.patientCaseId}
                onCancel={goBack}
                onCompleted={(result) => {
                  setAgreements((current) => ({ ...current, [result.result_id]: result.model_agreement }));
                  // Replace the form in history so Back from the review returns to the patient.
                  setHistory((current) => [...current.slice(0, -1), { name: "review", resultId: result.result_id }]);
                }}
              />
            ) : null}

            {clinicianId && view.name === "review" ? (
              <ClinicalReview
                key={view.resultId}
                clinicianId={clinicianId}
                resultId={view.resultId}
                agreement={agreements[view.resultId] ?? null}
                onOpenPatient={(patientCaseId) => navigate({ name: "patient", patientCaseId })}
              />
            ) : null}

            {view.name === "models" ? <ModelEvidence /> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
