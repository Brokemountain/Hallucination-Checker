export type ReviewDocumentFormat = "DOCX" | "PDF" | "Markdown" | "Text" | "HTML";
export type CitationKind = "case" | "statute" | "rule" | "public_law" | "unknown";
export type AuthorityStatus = "pending" | "verified" | "warning" | "not_found";
export type SupportVerdict = "not_reviewed" | "supported" | "partial" | "unsupported";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type SessionPhase = "intake" | "verified" | "supported" | "export_ready";
export type ExportFormat = "html" | "csv" | "json";

export interface SourceLink {
  label: string;
  href: string;
}

export interface CitationRecord {
  id: string;
  reference: string;
  title: string;
  kind: CitationKind;
  status: AuthorityStatus;
  confidence: number;
  source: string;
  sourceLinks: SourceLink[];
  issue: string;
  evidenceTrail: string[];
  manualNextStep?: string;
  memoClaim: string;
  opinionExcerpt: string;
  holding: string;
  supportVerdict: SupportVerdict;
  supportSummary: string;
  exportArtifacts: string[];
  exportNote: string;
  riskLevel: RiskLevel;
}

export interface ReviewDocument {
  id: string;
  name: string;
  format: ReviewDocumentFormat;
  matterName: string;
  owner: string;
  lastCheckedLabel: string;
  summary: string;
  citations: CitationRecord[];
}

export interface ReviewCapability {
  id: string;
  label: string;
  description: string;
  status: "live" | "planned";
}

export interface ReviewMetrics {
  totalDocuments: number;
  totalCitations: number;
  verifiedCount: number;
  warningCount: number;
  notFoundCount: number;
  supportedCount: number;
  partialCount: number;
  unsupportedCount: number;
  readinessScore: number;
}

export interface ReviewSession {
  id: string;
  slug: string;
  productName: string;
  matterName: string;
  owner: string;
  phase: SessionPhase;
  createdAt: string;
  updatedAt: string;
  summary: string;
  documents: ReviewDocument[];
  metrics: ReviewMetrics;
  capabilities: ReviewCapability[];
}

export interface ReviewInputDocument {
  name: string;
  format: ReviewDocumentFormat;
  text: string;
}

export interface CreateReviewSessionInput {
  matterName: string;
  owner?: string;
  documents: ReviewInputDocument[];
}

export interface ScopedActionRequest {
  documentId?: string;
}

export interface ExportRequest extends ScopedActionRequest {
  format: ExportFormat;
}

export interface ReviewExportArtifact {
  format: ExportFormat;
  fileName: string;
  mimeType: string;
  content: string;
  summary: string;
  createdAt: string;
}

