import { ArrowDown, ArrowUp, ChevronsUpDown, Eye, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { HistoryItem } from '../types';
import { API_BASE_URL } from '../constants';
import { Card } from '../../../components/ui/Card';
import { FilterSelect, IconButton } from './Shared';

export function AssessmentHistory({
  userId,
  onViewReport,
}: {
  userId?: string;
  onViewReport: (item: HistoryItem) => void;
}) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");
  const [sortKey, setSortKey] = useState<"assessment_date" | "risk_score" | "risk_level">("assessment_date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HistoryItem | null>(null);

  useEffect(() => {
    if (!userId) {
      setError("Sign in to load saved assessment history.");
      return;
    }

    const controller = new AbortController();

    async function loadHistory() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/history/predictions/${userId}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Unable to load saved assessment history.");
        }

        const data = (await response.json()) as { success: boolean; items: HistoryItem[] };
        setItems(data.items);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Unable to load saved assessment history.");
      }
    }

    loadHistory();
    return () => controller.abort();
  }, [userId]);

  const filteredItems = items
    .filter((item) => {
      const needle = query.toLowerCase();
      const matchesRisk = riskFilter === "All" || item.risk_level.toLowerCase() === riskFilter.toLowerCase();
      return matchesRisk && [item.patient_reference_id, item.request_id, item.result_id, item.model_name, item.risk_level]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    })
    .sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      if (sortKey === "risk_score") {
        return (a.risk_score - b.risk_score) * direction;
      }
      return String(a[sortKey]).localeCompare(String(b[sortKey])) * direction;
    });

  async function deleteRecord(resultId: string) {
    const response = await fetch(`${API_BASE_URL}/api/predictions/${resultId}?user_id=${userId ?? ""}`, {
      method: "DELETE",
    });
    if (response.ok) {
      setItems((current) => current.filter((item) => item.result_id !== resultId));
      setDeleteTarget(null);
      return;
    }
    setError("Unable to remove this assessment record.");
  }

  function changeSort(nextKey: typeof sortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection("desc");
  }

  return (
    <Card className="p-6">
      <div className="grid max-w-xl gap-3 sm:grid-cols-[minmax(260px,1fr)_180px]">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Search
          </span>
          <input
            className="mt-1 min-h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
            value={query}
            placeholder="Patient, result, risk"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <FilterSelect label="Risk category" value={riskFilter} onChange={setRiskFilter} options={["All", "High", "Moderate", "Low"]} />
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
          {error}
        </p>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-[20px] border border-slate-200">
        <table className="w-full min-w-[900px] border-collapse bg-white text-left text-sm">
          <thead className="bg-slate-50 text-sm text-slate-600">
            <tr>
              <th className="px-5 py-4 font-bold">Patient Reference</th>
              <th className="px-5 py-4 font-bold">
                <SortHeader
                  label="Assessment Date"
                  sortKeyName="assessment_date"
                  activeSortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={changeSort}
                />
              </th>
              <th className="px-5 py-4 font-bold">Model</th>
              <th className="px-5 py-4 font-bold">
                <SortHeader
                  label="Risk Score"
                  sortKeyName="risk_score"
                  activeSortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={changeSort}
                />
              </th>
              <th className="px-5 py-4 font-bold">
                <SortHeader
                  label="Risk Category"
                  sortKeyName="risk_level"
                  activeSortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={changeSort}
                />
              </th>
              <th className="px-5 py-4 font-bold">Feedback Status</th>
              <th className="px-5 py-4 font-bold">Entry Type</th>
              <th className="px-5 py-4 font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredItems.map((row) => (
              <tr key={row.result_id} className="hover:bg-slate-50/70">
                <td className="px-5 py-4 font-semibold text-slate-950">{row.patient_reference_id ?? row.request_id.slice(0, 8)}</td>
                <td className="px-5 py-4 text-slate-600">
                  {formatDate(row.assessment_date ?? row.created_at)}
                </td>
                <td className="px-5 py-4 text-slate-600">{row.model_name}</td>
                <td className="px-5 py-4 font-semibold text-slate-950">
                  {Math.round(row.risk_score * 100)}%
                </td>
                <td className="px-5 py-4 text-slate-600">
                  {formatCategory(row.risk_level)}
                </td>
                <td className="px-5 py-4 text-slate-600">
                  {formatCategory(row.feedback_status ?? "pending")}
                </td>
                <td className="px-5 py-4 text-slate-600">
                  {formatCategory(row.entry_type ?? "single")}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <IconButton label="View report" onClick={() => onViewReport(row)}>
                      <Eye className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="Remove record" onClick={() => setDeleteTarget(row)}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-950">
              Remove Assessment Record?
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              This will remove the saved assessment result for{" "}
              <span className="font-bold text-slate-900">
                {deleteTarget.patient_reference_id ?? deleteTarget.result_id.slice(0, 8)}
              </span>
              . This action cannot be undone.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="min-h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-cyan-100"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="min-h-11 rounded-2xl bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-100"
                onClick={() => deleteRecord(deleteTarget.result_id)}
              >
                Remove Record
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function SortHeader({
  label,
  sortKeyName,
  activeSortKey,
  sortDirection,
  onSort,
}: {
  label: string;
  sortKeyName: "assessment_date" | "risk_score" | "risk_level";
  activeSortKey: "assessment_date" | "risk_score" | "risk_level";
  sortDirection: "asc" | "desc";
  onSort: (key: "assessment_date" | "risk_score" | "risk_level") => void;
}) {
  const isActive = activeSortKey === sortKeyName;
  const Icon = isActive ? (sortDirection === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;

  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 font-bold transition ${
        isActive ? "text-slate-950" : "text-slate-600 hover:text-slate-950"
      }`}
      onClick={() => onSort(sortKeyName)}
      aria-sort={isActive ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
    >
      {label}
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatCategory(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}
