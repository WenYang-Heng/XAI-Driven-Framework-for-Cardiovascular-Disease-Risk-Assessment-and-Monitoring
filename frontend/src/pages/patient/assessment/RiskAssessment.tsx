import { Check, CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
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
  prediction?: {
    risk_level: string;
    confidence_level: string;
  } | null;
  error?: string | null;
  isLoading?: boolean;
  readOnly?: boolean;
  onComplete: () => void | Promise<void>;
  onExitReadOnly?: () => void;
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
  prediction,
  error,
  isLoading = false,
  readOnly = false,
  onComplete,
  onExitReadOnly,
  Notice,
  SectionTitle,
}: RiskAssessmentProps) {
  const currentStep = assessmentSteps[step];
  const isLastStep = step === assessmentSteps.length - 1;

  return (
    <section className="grid gap-6">
      <SectionTitle
        label={readOnly ? "Assessment record" : "CVD risk assessment"}
        title={readOnly ? "View saved assessment" : "Build your risk profile step by step"}
        description={
          readOnly
            ? "This is a read-only copy of the answers saved for this assessment."
            : "The assessment uses simple questions and helpful hints so general users can complete it without medical training."
        }
      />

      <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[240px_minmax(0,820px)_240px] lg:items-start xl:gap-14">
        <aside className="px-1 lg:sticky lg:top-6">
          <div className="grid gap-0">
            {assessmentSteps.map((item, index) => {
              const selected = index === step;
              const completed = index < step;
              const isLast = index === assessmentSteps.length - 1;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStep(index)}
                  className="group grid w-full grid-cols-[32px_1fr] gap-3 text-left"
                >
                  <span className="grid justify-items-center">
                    <span
                      className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold shadow-sm transition ${
                        completed
                          ? "bg-emerald-500 text-white"
                          : selected
                            ? "bg-cyan-600 text-white"
                            : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {completed ? <Check className="h-3.5 w-3.5" /> : index + 1}
                    </span>
                    {!isLast ? (
                      <span
                        className={`h-10 w-px ${
                          completed ? "bg-emerald-300" : "border-l border-dashed border-slate-300"
                        }`}
                      />
                    ) : null}
                  </span>
                  <span
                    className={`pt-1.5 text-sm font-semibold transition ${
                      completed
                        ? "text-emerald-700"
                        : selected
                          ? "text-cyan-700"
                          : "text-slate-500 group-hover:text-slate-700"
                    }`}
                  >
                    {item.title}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <Card className="p-6">
          <CardHeader title={currentStep.title} subtitle={currentStep.description} />
          <div className="mt-6">
            {step === 0 ? <BasicsStep form={form} updateField={updateField} readOnly={readOnly} /> : null}
            {step === 1 ? <NumbersStep form={form} updateField={updateField} readOnly={readOnly} /> : null}
            {step === 2 ? <HabitsStep form={form} updateField={updateField} readOnly={readOnly} /> : null}
            {step === 3 ? (
              <div className="grid gap-4">
                <AssessmentReview form={form} />
                {error ? <Notice tone="danger">{error}</Notice> : null}
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
              readOnly ? (
                <Button type="button" onClick={onExitReadOnly}>
                  Back to records
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button type="button" disabled={isLoading} onClick={onComplete}>
                  {isLoading ? "Assessing..." : "Assess"}
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              )
            ) : (
              <Button type="button" onClick={() => setStep(Math.min(assessmentSteps.length - 1, step + 1))}>
                Continue
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </Card>
        <div className="hidden lg:block" />
      </div>
    </section>
  );
}

function BasicsStep({
  form,
  updateField,
  readOnly = false,
}: {
  form: AssessmentForm;
  updateField: RiskAssessmentProps["updateField"];
  readOnly?: boolean;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <NumberField label="Age" value={form.age} min={18} max={95} unit="years" helper="Use your current age." readOnly={readOnly} onChange={(value) => updateField("age", value)} />
      <NumberField label="Height" value={form.heightCm} min={120} max={220} unit="cm" helper="Used with weight to estimate BMI for the model." readOnly={readOnly} onChange={(value) => updateField("heightCm", value)} />
      <NumberField label="Weight" value={form.weightKg} min={30} max={200} unit="kg" helper="Use your current weight if you know it." readOnly={readOnly} onChange={(value) => updateField("weightKg", value)} />
      <ChoiceGroup
        label="Sex"
        value={form.sex}
        columns="two"
        options={[
          ["female", "Female"],
          ["male", "Male"],
        ]}
        readOnly={readOnly}
        onChange={(value) => updateField("sex", value as AssessmentForm["sex"])}
      />
    </div>
  );
}

function NumbersStep({ form, updateField, readOnly = false }: { form: AssessmentForm; updateField: RiskAssessmentProps["updateField"]; readOnly?: boolean }) {
  return (
    <div className="grid gap-5">
      <fieldset>
        <legend className="text-sm font-semibold text-slate-700">What is your blood pressure?</legend>
        <div className="mt-3 grid gap-5 md:grid-cols-2">
          <NumberField label="Systolic blood pressure" value={form.systolicBp} min={80} max={220} unit="mmHg" helper="This is the upper number, for example 132 in 132/84." readOnly={readOnly} onChange={(value) => {
            updateField("bpInputType", "exact");
            updateField("systolicBp", value);
          }} />
          <NumberField label="Diastolic blood pressure" value={form.diastolicBp} min={40} max={140} unit="mmHg" helper="This is the lower number, for example 84 in 132/84." readOnly={readOnly} onChange={(value) => {
            updateField("bpInputType", "exact");
            updateField("diastolicBp", value);
          }} />
        </div>
      </fieldset>
      <ChoiceGroup
        label="What is your cholesterol level?"
        value={form.cholesterolCategory}
        options={[
          ["normal", "Normal"],
          ["above_normal", "Above normal"],
          ["well_above_normal", "Well above normal"],
        ]}
        readOnly={readOnly}
        onChange={(value) => {
          updateField("cholesterolInputType", "category");
          updateField("cholesterolCategory", value as AssessmentForm["cholesterolCategory"]);
        }}
      />
      <ChoiceGroup
        label="What is your blood glucose level?"
        value={form.glucoseCategory}
        options={[
          ["normal", "Normal"],
          ["above_normal", "Above normal"],
          ["well_above_normal", "Well above normal"],
        ]}
        readOnly={readOnly}
        onChange={(value) => {
          updateField("glucoseInputType", "category");
          updateField("glucoseCategory", value as AssessmentForm["glucoseCategory"]);
        }}
      />
      <RangeGuide />
    </div>
  );
}

function HabitsStep({ form, updateField, readOnly = false }: { form: AssessmentForm; updateField: RiskAssessmentProps["updateField"]; readOnly?: boolean }) {
  return (
    <div className="grid gap-5">
      <ChoiceGroup label="Do you currently smoke?" value={form.smoking} options={[["no", "No"], ["yes", "Yes"]]} readOnly={readOnly} onChange={(value) => updateField("smoking", value as AssessmentForm["smoking"])} />
      <ChoiceGroup label="Do you do regular physical activity?" value={form.activity} options={[["no", "No"], ["yes", "Yes"]]} helper="Choose yes if you do at least some regular walking, exercise, sport, or active daily movement." readOnly={readOnly} onChange={(value) => updateField("activity", value as AssessmentForm["activity"])} />
      <ChoiceGroup label="Do you consume alcohol?" value={form.alcoholIntake} options={[["no", "No"], ["yes", "Yes"]]} helper="Choose yes if you regularly drink alcohol." readOnly={readOnly} onChange={(value) => updateField("alcoholIntake", value as AssessmentForm["alcoholIntake"])} />
    </div>
  );
}

function NumberField({ label, value, min, max, unit, helper, readOnly = false, onChange }: { label: string; value: number; min: number; max: number; unit: string; helper: string; readOnly?: boolean; onChange: (value: number) => void }) {
  return (
    <label className="block rounded-[20px] border border-slate-200 bg-slate-50 p-4">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <div className="mt-3 flex items-center gap-3">
        <input className="form-input mt-0 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500" type="number" min={min} max={max} value={value} disabled={readOnly} onChange={(event) => onChange(Number(event.target.value))} />
        <span className="w-16 text-sm font-semibold text-slate-500">{unit}</span>
      </div>
      <small className="mt-3 block leading-5 text-slate-500">{helper}</small>
    </label>
  );
}

function ChoiceGroup({ label, value, options, helper, columns = "three", readOnly = false, onChange }: { label: string; value: string; options: string[][]; helper?: string; columns?: "two" | "three"; readOnly?: boolean; onChange: (value: string) => void }) {
  const gridClassName = columns === "two" ? "sm:grid-cols-2" : "sm:grid-cols-3";

  return (
    <fieldset>
      <legend className="text-sm font-semibold text-slate-700">{label}</legend>
      {helper ? <p className="mt-1 text-sm text-slate-500">{helper}</p> : null}
      <div className={`mt-3 grid gap-3 ${gridClassName}`}>
        {options.map(([optionValue, optionLabel]) => {
          const selected = value === optionValue;
          return (
            <button key={optionValue} type="button" disabled={readOnly} onClick={() => onChange(optionValue)} className={`min-h-16 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition disabled:cursor-not-allowed ${selected ? "border-cyan-300 bg-cyan-50 text-cyan-900 ring-2 ring-cyan-100" : "border-slate-200 bg-white text-slate-600 hover:border-cyan-200 hover:bg-cyan-50 disabled:hover:border-slate-200 disabled:hover:bg-white"}`}>
              <span className="grid grid-cols-[1fr_18px] items-center gap-3">
                <span className="min-w-0 break-words">{optionLabel}</span>
                {selected ? <CheckCircle2 className="h-4 w-4 text-cyan-700" /> : <span />}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function RangeGuide() {
  return (
    <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4 text-sm text-slate-700">
      <p className="font-semibold text-cyan-900">Range guide</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <p className="font-semibold text-slate-800">Total cholesterol</p>
          <p className="mt-1 leading-6">Normal: below 200 mg/dL</p>
          <p className="leading-6">Above normal: 200-239 mg/dL</p>
          <p className="leading-6">Well above normal: 240 mg/dL or higher</p>
        </div>
        <div>
          <p className="font-semibold text-slate-800">Fasting blood glucose</p>
          <p className="mt-1 leading-6">Normal: below 100 mg/dL</p>
          <p className="leading-6">Above normal: 100-125 mg/dL</p>
          <p className="leading-6">Well above normal: 126 mg/dL or higher</p>
        </div>
      </div>
      <p className="mt-3 leading-6 text-slate-500">
        Use the category shown on your health report if available. These ranges are general guides.
      </p>
    </div>
  );
}

function AssessmentReview({ form }: { form: AssessmentForm }) {
  const rows = [
    ["Age", `${form.age} years`],
    ["Sex", form.sex === "female" ? "Female" : "Male"],
    ["Height", `${form.heightCm} cm`],
    ["Weight", `${form.weightKg} kg`],
    ["Blood pressure", `${form.systolicBp}/${form.diastolicBp} mmHg`],
    ["Total cholesterol", labelize(form.cholesterolCategory)],
    ["Blood glucose", labelize(form.glucoseCategory)],
    ["Smoking status", labelize(form.smoking)],
    ["Regular physical activity", labelize(form.activity)],
    ["Alcohol intake", labelize(form.alcoholIntake)],
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <span className="block text-xs font-bold uppercase tracking-wide text-slate-600">{label}</span>
          <strong className="mt-1 block text-slate-950">{value}</strong>
        </div>
      ))}
    </div>
  );
}

function labelize(value: string) {
  return value
    .split("_")
    .join(" ")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
