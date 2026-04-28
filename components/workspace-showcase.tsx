"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";

import type {
  AuthorityStatus,
  CitationRecord,
  ReviewDocument,
  ReviewExportArtifact,
  ReviewSession,
  SupportVerdict,
} from "../lib/legal-review/contracts";

type StatusFilter = Exclude<AuthorityStatus, "pending"> | "all";

const fullProductName = "LegalCheck";
const reviewStages = ["verify", "support", "export"] as const;
const statusFilters: StatusFilter[] = ["all", "verified", "warning", "not_found"];

function countByStatus(document: ReviewDocument, status: AuthorityStatus) {
  return document.citations.filter((citation) => citation.status === status).length;
}

function statusLabel(status: AuthorityStatus) {
  return {
    pending: "Pending",
    verified: "Verified",
    warning: "Warning",
    not_found: "Not Found",
  }[status];
}

function supportLabel(verdict: SupportVerdict) {
  return {
    not_reviewed: "Not Reviewed",
    supported: "Supported",
    partial: "Partial",
    unsupported: "Unsupported",
  }[verdict];
}

function statusClassName(status: AuthorityStatus) {
  return {
    pending: "status-pending",
    verified: "status-verified",
    warning: "status-warning",
    not_found: "status-not-found",
  }[status];
}

function verdictClassName(verdict: SupportVerdict) {
  return {
    not_reviewed: "verdict-not-reviewed",
    supported: "verdict-supported",
    partial: "verdict-partial",
    unsupported: "verdict-unsupported",
  }[verdict];
}

function stageHeadline(stage: (typeof reviewStages)[number]) {
  return {
    verify: "Authority verification",
    support: "Proposition support",
    export: "Export preparation",
  }[stage];
}

async function parseJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & {
    error?: {
      message?: string;
    };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? "The legal review request failed.");
  }

  return payload;
}

export function WorkspaceShowcase() {
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [activeStage, setActiveStage] = useState<(typeof reviewStages)[number]>("verify");
  const [activeDocumentId, setActiveDocumentId] = useState<string>("");
  const [selectedCitationId, setSelectedCitationId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [latestArtifact, setLatestArtifact] = useState<ReviewExportArtifact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    void loadDemoSession();
  }, []);

  async function loadDemoSession() {
    setPendingAction("Loading live session");
    setError(null);

    try {
      const payload = await parseJson<{ session: ReviewSession }>(
        await fetch("/api/review-sessions/demo", {
          method: "GET",
          cache: "no-store",
        }),
      );

      setSession(payload.session);
      setActiveDocumentId((current) => current || payload.session.documents[0]?.id || "");
      setSelectedCitationId((current) => current || payload.session.documents[0]?.citations[0]?.id || "");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The demo session could not be loaded.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function runPipelineAction(action: "verify" | "support") {
    if (!session) {
      return;
    }

    setPendingAction(
      action === "verify" ? "Re-running authority verification" : "Running support review",
    );
    setError(null);

    try {
      const payload = await parseJson<{ session: ReviewSession }>(
        await fetch(`/api/review-sessions/${session.id}/${action}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }),
      );

      setSession(payload.session);
      setLatestArtifact(null);
      if (action === "support") {
        setActiveStage("support");
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The legal review action did not complete.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function generateExport() {
    if (!session) {
      return;
    }

    setPendingAction("Generating HTML review packet");
    setError(null);

    try {
      const payload = await parseJson<{
        session: ReviewSession;
        artifact: ReviewExportArtifact;
      }>(
        await fetch(`/api/review-sessions/${session.id}/export`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ format: "html" }),
        }),
      );

      setSession(payload.session);
      setLatestArtifact(payload.artifact);
      setActiveStage("export");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The export packet could not be generated.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  const activeDocument = useMemo(
    () =>
      session?.documents.find((document) => document.id === activeDocumentId) ??
      session?.documents[0] ??
      null,
    [activeDocumentId, session],
  );

  useEffect(() => {
    if (!activeDocument) {
      return;
    }

    if (
      !selectedCitationId ||
      !activeDocument.citations.some((citation) => citation.id === selectedCitationId)
    ) {
      setSelectedCitationId(activeDocument.citations[0]?.id ?? "");
    }
  }, [activeDocument, selectedCitationId]);

  const filteredCitations = useMemo(() => {
    if (!activeDocument) {
      return [];
    }

    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return activeDocument.citations.filter((citation) => {
      const matchesStatus = statusFilter === "all" ? true : citation.status === statusFilter;
      const matchesQuery =
        normalizedQuery.length === 0
          ? true
          : `${citation.reference} ${citation.title} ${citation.issue} ${citation.supportSummary}`
              .toLowerCase()
              .includes(normalizedQuery);

      return matchesStatus && matchesQuery;
    });
  }, [activeDocument, deferredQuery, statusFilter]);

  const selectedCitation =
    filteredCitations.find((citation) => citation.id === selectedCitationId) ??
    activeDocument?.citations.find((citation) => citation.id === selectedCitationId) ??
    filteredCitations[0] ??
    activeDocument?.citations[0] ??
    null;

  const stageSummary =
    session && activeDocument
      ? {
          verify: `${session.metrics.verifiedCount} verified, ${session.metrics.warningCount} warnings, ${session.metrics.notFoundCount} blockers across ${session.metrics.totalCitations} citations.`,
          support: `${session.metrics.supportedCount} supported claims, ${session.metrics.partialCount} partials, ${session.metrics.unsupportedCount} unsupported findings.`,
          export: latestArtifact
            ? `${latestArtifact.fileName} is ready. ${latestArtifact.summary}`
            : `${session.metrics.readinessScore}% filing-readiness score based on authority quality and support alignment.`,
        }[activeStage]
      : "";

  if (!session) {
    return (
      <div className="workspace-shell">
        <div className="workspace-loading">
          <p className="section-kicker">{fullProductName}</p>
          <h3>Loading the live review session.</h3>
          <p className="workspace-intro">
            Authority checks, support review, and packet composition are coming online.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-shell">
      <div className="workspace-toolbar">
        <div>
          <p className="section-kicker">{fullProductName}</p>
          <h3>{session.productName}</h3>
          <p className="workspace-intro">
            A live citation-risk console for lawyers: authority verification, proposition review,
            and packet delivery in one focused control surface.
          </p>
          <p className="workspace-system-note">{session.summary}</p>
        </div>

        <div className="stage-switcher" role="tablist" aria-label="Review stages">
          {reviewStages.map((stage) => (
            <button
              key={stage}
              className={`stage-chip ${activeStage === stage ? "is-active" : ""}`}
              onClick={() =>
                startTransition(() => {
                  setActiveStage(stage);
                })
              }
              type="button"
            >
              <span className="stage-chip-index">
                {String(reviewStages.indexOf(stage) + 1).padStart(2, "0")}
              </span>
              <span>{stageHeadline(stage)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="workspace-actions">
        <div className="workspace-action-cluster">
          <button
            className="toolbar-button"
            disabled={Boolean(pendingAction)}
            onClick={() => void loadDemoSession()}
            type="button"
          >
            Reload session
          </button>
          <button
            className="toolbar-button"
            disabled={Boolean(pendingAction)}
            onClick={() => void runPipelineAction("verify")}
            type="button"
          >
            Refresh authority
          </button>
          <button
            className="toolbar-button"
            disabled={Boolean(pendingAction)}
            onClick={() => void runPipelineAction("support")}
            type="button"
          >
            Run support pass
          </button>
          <button
            className="toolbar-button toolbar-button-primary"
            disabled={Boolean(pendingAction)}
            onClick={() => void generateExport()}
            type="button"
          >
            Build HTML packet
          </button>
        </div>

        <div className="toolbar-status">
          <span className="workspace-matter-dot" />
          {pendingAction ?? `Phase: ${session.phase.replaceAll("_", " ")}`}
        </div>
      </div>

      {error ? <div className="workspace-error">{error}</div> : null}

      <div className="workspace-summary-bar">
        <div>
          <span className="workspace-summary-label">{stageHeadline(activeStage)}</span>
          <p>{stageSummary}</p>
        </div>
        <div className="workspace-side-note">
          <div className="workspace-matter-pill">
            <span className="workspace-matter-dot" />
            {session.matterName}
          </div>
          <div className="workspace-score-pill">Readiness {session.metrics.readinessScore}%</div>
        </div>
      </div>

      <div className="workspace-grid">
        <aside className="workspace-sidebar">
          <div className="sidebar-card">
            <p className="eyebrow">Queued Documents</p>
            <div className="document-list">
              {session.documents.map((document) => (
                <button
                  key={document.id}
                  type="button"
                  className={`document-card ${document.id === activeDocument?.id ? "is-active" : ""}`}
                  onClick={() =>
                    startTransition(() => {
                      setActiveDocumentId(document.id);
                      setSelectedCitationId(document.citations[0]?.id ?? "");
                      setStatusFilter("all");
                    })
                  }
                >
                  <div className="document-card-top">
                    <span className="document-format">{document.format}</span>
                    <span className="document-meta">{document.lastCheckedLabel}</span>
                  </div>
                  <strong>{document.name}</strong>
                  <p>{document.summary}</p>
                  <div className="document-stats">
                    <span>{document.citations.length} cites</span>
                    <span>{countByStatus(document, "verified")} verified</span>
                    <span>{countByStatus(document, "warning")} warnings</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-card sidebar-card-muted">
            <p className="eyebrow">Platform Signals</p>
            <div className="capability-stack">
              {session.capabilities.map((capability) => (
                <div className="capability-chip" key={capability.id}>
                  <strong>{capability.label}</strong>
                  <p>{capability.description}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section className="workspace-results">
          <div className="results-head">
            <div>
              <p className="eyebrow">Citation Queue</p>
              <h4>{activeDocument?.name ?? "No active document"}</h4>
              <p>{activeDocument?.summary ?? "Select a document to review its citations."}</p>
            </div>
            <div className="results-controls">
              <input
                aria-label="Search citations"
                className="search-field"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search citation, issue, or support note"
                value={query}
              />
              <div className="filter-row">
                {statusFilters.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    className={`filter-pill ${statusFilter === filter ? "is-active" : ""}`}
                    onClick={() =>
                      startTransition(() => {
                        setStatusFilter(filter);
                      })
                    }
                  >
                    {filter === "all" ? "All" : statusLabel(filter)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="citation-list">
            {filteredCitations.map((citation) => (
              <button
                key={citation.id}
                className={`citation-row ${selectedCitation?.id === citation.id ? "is-selected" : ""}`}
                onClick={() => setSelectedCitationId(citation.id)}
                type="button"
              >
                <div className="citation-row-top">
                  <span className={`status-badge ${statusClassName(citation.status)}`}>
                    {statusLabel(citation.status)}
                  </span>
                  <span className="citation-kind">{citation.kind}</span>
                </div>
                <strong>{citation.reference}</strong>
                <p>{citation.title}</p>
                <div className="citation-row-footer">
                  <span>{citation.source}</span>
                  <span>{citation.confidence}% confidence</span>
                </div>
              </button>
            ))}

            {filteredCitations.length === 0 ? (
              <div className="empty-state">
                No citations match this filter. Clear the search or switch status lanes.
              </div>
            ) : null}
          </div>
        </section>

        <aside
          className="workspace-inspector"
          key={`${activeStage}-${selectedCitation?.id ?? "empty"}`}
        >
          {selectedCitation ? (
            <>
              <div className="inspector-header">
                <p className="eyebrow">Selected Citation</p>
                <h4>{selectedCitation.reference}</h4>
                <p>{selectedCitation.title}</p>
              </div>

              <div className="inspector-card">
                <div className="inspector-card-head">
                  <span className="inspector-card-title">{stageHeadline(activeStage)}</span>
                  {activeStage === "verify" ? (
                    <span className={`status-badge ${statusClassName(selectedCitation.status)}`}>
                      {statusLabel(selectedCitation.status)}
                    </span>
                  ) : (
                    <span
                      className={`status-badge verdict-badge ${verdictClassName(
                        selectedCitation.supportVerdict,
                      )}`}
                    >
                      {supportLabel(selectedCitation.supportVerdict)}
                    </span>
                  )}
                </div>

                {activeStage === "verify" ? (
                  <>
                    <p className="inspector-copy">{selectedCitation.issue}</p>
                    <div className="confidence-meter">
                      <div
                        className={`confidence-meter-fill ${statusClassName(selectedCitation.status)}`}
                        style={{ width: `${selectedCitation.confidence}%` }}
                      />
                    </div>
                    <ul className="trail-list">
                      {selectedCitation.evidenceTrail.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ul>
                    {selectedCitation.sourceLinks.length ? (
                      <div className="source-link-list">
                        {selectedCitation.sourceLinks.map((link) => (
                          <a
                            className="source-link"
                            href={link.href}
                            key={`${selectedCitation.id}-${link.href}`}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {link.label}
                          </a>
                        ))}
                      </div>
                    ) : null}
                    {selectedCitation.manualNextStep ? (
                      <div className="callout callout-warning">
                        <strong>Manual next step</strong>
                        <p>{selectedCitation.manualNextStep}</p>
                      </div>
                    ) : null}
                  </>
                ) : null}

                {activeStage === "support" ? (
                  <>
                    <div className="detail-block">
                      <span>Memo claim</span>
                      <p>{selectedCitation.memoClaim}</p>
                    </div>
                    <div className="detail-block">
                      <span>Opinion text</span>
                      <p>{selectedCitation.opinionExcerpt}</p>
                    </div>
                    <div className="detail-block">
                      <span>Actual holding</span>
                      <p>{selectedCitation.holding}</p>
                    </div>
                    <div className="callout">
                      <strong>Review note</strong>
                      <p>{selectedCitation.supportSummary}</p>
                    </div>
                  </>
                ) : null}

                {activeStage === "export" ? (
                  <>
                    <div className="detail-block">
                      <span>Export surfaces</span>
                      <ul className="artifact-list">
                        {selectedCitation.exportArtifacts.map((artifact) => (
                          <li key={artifact}>{artifact}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="detail-block">
                      <span>Delivery note</span>
                      <p>{selectedCitation.exportNote}</p>
                    </div>
                    {latestArtifact ? (
                      <div className="artifact-preview">
                        <strong>{latestArtifact.fileName}</strong>
                        <p>{latestArtifact.summary}</p>
                        <pre>{latestArtifact.content.slice(0, 420)}...</pre>
                      </div>
                    ) : (
                      <div className="callout callout-muted">
                        <strong>Export packet</strong>
                        <p>Generate an HTML packet to preview the live deliverable.</p>
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </>
          ) : (
            <div className="empty-state">Select a citation to inspect the review details.</div>
          )}
        </aside>
      </div>
    </div>
  );
}
