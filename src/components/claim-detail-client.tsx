"use client";

import { useState } from "react";
import Link from "next/link";
import type { SessionUser } from "@/lib/auth";

type EvidenceFile = {
  id: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  classification: string | null;
  classificationConfidence: number | null;
  extractedFields: Record<string, unknown> | null;
  uploadTimestamp: string;
};

type ValidationIssue = {
  id: string;
  ruleId: string;
  category: string;
  severity: string;
  description: string;
  expectedValue: string | null;
  observedValue: string | null;
  resolutionStatus: string;
};

type Assessment = {
  id: string;
  version: number;
  recommendedOutcome: string;
  summary: string;
  rawOutput: Record<string, unknown>;
  createdAt: string;
};

type AuditEvent = {
  id: string;
  action: string;
  reason: string | null;
  timestamp: string;
  actor: { name: string | null; email: string } | null;
};

type Claim = {
  id: string;
  desk365TicketId: string;
  title: string | null;
  description: string | null;
  claimType: string;
  claimant: string | null;
  incidentDate: string | null;
  claimedAmount: string | null;
  currency: string | null;
  desk365Status: string | null;
  processingState: string;
  assessmentOutcome: string | null;
  assessmentVersion: number;
  reviewDecision: string | null;
  reviewer: { name: string | null; email: string } | null;
  reviewTimestamp: string | null;
  createdAt: string;
  updatedAt: string;
  evidenceFiles: EvidenceFile[];
  validationIssues: ValidationIssue[];
  assessments: Assessment[];
  auditEvents: AuditEvent[];
};

const severityColors: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800 border-red-200",
  HIGH: "bg-orange-100 text-orange-800 border-orange-200",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-200",
  LOW: "bg-gray-100 text-gray-700 border-gray-200",
};

const outcomeColors: Record<string, string> = {
  COMPLETE: "bg-green-100 text-green-800",
  INCOMPLETE: "bg-yellow-100 text-yellow-800",
  REVIEW_REQUIRED: "bg-red-100 text-red-800",
};

const stateColors: Record<string, string> = {
  QUEUED: "bg-gray-100 text-gray-700",
  COLLECTING: "bg-yellow-100 text-yellow-800",
  ANALYSING: "bg-blue-100 text-blue-800",
  AWAITING_REVIEW: "bg-orange-100 text-orange-800",
  FAILED: "bg-red-100 text-red-800",
  FINALISED: "bg-green-100 text-green-800",
};

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {label.replace(/_/g, " ")}
    </span>
  );
}

function fileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType === "application/pdf") return "📄";
  return "📎";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ClaimDetailClient({
  claim,
  currentUser,
}: {
  claim: Claim;
  currentUser: SessionUser;
}) {
  const [activeTab, setActiveTab] = useState<"evidence" | "issues" | "assessment" | "history">(
    "evidence"
  );
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewAction, setReviewAction] = useState<"CONFIRM" | "OVERRIDE" | "REQUEST_EVIDENCE">("CONFIRM");
  const [reviewReason, setReviewReason] = useState("");
  const [overrideOutcome, setOverrideOutcome] = useState<"COMPLETE" | "INCOMPLETE" | "REVIEW_REQUIRED">("COMPLETE");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reanalysing, setReanalysing] = useState(false);

  const canReview = ["CLAIMS_STAFF", "CLAIMS_MANAGER", "ADMINISTRATOR"].includes(currentUser.role);
  const canOverride = ["CLAIMS_MANAGER", "ADMINISTRATOR"].includes(currentUser.role);
  const isAwaitingReview = claim.processingState === "AWAITING_REVIEW";

  const latestAssessment = claim.assessments[0];
  const openIssues = claim.validationIssues.filter((i) => i.resolutionStatus === "OPEN");
  const highSeverity = openIssues.filter((i) => ["CRITICAL", "HIGH"].includes(i.severity));

  async function reanalyse() {
    setReanalysing(true);
    try {
      await fetch(`/api/claims/${claim.id}/assess`, { method: "POST" });
      window.location.reload();
    } finally {
      setReanalysing(false);
    }
  }

  async function submitReview() {
    setSubmitting(true);
    try {
      await fetch(`/api/claims/${claim.id}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: reviewAction,
          reason: reviewReason,
          overrideOutcome: reviewAction === "OVERRIDE" ? overrideOutcome : undefined,
        }),
      });
      setSubmitted(true);
      setShowReviewModal(false);
      window.location.reload();
    } finally {
      setSubmitting(false);
    }
  }

  const tabs = [
    { id: "evidence", label: `Evidence (${claim.evidenceFiles.length})` },
    { id: "issues", label: `Issues (${openIssues.length})` },
    { id: "assessment", label: "Assessment" },
    { id: "history", label: "History" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/dashboard" className="hover:text-gray-900">Queue</Link>
            <span>/</span>
            <span>Ticket #{claim.desk365TicketId}</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">
            {claim.title ?? `Ticket #${claim.desk365TicketId}`}
          </h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge label={claim.processingState} colorClass={stateColors[claim.processingState] ?? ""} />
            {claim.assessmentOutcome && (
              <Badge label={claim.assessmentOutcome} colorClass={outcomeColors[claim.assessmentOutcome] ?? ""} />
            )}
            {highSeverity.length > 0 && (
              <span className="text-xs text-red-600 font-medium">
                ⚠ {highSeverity.length} high-severity issue{highSeverity.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <a
            href={`https://kaizer.desk365.io/app/tickets/${claim.desk365TicketId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
          >
            View in Desk365 ↗
          </a>
          {canReview && (
            <button
              onClick={reanalyse}
              disabled={reanalysing}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 disabled:opacity-50"
            >
              {reanalysing ? "Starting…" : ["COLLECTING", "ANALYSING"].includes(claim.processingState) ? "Force Re-run" : "Reanalyse"}
            </button>
          )}
          {claim.assessments.length > 0 && (
            <a
              href={`/api/claims/${claim.id}/generate-form`}
              download
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
            >
              Generate Form ↓
            </a>
          )}
          {isAwaitingReview && canReview && !submitted && (
            <button
              onClick={() => setShowReviewModal(true)}
              className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700"
            >
              Review Assessment
            </button>
          )}
        </div>
      </div>

      {/* Claim summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <div className="text-xs text-gray-500 mb-0.5">Young Person</div>
          <div className="text-sm font-medium text-gray-900">{claim.claimant ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-0.5">Incident Date</div>
          <div className="text-sm font-medium text-gray-900">
            {claim.incidentDate
              ? new Date(claim.incidentDate).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })
              : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-0.5">Claim Type</div>
          <div className="text-sm font-medium text-gray-900">{claim.claimType.replace(/-/g, " ")}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-0.5">Claimed Amount</div>
          <div className="text-sm font-medium text-gray-900">
            {claim.claimedAmount
              ? `${claim.currency ?? "AUD"} ${Number(claim.claimedAmount).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`
              : "—"}
          </div>
        </div>
        {claim.description && (
          <div className="col-span-2 md:col-span-4">
            <div className="text-xs text-gray-500 mb-0.5">Description</div>
            <div className="text-sm text-gray-700 whitespace-pre-wrap">{claim.description}</div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div>
        <div className="flex border-b border-gray-200 gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
                activeTab === t.id
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {/* Evidence tab */}
          {activeTab === "evidence" && (
            <div className="space-y-3">
              {claim.evidenceFiles.length === 0 ? (
                <div className="text-center py-10 text-gray-400 bg-white rounded-lg border border-gray-200">
                  No evidence files collected yet
                </div>
              ) : (
                claim.evidenceFiles.map((f) => (
                  <div key={f.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0">{fileIcon(f.mimeType)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 truncate">{f.originalFilename}</span>
                        <span className="text-xs text-gray-400">{formatBytes(f.fileSize)}</span>
                        {f.classification && (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                            {f.classification}
                            {f.classificationConfidence != null && (
                              <span className="ml-1 opacity-60">
                                {Math.round(f.classificationConfidence * 100)}%
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                      {f.extractedFields && Object.keys(f.extractedFields).length > 0 && (
                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                          {Object.entries(f.extractedFields).map(([k, v]) => (
                            <div key={k} className="text-xs">
                              <span className="text-gray-500">{k}: </span>
                              <span className="text-gray-800">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 flex-shrink-0">
                      {new Date(f.uploadTimestamp).toLocaleDateString("en-AU")}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Issues tab */}
          {activeTab === "issues" && (
            <div className="space-y-3">
              {claim.validationIssues.length === 0 ? (
                <div className="text-center py-10 text-gray-400 bg-white rounded-lg border border-gray-200">
                  No validation issues
                </div>
              ) : (
                claim.validationIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className={`bg-white rounded-lg border p-4 ${severityColors[issue.severity]?.split(" ")[2] ?? "border-gray-200"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityColors[issue.severity] ?? ""}`}>
                          {issue.severity}
                        </span>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                          {issue.category}
                        </span>
                        <span className="text-xs text-gray-400">{issue.ruleId}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        issue.resolutionStatus === "OPEN"
                          ? "bg-red-50 text-red-600"
                          : "bg-green-50 text-green-700"
                      }`}>
                        {issue.resolutionStatus}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-gray-800">{issue.description}</p>
                    {(issue.expectedValue || issue.observedValue) && (
                      <div className="mt-2 flex gap-4 text-xs text-gray-500">
                        {issue.expectedValue && <span>Expected: <strong>{issue.expectedValue}</strong></span>}
                        {issue.observedValue && <span>Found: <strong>{issue.observedValue}</strong></span>}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Assessment tab */}
          {activeTab === "assessment" && (
            <div className="space-y-4">
              {!latestAssessment ? (
                <div className="text-center py-10 text-gray-400 bg-white rounded-lg border border-gray-200">
                  {["QUEUED", "COLLECTING", "ANALYSING"].includes(claim.processingState)
                    ? "AI assessment in progress…"
                    : "No assessment yet"}
                </div>
              ) : (
                <>
                  <div className="bg-white rounded-lg border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-900">AI Recommendation</h3>
                      <div className="flex items-center gap-2">
                        <Badge
                          label={latestAssessment.recommendedOutcome}
                          colorClass={outcomeColors[latestAssessment.recommendedOutcome] ?? ""}
                        />
                        <span className="text-xs text-gray-400">v{latestAssessment.version}</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700">{latestAssessment.summary}</p>
                    {Array.isArray(latestAssessment.rawOutput?.suggested_next_actions) && (
                      <div className="mt-3">
                        <div className="text-xs font-medium text-gray-500 mb-1">Suggested next actions</div>
                        <ul className="list-disc list-inside space-y-0.5">
                          {(latestAssessment.rawOutput.suggested_next_actions as string[]).map((a, i) => (
                            <li key={i} className="text-sm text-gray-700">{String(a)}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  {claim.assessments.length > 1 && (
                    <div className="text-xs text-gray-500">
                      {claim.assessments.length} assessment versions — showing latest
                    </div>
                  )}
                </>
              )}
              {claim.reviewer && (
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="text-xs font-medium text-gray-500 mb-2">Staff Review</div>
                  <div className="flex items-center gap-2">
                    <Badge
                      label={claim.reviewDecision ?? ""}
                      colorClass={claim.reviewDecision === "CONFIRM" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}
                    />
                    <span className="text-sm text-gray-700">by {claim.reviewer.name ?? claim.reviewer.email}</span>
                    {claim.reviewTimestamp && (
                      <span className="text-xs text-gray-400">
                        {new Date(claim.reviewTimestamp).toLocaleDateString("en-AU")}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* History tab */}
          {activeTab === "history" && (
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
              {claim.auditEvents.length === 0 ? (
                <div className="text-center py-10 text-gray-400">No history yet</div>
              ) : (
                claim.auditEvents.map((e) => (
                  <div key={e.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-2 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800">{e.action}</span>
                        {e.actor && (
                          <span className="text-xs text-gray-500">
                            by {e.actor.name ?? e.actor.email}
                          </span>
                        )}
                      </div>
                      {e.reason && <p className="text-sm text-gray-600 mt-0.5">{e.reason}</p>}
                    </div>
                    <div className="text-xs text-gray-400 flex-shrink-0">
                      {new Date(e.timestamp).toLocaleDateString("en-AU", {
                        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Review modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Review Assessment</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Decision</label>
                <div className="space-y-2">
                  {[
                    { value: "CONFIRM", label: "Confirm — accept AI recommendation" },
                    ...(canOverride ? [{ value: "OVERRIDE", label: "Override — change the outcome" }] : []),
                    { value: "REQUEST_EVIDENCE", label: "Request evidence — send back for more info" },
                  ].map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="decision"
                        value={opt.value}
                        checked={reviewAction === opt.value}
                        onChange={() => setReviewAction(opt.value as typeof reviewAction)}
                        className="accent-gray-900"
                      />
                      <span className="text-sm text-gray-700">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {reviewAction === "OVERRIDE" && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">New outcome</label>
                  <select
                    value={overrideOutcome}
                    onChange={(e) => setOverrideOutcome(e.target.value as typeof overrideOutcome)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="COMPLETE">Complete</option>
                    <option value="INCOMPLETE">Incomplete</option>
                    <option value="REVIEW_REQUIRED">Review Required</option>
                  </select>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Reason <span className="text-gray-400 font-normal">(required)</span>
                </label>
                <textarea
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  rows={3}
                  placeholder="Add your notes…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowReviewModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={submitReview}
                disabled={submitting || !reviewReason.trim()}
                className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg disabled:opacity-50 hover:bg-gray-700"
              >
                {submitting ? "Saving…" : "Submit Review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
