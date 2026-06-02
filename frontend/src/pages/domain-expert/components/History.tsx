import { Eye, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { HistoryItem } from '../types';
import { API_BASE_URL } from '../constants';
import { riskLabel } from '../utils';
import { Badge } from '../../../components/ui/Badge';
import { Card, CardHeader } from '../../../components/ui/Card';
import { FilterSelect, IconButton, RiskBadge } from './Shared';

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
  const [sortKey, setSortKey] = useState<"assessment_date" | "risk_score" | "risk_level" | "model_version">("assessment_date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [error, setError] = useState<string | null>(null);

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
      return matchesRisk && [item.patient_reference_id, item.request_id, item.result_id, item.model_name, item.model_version, item.risk_level]
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
    }
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <CardHeader
          title="Saved Assessment Records"
          subtitle="Prediction records are saved automatically after each assessment."
        />
        <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_160px]">
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
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
          {error}
        </p>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-[20px] border border-slate-200">
        <table className="w-full min-w-[900px] border-collapse bg-white text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-4 font-bold">Patient Reference</th>
              <th className="px-5 py-4 font-bold">
                <button className="font-bold" onClick={() => changeSort("assessment_date")}>Date</button>
              </th>
              <th className="px-5 py-4 font-bold">Model</th>
              <th className="px-5 py-4 font-bold">
                <button className="font-bold" onClick={() => changeSort("model_version")}>Version</button>
              </th>
              <th className="px-5 py-4 font-bold">
                <button className="font-bold" onClick={() => changeSort("risk_score")}>Risk Score</button>
              </th>
              <th className="px-5 py-4 font-bold">
                <button className="font-bold" onClick={() => changeSort("risk_level")}>Risk Category</button>
              </th>
              <th className="px-5 py-4 font-bold">Feedback</th>
              <th className="px-5 py-4 font-bold">Entry Type</th>
              <th className="px-5 py-4 font-bold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredItems.map((row) => (
              <tr key={row.result_id} className="hover:bg-slate-50/70">
                <td className="px-5 py-4 font-semibold text-slate-950">{row.patient_reference_id ?? row.request_id.slice(0, 8)}</td>
                <td className="px-5 py-4 text-slate-600">
                  {new Date(row.assessment_date ?? row.created_at).toLocaleDateString()}
                </td>
                <td className="px-5 py-4 text-slate-600">{row.model_name}</td>
                <td className="px-5 py-4 text-slate-600">{row.model_version ?? "-"}</td>
                <td className="px-5 py-4 font-semibold text-slate-950">
                  {Math.round(row.risk_score * 100)}%
                </td>
                <td className="px-5 py-4">
                  <RiskBadge category={riskLabel(row.risk_level)} />
                </td>
                <td className="px-5 py-4">
                  <Badge tone={row.feedback_status === "reviewed" ? "green" : "amber"}>
                    {row.feedback_status === "reviewed" ? "Reviewed" : "Pending"}
                  </Badge>
                </td>
                <td className="px-5 py-4">
                  <Badge tone="cyan">{row.entry_type ?? "single"}</Badge>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <IconButton label="View report" onClick={() => onViewReport(row)}>
                      <Eye className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="Edit record">
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="Remove record" onClick={() => deleteRecord(row.result_id)}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
