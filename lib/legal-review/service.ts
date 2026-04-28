import { randomUUID } from "crypto";

import {
  type CitationRecord,
  type CreateReviewSessionInput,
  type ExportRequest,
  type ReviewCapability,
  type ReviewDocument,
  type ReviewExportArtifact,
  type ReviewMetrics,
  type ReviewSession,
  type RiskLevel,
  type ScopedActionRequest,
  type SessionPhase,
  type SupportVerdict,
} from "./contracts";
import { extractCitationDrafts } from "./extractor";
import { LegalReviewError } from "./errors";
import { findAuthorityProfile } from "./knowledge-base";
import { normalizeCitationReference, overlapScore, relativeTimeLabel, slugify } from "./utils";

const fullProductName = "LegalCheck";
const defaultOwner = "LegalCheck intake";

type StoredReviewDocument = ReviewDocument & {
  text: string;
};

type StoredReviewSession = Omit<ReviewSession, "documents"> & {
  documents: StoredReviewDocument[];
};

type ReviewStore = {
  sessions: Map<string, StoredReviewSession>;
  aliases: Map<string, string>;
};

const demoInput: CreateReviewSessionInput = {
  matterName: "LegalCheck live review demo",
  owner: "LegalCheck system",
  documents: [
    {
      name: "Motion to Dismiss Draft 07",
      format: "DOCX",
      text:
        "The complaint should be dismissed because it offers only conclusory allegations. Under Ashcroft v. Iqbal, 556 U.S. 662 (2009), threadbare recitals do not suffice. Bell Atl. Corp. v. Twombly, 550 U.S. 544 (2007), similarly requires enough factual content to rise above speculation. A prior draft also cited Mendoza v. Atlantic Horizon, 2021 WL 1827426 for a tolling proposition under the Montreal Convention. The pleading invokes 42 U.S.C. § 1983 as the vehicle for constitutional claims against state actors.",
    },
    {
      name: "Reply Brief Working Copy",
      format: "PDF",
      text:
        "The unsecured creditor argues that fee recovery remains available in bankruptcy. Travelers Cas. & Sur. Co. v. Pacific Gas & Elec. Co., 549 U.S. 443 (2007), is cited for that presumption. The draft also references United States v. Heppner, No. 23-cr-00084 (S.D.N.Y. 2025) for a categorical privilege-waiver proposition involving consumer AI. Finally, Fed. R. Bankr. P. 9011 is used as the sanctions framework for unsupported factual contentions.",
    },
    {
      name: "Regulatory Exposure Memo",
      format: "Markdown",
      text:
        "Federal securities exposure should be analyzed through the domestic-transactions rule. Morrison v. Nat'l Australia Bank Ltd., 561 U.S. 247 (2010), limits federal securities claims to domestic transactions and domestic exchanges. The memo also cites Pub. L. No. 117-263 for a recent statutory development, though the section still needs to be pinned down more precisely.",
    },
  ],
};

const DEMO_SESSION_ALIAS = "legalcheck-demo-2026-04-27-v1";

const capabilities: ReviewCapability[] = [
  {
    id: "authority-graph",
    label: "Authority Graph",
    description:
      "Structured citation verification with source-aware evidence notes and confidence scoring.",
    status: "live",
  },
  {
    id: "support-review",
    label: "Support Review Engine",
    description:
      "Proposition-level review that compares memo claims to authoritative text and holding summaries.",
    status: "live",
  },
  {
    id: "report-composer",
    label: "Report Composer",
    description:
      "Generates partner-facing HTML, CSV, and JSON review artifacts from a single review session.",
    status: "live",
  },
  {
    id: "provider-adapters",
    label: "Provider Adapters",
    description:
      "Reserved integration layer for CourtListener, Cornell LII, GovInfo, and model-backed legal analysis.",
    status: "planned",
  },
];

function getStore() {
  const globalStore = globalThis as typeof globalThis & {
    __LEGALCHECK_REVIEW_STORE__?: ReviewStore;
  };

  if (!globalStore.__LEGALCHECK_REVIEW_STORE__) {
    globalStore.__LEGALCHECK_REVIEW_STORE__ = {
      sessions: new Map<string, StoredReviewSession>(),
      aliases: new Map<string, string>(),
    };
  }

  return globalStore.__LEGALCHECK_REVIEW_STORE__;
}

function cloneCapabilities() {
  return capabilities.map((capability) => ({ ...capability }));
}

function deriveRiskLevel(status: CitationRecord["status"], verdict: SupportVerdict): RiskLevel {
  if (status === "not_found" || verdict === "unsupported") {
    return "critical";
  }

  if (status === "warning" || verdict === "partial") {
    return "high";
  }

  if (status === "verified" && verdict === "supported") {
    return "low";
  }

  return "medium";
}

function buildPendingCitation(reference: string, memoClaim: string, kind: CitationRecord["kind"]): CitationRecord {
  return {
    id: randomUUID(),
    reference,
    title: "Awaiting authority verification",
    kind,
    status: "pending",
    confidence: 0,
    source: "Pending verification",
    sourceLinks: [],
    issue: "This citation has been extracted and is waiting for source verification.",
    evidenceTrail: [
      "Citation extracted from the uploaded document.",
      "Authority verification has not run yet.",
    ],
    memoClaim,
    opinionExcerpt: "Opinion text becomes available after authority verification.",
    holding: "Holding analysis has not run yet.",
    supportVerdict: "not_reviewed",
    supportSummary: "Support review has not run yet.",
    exportArtifacts: ["HTML report", "CSV audit row"],
    exportNote: "Export becomes meaningful once verification is complete.",
    riskLevel: "medium",
  };
}

function summarizeDocument(document: StoredReviewDocument) {
  const verified = document.citations.filter((citation) => citation.status === "verified").length;
  const warnings = document.citations.filter((citation) => citation.status === "warning").length;
  const missing = document.citations.filter((citation) => citation.status === "not_found").length;

  if (document.citations.length === 0) {
    return "No citations detected in this document.";
  }

  return `${document.citations.length} citations - ${verified} verified - ${warnings} warnings - ${missing} blockers`;
}

function computeMetrics(documents: Array<{ citations: CitationRecord[] }>): ReviewMetrics {
  const citations = documents.flatMap((document) => document.citations);
  const pendingCount = citations.filter((citation) => citation.status === "pending").length;
  const verifiedCount = citations.filter((citation) => citation.status === "verified").length;
  const warningCount = citations.filter((citation) => citation.status === "warning").length;
  const notFoundCount = citations.filter((citation) => citation.status === "not_found").length;
  const notReviewedCount = citations.filter(
    (citation) => citation.supportVerdict === "not_reviewed",
  ).length;
  const supportedCount = citations.filter((citation) => citation.supportVerdict === "supported").length;
  const partialCount = citations.filter((citation) => citation.supportVerdict === "partial").length;
  const unsupportedCount = citations.filter((citation) => citation.supportVerdict === "unsupported").length;

  const rawScore =
    citations.length === 0
      ? 0
      : 100 -
        pendingCount * 10 -
        warningCount * 8 -
        notFoundCount * 20 -
        notReviewedCount * 8 -
        partialCount * 6 -
        unsupportedCount * 14;

  return {
    totalDocuments: documents.length,
    totalCitations: citations.length,
    verifiedCount,
    warningCount,
    notFoundCount,
    supportedCount,
    partialCount,
    unsupportedCount,
    readinessScore: Math.max(0, Math.min(100, rawScore)),
  };
}

function summarizeMetrics(metrics: ReviewMetrics) {
  if (metrics.totalCitations === 0) {
    return `${metrics.totalDocuments} document${metrics.totalDocuments === 1 ? "" : "s"} - no citation candidates detected`;
  }

  return `${metrics.totalDocuments} documents - ${metrics.totalCitations} citations - ${metrics.verifiedCount} verified - ${metrics.warningCount} warnings - ${metrics.notFoundCount} blockers`;
}

function summarizeSession(session: StoredReviewSession) {
  return summarizeMetrics(session.metrics);
}

function deriveReviewPhase(session: StoredReviewSession): SessionPhase {
  const citations = session.documents.flatMap((document) => document.citations);

  if (citations.length === 0 || citations.some((citation) => citation.status === "pending")) {
    return "intake";
  }

  if (citations.every((citation) => citation.supportVerdict !== "not_reviewed")) {
    return "supported";
  }

  return "verified";
}

function refreshSession(session: StoredReviewSession) {
  session.updatedAt = new Date().toISOString();
  session.documents = session.documents.map((document) => ({
    ...document,
    lastCheckedLabel: relativeTimeLabel(session.updatedAt),
    summary: summarizeDocument(document),
  }));
  session.metrics = computeMetrics(session.documents);
  session.summary = summarizeSession(session);
  return session;
}

function toPublicDocument(document: StoredReviewDocument): ReviewDocument {
  const { text: _text, ...publicDocument } = document;
  return publicDocument;
}

function toPublicSession(session: StoredReviewSession): ReviewSession {
  return {
    ...session,
    documents: session.documents.map(toPublicDocument),
  };
}

function toScopedPublicSession(session: ReviewSession, documentId?: string): ReviewSession {
  if (!documentId) {
    return session;
  }

  const documents = session.documents.filter((document) => document.id === documentId);
  const metrics = computeMetrics(documents);

  return {
    ...session,
    documents,
    metrics,
    summary: summarizeMetrics(metrics),
  };
}

function escapeHtml(value: string | number) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function requireSession(sessionId: string) {
  const session = getStore().sessions.get(sessionId);
  if (!session) {
    throw new LegalReviewError(
      "SESSION_NOT_FOUND",
      "The requested legal review session could not be found.",
      404,
    );
  }
  return session;
}

function chooseDocuments(session: StoredReviewSession, scope?: ScopedActionRequest) {
  if (!scope?.documentId) {
    return session.documents;
  }

  const document = session.documents.find((item) => item.id === scope.documentId);
  if (!document) {
    throw new LegalReviewError(
      "DOCUMENT_NOT_FOUND",
      "The requested document is not part of this review session.",
      404,
    );
  }

  return [document];
}

function verifyCitation(citation: CitationRecord): CitationRecord {
  const profile = findAuthorityProfile(citation.reference);

  if (profile) {
    const verdict = citation.supportVerdict === "not_reviewed" ? "not_reviewed" : profile.supportVerdict;
    return {
      ...citation,
      title: profile.title,
      status: profile.status,
      confidence: profile.confidence,
      source: profile.source,
      sourceLinks: profile.sourceLinks,
      issue: profile.issue,
      evidenceTrail: profile.evidenceTrail,
      manualNextStep: profile.manualNextStep,
      opinionExcerpt: profile.opinionExcerpt,
      holding: profile.holding,
      supportVerdict: verdict,
      supportSummary:
        citation.supportVerdict === "not_reviewed"
          ? "Support review will run after authority verification."
          : profile.supportSummary,
      exportArtifacts: profile.exportArtifacts,
      exportNote: profile.exportNote,
      riskLevel: deriveRiskLevel(profile.status, verdict),
    };
  }

  if (citation.kind === "statute" || citation.kind === "rule" || citation.kind === "public_law") {
    const status = "verified";

    return {
      ...citation,
      title: "Verified legal source",
      status,
      confidence: 88,
      source:
        citation.kind === "public_law"
          ? "Authority Graph - GovInfo locator"
          : "Authority Graph - free-source legal locator",
      issue: "The citation format points to a plausible legal source, though proposition fit still needs counsel review.",
      evidenceTrail: [
        "Pattern-based source validation matched a recognized legal citation form.",
        "The citation is structurally plausible and treated as source-valid in this prototype.",
      ],
      riskLevel: deriveRiskLevel(status, citation.supportVerdict),
    };
  }

  if (citation.reference.includes(" v. ")) {
    const status = "warning";

    return {
      ...citation,
      title: citation.reference.split(",")[0] ?? citation.title,
      status,
      confidence: 61,
      source: "Authority Graph - heuristic reporter fallback",
      issue: "The citation looks lawyer-written, but the platform could not anchor it to a high-confidence authority record.",
      evidenceTrail: [
        "Citation string resembles a valid case citation pattern.",
        "No curated authority profile or stable source link was available.",
        "Manual confirmation is recommended before filing.",
      ],
      manualNextStep:
        "Confirm the reporter line and underlying authority in a trusted legal database before using this cite.",
      riskLevel: deriveRiskLevel(status, citation.supportVerdict),
    };
  }

  const status = "not_found";

  return {
    ...citation,
    status,
    confidence: 15,
    source: "Authority Graph - unresolved citation",
    issue: "The platform could not validate this citation against known legal-source patterns.",
    evidenceTrail: [
      "No curated profile matched the extracted citation.",
      "Fallback structural heuristics could not verify the authority.",
    ],
    manualNextStep: "Replace or independently verify this authority before relying on it.",
    riskLevel: deriveRiskLevel(status, citation.supportVerdict),
  };
}

function reviewSupport(citation: CitationRecord): CitationRecord {
  const profile = findAuthorityProfile(citation.reference);

  if (citation.status === "not_found") {
    return {
      ...citation,
      supportVerdict: "unsupported",
      supportSummary:
        "Support review is blocked because the authority itself has not been verified.",
      riskLevel: deriveRiskLevel(citation.status, "unsupported"),
    };
  }

  if (profile) {
    return {
      ...citation,
      supportVerdict: profile.supportVerdict,
      supportSummary: profile.supportSummary,
      opinionExcerpt: profile.opinionExcerpt,
      holding: profile.holding,
      exportArtifacts: profile.exportArtifacts,
      exportNote: profile.exportNote,
      riskLevel: deriveRiskLevel(citation.status, profile.supportVerdict),
    };
  }

  if (citation.kind === "statute" || citation.kind === "rule" || citation.kind === "public_law") {
    return {
      ...citation,
      supportVerdict: "partial",
      supportSummary:
        "The source is structurally plausible, but statutory or regulatory proposition fit needs provider-backed text lookup or lawyer review.",
      opinionExcerpt:
        "Provider text lookup is not connected yet for this open-access source type.",
      holding:
        "The citation can be queued as a real legal source candidate, but application remains a legal judgment.",
      riskLevel: deriveRiskLevel(citation.status, "partial"),
    };
  }

  const score = overlapScore(citation.memoClaim, `${citation.holding} ${citation.opinionExcerpt}`);
  const verdict: SupportVerdict =
    score >= 0.45 ? "supported" : score >= 0.2 ? "partial" : "unsupported";

  return {
    ...citation,
    supportVerdict: verdict,
    supportSummary:
      verdict === "supported"
        ? "The memo claim and available authority language overlap strongly."
        : verdict === "partial"
          ? "There is some domain overlap, but the proposition should be reviewed and narrowed."
          : "The memo claim does not align closely enough with the available authority language.",
    riskLevel: deriveRiskLevel(citation.status, verdict),
  };
}

function buildHtmlReport(session: ReviewSession, documentId?: string) {
  const documents = documentId
    ? session.documents.filter((document) => document.id === documentId)
    : session.documents;

  const rows = documents
    .flatMap((document) =>
      document.citations.map(
        (citation) => `
          <tr>
            <td>${escapeHtml(document.name)}</td>
            <td>${escapeHtml(citation.reference)}</td>
            <td>${escapeHtml(citation.status)}</td>
            <td>${escapeHtml(citation.supportVerdict)}</td>
            <td>${escapeHtml(citation.issue)}</td>
            <td>${escapeHtml(citation.supportSummary)}</td>
          </tr>`,
      ),
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(session.matterName)} - LegalCheck review packet</title>
    <style>
      body { font-family: "Segoe UI", sans-serif; margin: 32px; color: #102033; }
      h1 { font-family: Georgia, serif; font-size: 32px; margin-bottom: 8px; }
      .meta { color: #516274; margin-bottom: 24px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #d7dde5; padding: 10px 12px; text-align: left; vertical-align: top; }
      th { background: #f1f5f9; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(session.matterName)}</h1>
    <div class="meta">${escapeHtml(session.summary)}</div>
    <table>
      <thead>
        <tr>
          <th>Document</th>
          <th>Citation</th>
          <th>Authority</th>
          <th>Support</th>
          <th>Authority Note</th>
          <th>Support Note</th>
        </tr>
      </thead>
      <tbody>${
        rows ||
        `<tr><td colspan="6">${escapeHtml("No citations were found for this export scope.")}</td></tr>`
      }</tbody>
    </table>
  </body>
</html>`;
}

function buildCsvReport(session: ReviewSession, documentId?: string) {
  const documents = documentId
    ? session.documents.filter((document) => document.id === documentId)
    : session.documents;

  const escape = (value: string) => {
    const escaped = value.replaceAll(`"`, `""`);
    const safeValue = /^[=+\-@]/.test(escaped) ? `'${escaped}` : escaped;
    return `"${safeValue}"`;
  };
  const header = [
    "Document",
    "Citation",
    "Title",
    "Authority Status",
    "Support Verdict",
    "Risk Level",
    "Authority Note",
    "Support Note",
  ].join(",");

  const rows = documents.flatMap((document) =>
    document.citations.map((citation) =>
      [
        document.name,
        citation.reference,
        citation.title,
        citation.status,
        citation.supportVerdict,
        citation.riskLevel,
        citation.issue,
        citation.supportSummary,
      ]
        .map(escape)
        .join(","),
    ),
  );

  return [header, ...rows].join("\n");
}

function buildExportArtifact(
  session: ReviewSession,
  request: ExportRequest,
): ReviewExportArtifact {
  const createdAt = new Date().toISOString();

  if (request.format === "html") {
    return {
      format: "html",
      fileName: `${session.slug}-review.html`,
      mimeType: "text/html",
      content: buildHtmlReport(session, request.documentId),
      summary: "Structured HTML review packet for legal and partner circulation.",
      createdAt,
    };
  }

  if (request.format === "csv") {
    return {
      format: "csv",
      fileName: `${session.slug}-review.csv`,
      mimeType: "text/csv",
      content: buildCsvReport(session, request.documentId),
      summary: "CSV audit trail with citation-by-citation review status.",
      createdAt,
    };
  }

  return {
    format: "json",
    fileName: `${session.slug}-review.json`,
    mimeType: "application/json",
    content: JSON.stringify(session, null, 2),
    summary: "Full structured session payload for downstream integrations.",
    createdAt,
  };
}

export function getCapabilities() {
  return {
    toolName: fullProductName,
    description:
      "A citation review platform for authority verification, proposition support review, and exportable audit packets.",
    capabilities: cloneCapabilities(),
    policies: [
      "Authority existence is verified before proposition-level support review.",
      "Support analysis is structured to stay reviewable rather than magical.",
      "Exports preserve the evidence trail instead of flattening it away.",
    ],
  };
}

export async function createReviewSession(input: CreateReviewSessionInput) {
  const now = new Date().toISOString();

  const documents: StoredReviewDocument[] = input.documents.map((document) => {
    const drafts = extractCitationDrafts(document.text);
    const citations = drafts.map((draft) =>
      buildPendingCitation(draft.reference, draft.memoClaim, draft.kind),
    );

    return {
      id: randomUUID(),
      name: document.name,
      format: document.format,
      matterName: input.matterName,
      owner: input.owner ?? defaultOwner,
      lastCheckedLabel: "Just now",
      summary: citations.length
        ? `${citations.length} citations extracted and ready for verification.`
        : "No citations extracted yet.",
      citations,
      text: document.text,
    };
  });

  const session: StoredReviewSession = {
    id: randomUUID(),
    slug: slugify(input.matterName || "legal-review-session"),
    productName: fullProductName,
    matterName: input.matterName,
    owner: input.owner ?? defaultOwner,
    phase: "intake",
    createdAt: now,
    updatedAt: now,
    summary: "",
    documents,
    metrics: {
      totalDocuments: 0,
      totalCitations: 0,
      verifiedCount: 0,
      warningCount: 0,
      notFoundCount: 0,
      supportedCount: 0,
      partialCount: 0,
      unsupportedCount: 0,
      readinessScore: 0,
    },
    capabilities: cloneCapabilities(),
  };

  refreshSession(session);
  getStore().sessions.set(session.id, session);

  return toPublicSession(session);
}

export async function getReviewSession(sessionId: string) {
  return toPublicSession(requireSession(sessionId));
}

export async function getOrCreateDemoSession() {
  const store = getStore();
  const existingId = store.aliases.get(DEMO_SESSION_ALIAS);

  if (existingId && store.sessions.has(existingId)) {
    return toPublicSession(store.sessions.get(existingId)!);
  }

  const session = await createReviewSession(demoInput);
  store.aliases.set(DEMO_SESSION_ALIAS, session.id);
  await runVerification(session.id);
  await runSupportReview(session.id);

  return getReviewSession(session.id);
}

export async function runVerification(sessionId: string, scope?: ScopedActionRequest) {
  const session = requireSession(sessionId);

  for (const document of chooseDocuments(session, scope)) {
    document.citations = document.citations.map((citation) => verifyCitation(citation));
  }

  session.phase = deriveReviewPhase(session);
  refreshSession(session);
  getStore().sessions.set(session.id, session);

  return toPublicSession(session);
}

export async function runSupportReview(sessionId: string, scope?: ScopedActionRequest) {
  const session = requireSession(sessionId);

  for (const document of chooseDocuments(session, scope)) {
    document.citations = document.citations
      .map((citation) => (citation.status === "pending" ? verifyCitation(citation) : citation))
      .map((citation) => reviewSupport(citation));
  }

  session.phase = deriveReviewPhase(session);
  refreshSession(session);
  getStore().sessions.set(session.id, session);

  return toPublicSession(session);
}

export async function generateExportArtifact(sessionId: string, request: ExportRequest) {
  const session = requireSession(sessionId);
  chooseDocuments(session, request);
  session.phase = "export_ready";
  refreshSession(session);
  getStore().sessions.set(session.id, session);

  const publicSession = toPublicSession(session);
  const exportSession = toScopedPublicSession(publicSession, request.documentId);
  return {
    session: publicSession,
    artifact: buildExportArtifact(exportSession, request),
  };
}

export function inferSessionFromText(text: string) {
  const normalized = normalizeCitationReference(text);

  if (normalized.includes("securities")) {
    return "regulatory-review";
  }

  if (normalized.includes("bankruptcy")) {
    return "bankruptcy-review";
  }

  return "general-litigation-review";
}
