import { useState } from "react";
import type { ReactNode } from "react";
import { Download, FileSpreadsheet, FileText, Loader2, Printer } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card, CardHeader } from "../../../components/ui/Card";
import { adminRequest } from "../api";
import type { ModelName, ReportResponse, ReportSection } from "../types";
import { ActivityTable } from "./ActivityLog";
import { DriftContent } from "./Drift";
import { FairnessContent } from "./Fairness";
import { OverviewContent } from "./Overview";
import { PerformanceContent } from "./Performance";
import { MODEL_OPTIONS, Notice, formatDateTime, modelLabel } from "./Shared";

const SECTIONS: { value: ReportSection; label: string; description: string }[] = [
  { value: "activity", label: "Assessment activity", description: "Totals, risk distribution, daily usage" },
  { value: "performance", label: "Model performance", description: "Accuracy, AUC-ROC, sensitivity, specificity" },
  { value: "fairness", label: "Fairness and bias", description: "Cohort TPR/FPR gaps and live parity" },
  { value: "drift", label: "Input trends and data drift", description: "PSI per feature against training baseline" },
  { value: "activity_log", label: "Activity log", description: "Latest 100 platform events" },
];

const RANGE_OPTIONS = [7, 30, 90, 365];

type Phase = { name: "idle" } | { name: "loading" } | { name: "confirm"; report: ReportResponse } | { name: "ready"; report: ReportResponse };

export function Reports({ defaultDays }: { defaultDays: number }) {
  const [sections, setSections] = useState<ReportSection[]>(SECTIONS.map((section) => section.value));
  const [days, setDays] = useState(defaultDays);
  const [model, setModel] = useState<ModelName>("xgboost");
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setError(null);
    setPhase({ name: "loading" });
    try {
      const report = await adminRequest<ReportResponse>("/reports", {
        method: "POST",
        body: JSON.stringify({ sections, days, model_name: model }),
      });
      setPhase(report.partial ? { name: "confirm", report } : { name: "ready", report });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Report generation failed.");
      setPhase({ name: "idle" });
    }
  }

  function toggle(section: ReportSection) {
    setSections((current) =>
      current.includes(section) ? current.filter((item) => item !== section) : [...current, section],
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 no-print">
        <CardHeader
          title="Generate Monitoring Report"
          subtitle="Choose the sections, period and model, then view, print to PDF or export the report as CSV."
        />
        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_320px]">
          <div className="grid gap-3 md:grid-cols-2">
            {SECTIONS.map((section) => (
              <label
                key={section.value}
                className={`flex cursor-pointer items-start gap-3 rounded-[18px] border p-4 transition ${
                  sections.includes(section.value) ? "border-cyan-300 bg-cyan-50" : "border-slate-200 bg-white hover:border-cyan-200"
                }`}
              >
                <input
                  type="checkbox"
                  checked={sections.includes(section.value)}
                  onChange={() => toggle(section.value)}
                  className="mt-1 h-4 w-4 accent-cyan-600"
                />
                <span>
                  <span className="block text-sm font-bold text-slate-950">{section.label}</span>
                  <span className="block text-xs text-slate-500">{section.description}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-bold text-slate-700">Period</span>
              <select
                value={days}
                onChange={(event) => setDays(Number(event.target.value))}
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
              >
                {RANGE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    Last {option} days
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-700">Model for fairness review</span>
              <select
                value={model}
                onChange={(event) => setModel(event.target.value as ModelName)}
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
              >
                {MODEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <Button className="w-full" onClick={generate} disabled={!sections.length || phase.name === "loading"}>
              {phase.name === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {phase.name === "loading" ? "Compiling report..." : "Generate report"}
            </Button>
            {!sections.length ? <p className="text-xs font-semibold text-red-600">Select at least one section.</p> : null}
          </div>
        </div>
        {error ? (
          <div className="mt-4">
            <Notice tone="red">{error}</Notice>
          </div>
        ) : null}
      </Card>

      {phase.name === "confirm" ? (
        <Card className="p-6 no-print">
          <CardHeader title="Some report data is unavailable" subtitle="The report can still be generated with the data that is available." />
          <ul className="mt-4 space-y-2 text-sm">
            {phase.report.unavailable.map((gap) => (
              <li key={gap.section} className="rounded-xl bg-amber-50 px-4 py-2 text-amber-900">
                <span className="font-bold">{SECTIONS.find((section) => section.value === gap.section)?.label}:</span> {gap.reason}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex gap-3">
            <Button onClick={() => setPhase({ name: "ready", report: phase.report })}>Continue with partial report</Button>
            <Button variant="secondary" onClick={() => setPhase({ name: "idle" })}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      {phase.name === "ready" ? <ReportView report={phase.report} /> : null}
    </div>
  );
}

function ReportView({ report }: { report: ReportResponse }) {
  const { sections } = report;
  const included = SECTIONS.filter((section) => sections[section.value]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 no-print">
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Print / save as PDF
        </Button>
        <Button variant="secondary" onClick={() => download(`monitoring-report-${stamp(report)}.csv`, reportCsv(report), "text/csv")}>
          <FileSpreadsheet className="h-4 w-4" />
          Export CSV
        </Button>
        <Button
          variant="secondary"
          onClick={() => download(`monitoring-report-${stamp(report)}.json`, JSON.stringify(report, null, 2), "application/json")}
        >
          <Download className="h-4 w-4" />
          Export JSON
        </Button>
      </div>

      <div id="admin-report" className="space-y-6">
        <Card className="p-6">
          <p className="text-sm font-semibold text-cyan-700">CardioXAI · AI Monitoring Report</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">Monitoring report: last {report.days} days</h2>
          <p className="mt-1 text-sm text-slate-500">
            Generated {formatDateTime(report.generated_at)} · Fairness model: {modelLabel(report.model_name)} · Sections:{" "}
            {included.map((section) => section.label).join(", ")}
          </p>
          {report.partial ? (
            <div className="mt-4">
              <Notice>
                Partial report. Unavailable: {report.unavailable.map((gap) => `${gap.section} (${gap.reason})`).join("; ")}
              </Notice>
            </div>
          ) : (
            <Badge tone="green" className="mt-4">
              Complete
            </Badge>
          )}
        </Card>

        {sections.activity ? (
          <ReportSectionBlock title="1. Assessment activity">
            <OverviewContent data={sections.activity} compact />
          </ReportSectionBlock>
        ) : null}
        {sections.performance ? (
          <ReportSectionBlock title="2. Model performance">
            <PerformanceContent data={sections.performance} days={report.days} compact />
          </ReportSectionBlock>
        ) : null}
        {sections.fairness ? (
          <ReportSectionBlock title="3. Fairness and bias">
            <FairnessContent data={sections.fairness} days={report.days} compact />
          </ReportSectionBlock>
        ) : null}
        {sections.drift ? (
          <ReportSectionBlock title="4. Input trends and data drift">
            <DriftContent data={sections.drift} days={report.days} compact />
          </ReportSectionBlock>
        ) : null}
        {sections.activity_log ? (
          <ReportSectionBlock title={`5. Activity log (latest ${sections.activity_log.items.length} of ${sections.activity_log.total})`}>
            <ActivityTable items={sections.activity_log.items} emptyMessage="No activity in this period." />
          </ReportSectionBlock>
        ) : null}
      </div>
    </div>
  );
}

function ReportSectionBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="report-section space-y-4">
      <h3 className="text-xl font-bold text-slate-950">{title}</h3>
      {children}
    </section>
  );
}

function stamp(report: ReportResponse) {
  return report.generated_at.slice(0, 10);
}

function download(fileName: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function table(title: string, header: string[], rows: unknown[][]) {
  return [title, header.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(",")), ""];
}

/** Flattens every section into one CSV with a titled block per table. */
function reportCsv(report: ReportResponse) {
  const { sections } = report;
  const lines = [
    `CardioXAI monitoring report,generated ${report.generated_at},last ${report.days} days`,
    report.partial ? `Partial report,${report.unavailable.map((gap) => `${gap.section}: ${gap.reason}`).join("; ")}` : "Complete report",
    "",
  ];

  if (sections.activity) {
    lines.push(...table("Assessment totals", ["metric", "value"], Object.entries(sections.activity.totals)));
    lines.push(...table("Risk distribution", ["risk_level", "count"], sections.activity.risk_distribution.map((row) => [row.risk_level, row.count])));
    lines.push(...table("Daily usage", ["day", "total", "low", "moderate", "high"], sections.activity.daily.map((row) => [row.day, row.total, row.low, row.moderate, row.high])));
  }
  if (sections.performance) {
    lines.push(
      ...table(
        `Model performance (${sections.performance.source})`,
        ["model", "accuracy", "precision", "sensitivity", "specificity", "f1", "auc_roc", "meets_nfr02"],
        sections.performance.models.map((model) => [
          model.model_name, model.accuracy, model.precision, model.sensitivity_recall,
          model.specificity, model.f1_score, model.auc_roc, model.meets_targets,
        ]),
      ),
    );
  }
  if (sections.fairness?.evaluation) {
    lines.push(
      ...table(
        `Fairness (${sections.fairness.evaluation.model_name}, ${sections.fairness.evaluation.evaluation_method})`,
        ["attribute", "group", "n", "prevalence", "selection_rate", "tpr", "fpr", "tpr_gap", "fpr_gap", "attribute_status"],
        sections.fairness.evaluation.attributes.flatMap((attribute) =>
          attribute.groups.map((group) => [
            attribute.label, group.group, group.sample_size, group.prevalence, group.selection_rate,
            group.true_positive_rate, group.false_positive_rate, group.tpr_gap, group.fpr_gap, attribute.status,
          ]),
        ),
      ),
    );
  }
  if (sections.fairness) {
    lines.push(
      ...table(
        "Live prediction parity",
        ["attribute", "group", "assessments", "high_risk_rate"],
        sections.fairness.live_parity.map((row) => [row.attribute, row.group, row.assessments, row.high_risk_rate]),
      ),
    );
  }
  if (sections.drift?.drift) {
    lines.push(
      ...table(
        `Data drift (PSI, ${sections.drift.drift.current_size} records)`,
        ["feature", "psi", "status", "baseline_mean", "current_mean"],
        sections.drift.drift.features.map((feature) => [feature.label, feature.psi, feature.status, feature.baseline_mean, feature.current_mean]),
      ),
    );
  }
  if (sections.activity_log) {
    lines.push(
      ...table(
        "Activity log",
        ["timestamp", "user", "role", "action", "category", "entity_type", "entity_id", "status"],
        sections.activity_log.items.map((log) => [
          log.timestamp, log.actor_email ?? log.actor ?? "System", log.actor_role, log.action,
          log.category, log.entity_type, log.entity_id, log.status,
        ]),
      ),
    );
  }
  return lines.join("\n");
}
