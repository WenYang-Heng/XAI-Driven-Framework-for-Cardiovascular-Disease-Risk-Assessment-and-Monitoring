import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card, CardHeader } from "../../../components/ui/Card";
import type { ActivityLogEntry, ActivityLogResponse, ActivityStatus, Tone } from "../types";
import { useAdminData } from "../useAdminData";
import { Notice, formatDateTime } from "./Shared";

const CATEGORY_OPTIONS = [
  { value: "", label: "All events" },
  { value: "auth", label: "Logins" },
  { value: "assessment", label: "Assessments" },
  { value: "batch", label: "Batch uploads" },
  { value: "feedback", label: "Expert feedback" },
  { value: "patient", label: "Patient records" },
  { value: "report", label: "Reports" },
  { value: "system", label: "System" },
];

const selectClass =
  "h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100";

export function ActivityLog({ days }: { days: number }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<ActivityStatus | "">("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => setPage(1), [days, debouncedQuery, category, status, sortOrder, pageSize]);

  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    search: debouncedQuery,
    sort_order: sortOrder,
    days: String(days),
  });
  if (category) params.set("category", category);
  if (status) params.set("status", status);

  const { data, error, isLoading } = useAdminData<ActivityLogResponse>(`/activity-logs?${params.toString()}`);
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const startRecord = total ? (page - 1) * pageSize + 1 : 0;

  return (
    <Card className="p-6">
      <CardHeader
        title="Platform Activity Log"
        subtitle={`Logins, assessments, inference requests, batch uploads, feedback and reports from the last ${days} days.`}
        action={<Badge tone={error ? "amber" : "cyan"}>{error ? "Unavailable" : `${total} records`}</Badge>}
      />

      <div className="mt-6 flex flex-col gap-3 xl:flex-row xl:items-center">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search user, email, action or record ID"
          className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
        />
        <div className="flex flex-wrap items-center gap-3">
          <select value={category} onChange={(event) => setCategory(event.target.value)} className={selectClass} aria-label="Event type">
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as ActivityStatus | "")}
            className={selectClass}
            aria-label="Status"
          >
            <option value="">Any status</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="failed">Failed</option>
          </select>
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className={selectClass} aria-label="Page size">
            {[10, 25, 50].map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
          <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            {(["desc", "asc"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSortOrder(option)}
                className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                  sortOrder === option ? "bg-white text-cyan-700 shadow-sm" : "text-slate-500 hover:text-slate-950"
                }`}
              >
                {option === "desc" ? "Newest" : "Oldest"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <div className="mt-4">
          <Notice>{error}</Notice>
        </div>
      ) : null}

      <div className="mt-6">
        <ActivityTable items={data?.items ?? []} emptyMessage={isLoading ? "Loading activity logs..." : "No activity matches the current filters."} />
      </div>

      <div className="mt-5 flex flex-col gap-3 text-sm font-semibold text-slate-500 lg:flex-row lg:items-center lg:justify-between">
        <span>
          Showing {startRecord}-{Math.min(page * pageSize, total)} of {total}
        </span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" disabled={page <= 1 || isLoading} onClick={() => setPage((current) => current - 1)}>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="min-w-24 text-center text-slate-600">
            Page {page} of {pageCount}
          </span>
          <Button
            type="button"
            variant="secondary"
            disabled={page >= pageCount || isLoading}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function ActivityTable({ items, emptyMessage }: { items: ActivityLogEntry[]; emptyMessage: string }) {
  return (
    <div className="overflow-x-auto rounded-[20px] border border-slate-200">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
          <tr>
            {["Timestamp", "User", "Event", "Record", "Status"].map((heading) => (
              <th key={heading} className="px-4 py-3">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.length ? (
            items.map((log) => (
              <tr key={log.log_id} className="border-t border-slate-200 align-top">
                <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">{formatDateTime(log.timestamp)}</td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-950">{log.actor_name || log.actor_email || shortId(log.actor) || "System"}</p>
                  <p className="text-xs text-slate-400">
                    {[roleLabel(log.actor_role), log.actor_name && log.actor_email ? log.actor_email : null].filter(Boolean).join(" · ")}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-bold text-slate-950">{formatAction(log.action)}</p>
                  <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{log.category}</p>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  <p>{log.entity_type ?? "–"}</p>
                  <p className="font-mono text-xs text-slate-400" title={log.entity_id ?? undefined}>
                    {shortId(log.entity_id)}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone[log.status]}>{log.status}</Badge>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center font-semibold text-slate-500">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const statusTone: Record<ActivityStatus, Tone> = { success: "green", warning: "amber", failed: "red" };

function shortId(value?: string | null) {
  if (!value) {
    return "";
  }
  return value.length <= 12 ? value : `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function roleLabel(role?: string | null) {
  return role ? role.replace("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : null;
}

function formatAction(action: string) {
  return action
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
