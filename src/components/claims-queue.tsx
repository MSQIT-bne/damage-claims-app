"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ClaimRow = {
  id: string;
  desk365TicketId: string;
  title: string | null;
  claimant: string | null;
  claimType: string;
  processingState: string;
  assessmentOutcome: string | null;
  updatedAt: string;
  reviewer: { name: string | null; email: string } | null;
  _count: { evidenceFiles: number; validationIssues: number };
};

const stateColors: Record<string, string> = {
  QUEUED: "bg-gray-100 text-gray-700",
  COLLECTING: "bg-yellow-100 text-yellow-800",
  ANALYSING: "bg-blue-100 text-blue-800",
  AWAITING_REVIEW: "bg-orange-100 text-orange-800",
  FAILED: "bg-red-100 text-red-800",
  FINALISED: "bg-green-100 text-green-800",
};

const outcomeColors: Record<string, string> = {
  COMPLETE: "bg-green-100 text-green-800",
  INCOMPLETE: "bg-yellow-100 text-yellow-800",
  REVIEW_REQUIRED: "bg-red-100 text-red-800",
};

const filters = [
  { label: "All", value: "" },
  { label: "Awaiting Review", value: "AWAITING_REVIEW" },
  { label: "Complete", value: "COMPLETE" },
  { label: "Incomplete", value: "INCOMPLETE" },
  { label: "Review Required", value: "REVIEW_REQUIRED" },
  { label: "Failed", value: "FAILED" },
];

export function ClaimsQueue() {
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  function fetchClaims(f: string) {
    setLoading(true);
    const params = new URLSearchParams();
    if (f) {
      if (["QUEUED","COLLECTING","ANALYSING","AWAITING_REVIEW","FAILED","FINALISED"].includes(f)) {
        params.set("state", f);
      } else {
        params.set("outcome", f);
      }
    }
    fetch(`/api/claims?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setClaims(data.claims ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchClaims(filter); }, [filter]);

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setSyncResult(
          data.queued > 0
            ? `${data.queued} new ticket${data.queued !== 1 ? "s" : ""} pulled in`
            : "No new tickets found"
        );
        fetchClaims(filter);
      } else {
        setSyncResult(`Sync failed: ${data.error}`);
      }
    } catch {
      setSyncResult("Sync failed: network error");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f.value
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-3">
          {syncResult && (
            <span className="text-xs text-gray-500">{syncResult}</span>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <svg
              className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {syncing ? "Syncing…" : "Sync Desk365"}
          </button>
          <span className="text-sm text-gray-500">
            {total} claim{total !== 1 ? "s" : ""}
          </span>
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : claims.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No claims found</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["Ticket", "Claimant", "Type", "Evidence", "State", "Outcome", "Reviewer", "Updated"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {claims.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/claims/${c.id}`}
                      className="text-blue-600 hover:underline font-medium text-sm"
                    >
                      #{c.desk365TicketId}
                    </Link>
                    {c.title && (
                      <div className="text-xs text-gray-500 truncate max-w-[180px]">
                        {c.title}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {c.claimant ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {c.claimType.replace(/-/g, " ")}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {c._count.evidenceFiles} files
                    {c._count.validationIssues > 0 && (
                      <span className="ml-1 text-red-500">
                        · {c._count.validationIssues} issues
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${stateColors[c.processingState] ?? ""}`}
                    >
                      {c.processingState.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.assessmentOutcome ? (
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${outcomeColors[c.assessmentOutcome] ?? ""}`}
                      >
                        {c.assessmentOutcome.replace(/_/g, " ")}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {c.reviewer?.name ?? c.reviewer?.email ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(c.updatedAt).toLocaleDateString("en-AU", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
