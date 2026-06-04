import { Check, CheckCircle2, ChevronLeft, ChevronRight, Save } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Card, CardHeader } from "../../../components/ui/Card";
import type { AssessmentForm } from "./assessmentModel";

type RiskCategory = {
  label: string;
  tone: "green" | "amber" | "red";
};

type AssessmentStep = {
  id: string;
  title: string;
  description: string;
};

type RiskAssessmentProps = {
  form: AssessmentForm;
  step: number;
  setStep: (step: number) => void;
  updateField: <Key extends keyof AssessmentForm>(key: Key, value: AssessmentForm[Key]) => void;
  currentRisk: number;
  currentCategory: RiskCategory;
  onComplete: () => void;
  RiskGauge: React.ComponentType<{ value: number; label: string }>;
  StatusBadge: React.ComponentType<{ tone: RiskCategory["tone"]; children: React.ReactNode }>;
  Notice: React.ComponentType<{ tone: "soft" | "warning" | "danger"; children: React.ReactNode }>;
  SectionTitle: React.ComponentType<{ label: string; title: string; description: string }>;
};

const assessmentSteps: AssessmentStep[] = [
  {
    id: "basics",
    title: "About you",
    description: "Basic details help the model understand your general risk context.",
  },
  {
    id: "numbers",
    title: "Health numbers",
    description: "Enter values you know, or choose not sure instead of guessing.",
  },
  {
    id: "habits",
    title: "Daily habits",
    description: "Simple lifestyle questions help explain which risk factors may be improved.",
  },
  {
    id: "history",
    title: "Health history",
    description: "A few health-background questions help personalize the explanation.",
  },
  {
    id: "review",
    title: "Review",
    description: "Check your answers before generating your estimated risk result.",
  },
];

export function RiskAssessment({
  form,
  step,
  setStep,
  updateField,
  currentRisk,
  currentCategory,
  onComplete,
  RiskGauge,
  StatusBadge,
  Notice,
  SectionTitle,
}: RiskAssessmentProps) {
  const currentStep = assessmentSteps[step];
  const isLastStep = step === assessmentSteps.length - 1;
  const hasUrgentSymptoms = form.symptoms === "urgent";

  return (
    <section className="grid gap-6">
      <SectionTitle
        label="CVD risk assessment"
        title="Build your risk profile step by step"
        description="The assessment uses simple questions and helpful hints so general users can complete it without medical training."
      />

      <Card className="p-5">
        <div className="grid gap-3 md:grid-cols-5">
          {assessmentSteps.map((item, index) => {
            const selected = index === step;
            const completed = index < step;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setStep(index)}
                className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                  selected
                    ? "border-cyan-300 bg-cyan-50 text-cyan-950"
                    : completed
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-slate-200 bg-white text-slate-600 hover:border-cyan-200"
                }`}
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
                  completed ? "bg-emerald-600 text-white" : selected ? "bg-cyan-700 text-white" : "bg-slate-100"
                }`}>
                  {completed ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                <span>
                  <strong className="block text-sm">{item.title}</strong>
                  <span className="mt-0.5 block text-xs opacity-75">{item.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="p-6">
          <CardHeader title={currentStep.title} subtitle={currentStep.description} />
          <div className="mt-6">
            {step === 0 ? <BasicsStep form={form} updateField={updateField} /> : null}
            {step === 1 ? <NumbersStep form={form} updateField={updateField} /> : null}
            {step === 2 ? <HabitsStep form={form} updateField={updateField} /> : null}
            {step === 3 ? <HistoryStep form={form} updateField={updateField} /> : null}
            {step === 4 ? (
              <div className="grid gap-4">
                <AssessmentReview form={form} />
                <Notice tone="soft">
                  Your result will be shown as an estimated risk for health awareness. It is not a medical diagnosis.
                </Notice>
                {hasUrgentSymptoms ? (
                  <Notice tone="danger">
                    You selected urgent symptoms. Please seek medical care promptly if you are experiencing chest pain, severe breathlessness, fainting, or worsening symptoms.
                  </Notice>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="secondary"
              disabled={step === 0}
              onClick={() => setStep(Math.max(0, step - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            {isLastStep ? (
              <Button type="button" onClick={onComplete}>
                Generate risk result
                <Save className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={() => setStep(Math.min(assessmentSteps.length - 1, step + 1))}>
                Continue
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <CardHeader title="Live estimate preview" subtitle="Updates as the user fills the form" />
          <div className="mt-6 grid justify-items-center gap-4 text-center">
            <RiskGauge value={currentRisk} label={currentCategory.label} />
            <StatusBadge tone={currentCategory.tone}>{currentCategory.label}</StatusBadge>
            <p className="leading-7 text-slate-600">
              This preview helps users understand that answers affect the score, while the final explanation appears after submission.
            </p>
          </div>
          <Notice tone={hasUrgentSymptoms ? "danger" : "warning"}>
            {hasUrgentSymptoms
              ? "Urgent symptoms should be handled by medical services, not by this assessment alone."
              : "Use recent clinic or home monitoring values if available. Estimates are less reliable when values are guessed."}
          </Notice>
        </Card>
      </div>
    </section>
  );
}

function BasicsStep({
  form,
  updateField,
}: {
  form: AssessmentForm;
  updateField: RiskAssessmentProps["updateField"];
}) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <NumberField label="Age" value={form.age} min={18} max={95} unit="years" helper="Use your current age." onChange={(value) => updateField("age", value)} />
      <ChoiceGroup
        label="Sex"
        value={form.sex}
        options={[
          ["female", "Female"],
          ["male", "Male"],
        ]}
        onChange={(value) => updateField("sex", value as AssessmentForm["sex"])}
      />
    </div>
  );
}

function NumbersStep({ form, updateField }: { form: AssessmentForm; updateField: RiskAssessmentProps["updateField"] }) {
  return (
    <div className="grid gap-5">
      <ChoiceGroup
        label="Do you know your latest blood pressure?"
        value={form.bpKnown}
        options={[
          ["known", "Yes, I know it"],
          ["unknown", "Not sure"],
        ]}
        helper="If you do not know the value, choose not sure instead of guessing."
        onChange={(value) => updateField("bpKnown", value as AssessmentForm["bpKnown"])}
      />
      {form.bpKnown === "known" ? (
        <NumberField label="Systolic blood pressure" value={form.systolicBp} min={80} max={220} unit="mmHg" helper="This is the upper number, for example 132 in 132/84." onChange={(value) => updateField("systolicBp", value)} />
      ) : null}
      <ChoiceGroup
        label="Do you know your latest cholesterol?"
        value={form.cholesterolKnown}
        options={[
          ["known", "Yes, I know it"],
          ["unknown", "Not sure"],
        ]}
        onChange={(value) => updateField("cholesterolKnown", value as AssessmentForm["cholesterolKnown"])}
      />
      {form.cholesterolKnown === "known" ? (
        <NumberField label="Total cholesterol" value={form.cholesterol} min={120} max={360} unit="mg/dL" helper="If you only know mmol/L, your clinic report may show both units." onChange={(value) => updateField("cholesterol", value)} />
      ) : null}
      <ChoiceGroup
        label="Blood glucose"
        value={form.glucose}
        options={[
          ["normal", "Normal"],
          ["borderline", "Borderline"],
          ["high", "High"],
        ]}
        helper="Choose the closest category from your last check-up if you know it."
        onChange={(value) => updateField("glucose", value as AssessmentForm["glucose"])}
      />
      <ChoiceGroup
        label="Weight category"
        value={form.weightCategory}
        options={[
          ["healthy", "Healthy range"],
          ["overweight", "Overweight"],
          ["obese", "Obese"],
          ["unsure", "Not sure"],
        ]}
        onChange={(value) => updateField("weightCategory", value as AssessmentForm["weightCategory"])}
      />
    </div>
  );
}

function HabitsStep({ form, updateField }: { form: AssessmentForm; updateField: RiskAssessmentProps["updateField"] }) {
  return (
    <div className="grid gap-5">
      <ChoiceGroup label="Smoking status" value={form.smoking} options={[["no", "No"], ["former", "Former smoker"], ["yes", "Currently smoke"]]} onChange={(value) => updateField("smoking", value as AssessmentForm["smoking"])} />
      <ChoiceGroup label="Weekly physical activity" value={form.activity} options={[["low", "Low"], ["medium", "Some activity"], ["high", "Active"]]} helper="Choose the closest answer. You do not need an exact exercise log." onChange={(value) => updateField("activity", value as AssessmentForm["activity"])} />
    </div>
  );
}

function HistoryStep({ form, updateField }: { form: AssessmentForm; updateField: RiskAssessmentProps["updateField"] }) {
  return (
    <div className="grid gap-5">
      <ChoiceGroup label="Diabetes or prediabetes history" value={form.diabetes} options={[["no", "No"], ["prediabetes", "Prediabetes"], ["yes", "Diabetes"], ["unsure", "Not sure"]]} onChange={(value) => updateField("diabetes", value as AssessmentForm["diabetes"])} />
      <ChoiceGroup label="Blood pressure medication" value={form.bpMedication} options={[["no", "No"], ["yes", "Yes"], ["unsure", "Not sure"]]} helper="Only select yes if it was prescribed by a healthcare professional." onChange={(value) => updateField("bpMedication", value as AssessmentForm["bpMedication"])} />
      <ChoiceGroup label="Family history of heart disease" value={form.familyHistory} options={[["no", "No"], ["yes", "Yes"], ["unsure", "Not sure"]]} onChange={(value) => updateField("familyHistory", value as AssessmentForm["familyHistory"])} />
      <ChoiceGroup label="Current symptoms" value={form.symptoms} options={[["none", "No symptoms"], ["mild", "Mild concern"], ["urgent", "Chest pain or severe breathlessness"]]} onChange={(value) => updateField("symptoms", value as AssessmentForm["symptoms"])} />
    </div>
  );
}

function NumberField({ label, value, min, max, unit, helper, onChange }: { label: string; value: number; min: number; max: number; unit: string; helper: string; onChange: (value: number) => void }) {
  return (
    <label className="block rounded-[20px] border border-slate-200 bg-slate-50 p-4">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <div className="mt-3 flex items-center gap-3">
        <input className="form-input mt-0" type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
        <span className="w-16 text-sm font-semibold text-slate-500">{unit}</span>
      </div>
      <small className="mt-3 block leading-5 text-slate-500">{helper}</small>
    </label>
  );
}

function ChoiceGroup({ label, value, options, helper, onChange }: { label: string; value: string; options: string[][]; helper?: string; onChange: (value: string) => void }) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-slate-700">{label}</legend>
      {helper ? <p className="mt-1 text-sm text-slate-500">{helper}</p> : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {options.map(([optionValue, optionLabel]) => {
          const selected = value === optionValue;
          return (
            <button key={optionValue} type="button" onClick={() => onChange(optionValue)} className={`min-h-16 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${selected ? "border-cyan-300 bg-cyan-50 text-cyan-900 ring-2 ring-cyan-100" : "border-slate-200 bg-white text-slate-600 hover:border-cyan-200 hover:bg-cyan-50"}`}>
              <span className="flex items-center justify-between gap-3">
                {optionLabel}
                {selected ? <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-700" /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function AssessmentReview({ form }: { form: AssessmentForm }) {
  const rows = [
    ["Age", `${form.age} years`],
    ["Sex", form.sex === "female" ? "Female" : "Male"],
    ["Systolic blood pressure", form.bpKnown === "known" ? `${form.systolicBp} mmHg` : "Not sure"],
    ["Total cholesterol", form.cholesterolKnown === "known" ? `${form.cholesterol} mg/dL` : "Not sure"],
    ["Blood glucose", labelize(form.glucose)],
    ["Diabetes history", labelize(form.diabetes)],
    ["Weight category", labelize(form.weightCategory)],
    ["Smoking status", labelize(form.smoking)],
    ["Physical activity", labelize(form.activity)],
    ["BP medication", labelize(form.bpMedication)],
    ["Family history", labelize(form.familyHistory)],
    ["Current symptoms", labelize(form.symptoms)],
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
          <strong className="mt-1 block text-slate-900">{value}</strong>
        </div>
      ))}
    </div>
  );
}

function labelize(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
