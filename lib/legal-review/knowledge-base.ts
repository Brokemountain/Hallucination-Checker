import {
  type CitationKind,
  type RiskLevel,
  type SourceLink,
  type SupportVerdict,
} from "./contracts";
import { normalizeCitationReference } from "./utils";

export interface AuthorityProfile {
  reference: string;
  kind: CitationKind;
  title: string;
  status: "verified" | "warning" | "not_found";
  confidence: number;
  source: string;
  sourceLinks: SourceLink[];
  issue: string;
  evidenceTrail: string[];
  manualNextStep?: string;
  opinionExcerpt: string;
  holding: string;
  supportVerdict: SupportVerdict;
  supportSummary: string;
  exportArtifacts: string[];
  exportNote: string;
  riskLevel: RiskLevel;
}

const authorityProfiles: AuthorityProfile[] = [
  {
    reference: "Ashcroft v. Iqbal, 556 U.S. 662 (2009)",
    kind: "case",
    title: "Pleading standard and plausibility",
    status: "verified",
    confidence: 97,
    source: "Authority Graph - CourtListener cluster match",
    sourceLinks: [{ label: "CourtListener", href: "https://www.courtlistener.com/opinion/145681/ashcroft-v-iqbal/" }],
    issue: "Reporter, page, and party names align cleanly with the cited Supreme Court decision.",
    evidenceTrail: [
      "Volume, reporter, and page resolve to an exact Supreme Court match.",
      "Case caption and year stay consistent across the authoritative record.",
      "Opinion text is stable enough for proposition-level support review.",
    ],
    opinionExcerpt:
      "\"Threadbare recitals of the elements of a cause of action, supported by mere conclusory statements, do not suffice.\"",
    holding:
      "Iqbal requires factual content sufficient to make the claim plausible, not merely conceivable.",
    supportVerdict: "supported",
    supportSummary:
      "The proposition and the opinion line up directly, so this is a strong support citation.",
    exportArtifacts: ["HTML report", "PDF packet", "CSV audit row"],
    exportNote: "Ship as green-flag authority with a high-confidence support marker.",
    riskLevel: "low",
  },
  {
    reference: "Bell Atl. Corp. v. Twombly, 550 U.S. 544 (2007)",
    kind: "case",
    title: "Antitrust pleading threshold",
    status: "verified",
    confidence: 94,
    source: "Authority Graph - CourtListener cluster match",
    sourceLinks: [{ label: "CourtListener", href: "https://www.courtlistener.com/opinion/145695/bell-atl-corp-v-twombly/" }],
    issue: "The authority is real, but the surrounding memo language usually needs narrowing.",
    evidenceTrail: [
      "Reporter line maps cleanly to the Supreme Court record.",
      "Metadata confirms the citation without fallback matching.",
      "Support review frequently catches overreach when the memo drifts into standing or merits language.",
    ],
    opinionExcerpt:
      "\"Factual allegations must be enough to raise a right to relief above the speculative level.\"",
    holding:
      "Twombly is a plausibility case about pleading sufficiency, not a general standing rule.",
    supportVerdict: "partial",
    supportSummary:
      "The authority is valid, but the proposition often overstates what the case actually decides.",
    exportArtifacts: ["HTML report", "PDF packet", "Partner note"],
    exportNote: "Export with amber language and a recommendation to tighten the parenthetical.",
    riskLevel: "high",
  },
  {
    reference: "Mendoza v. Atlantic Horizon, 2021 WL 1827426",
    kind: "case",
    title: "Invented Montreal Convention tolling case",
    status: "not_found",
    confidence: 12,
    source: "Authority Graph - no authoritative free-source hit",
    sourceLinks: [],
    issue: "No authoritative cluster, reporter, or stable name result supports this citation.",
    evidenceTrail: [
      "Direct citation lookup fails to resolve to a recognized authority.",
      "Fallback name search surfaces unrelated matters only.",
      "No opinion text exists for downstream proposition review.",
    ],
    manualNextStep:
      "Treat this as a filing blocker until research identifies a real authority or the cite is replaced.",
    opinionExcerpt: "Opinion text unavailable because the underlying authority could not be verified.",
    holding: "Unknown. The cited authority is not established.",
    supportVerdict: "unsupported",
    supportSummary:
      "Support review is blocked because the authority itself has not been proven to exist.",
    exportArtifacts: ["Critical-risk issue card", "CSV escalation row"],
    exportNote: "Export only as a blocker item, not as usable authority.",
    riskLevel: "critical",
  },
  {
    reference: "42 U.S.C. § 1983",
    kind: "statute",
    title: "Civil rights claim predicate",
    status: "verified",
    confidence: 99,
    source: "Authority Graph - Cornell LII section check",
    sourceLinks: [{ label: "Cornell LII", href: "https://www.law.cornell.edu/uscode/text/42/1983" }],
    issue: "The section exists exactly as cited, though substantive fit still needs human legal judgment.",
    evidenceTrail: [
      "The federal code section resolves cleanly in Cornell LII.",
      "No subsection mismatch appears in the locator.",
      "Existence is strong; interpretive use remains a lawyer task.",
    ],
    opinionExcerpt: "Statutory support remains a human legal judgment once the citation itself is verified.",
    holding: "The citation points to a real statute, but meaning and application still require attorney review.",
    supportVerdict: "partial",
    supportSummary:
      "This authority is real, but statutory fit is intentionally conservative without line-level text analysis.",
    exportArtifacts: ["HTML report", "CSV audit row"],
    exportNote: "Export as a verified statute with a manual-interpretation note.",
    riskLevel: "medium",
  },
  {
    reference: "Travelers Cas. & Sur. Co. v. Pacific Gas & Elec. Co., 549 U.S. 443 (2007)",
    kind: "case",
    title: "Fee recovery in bankruptcy",
    status: "verified",
    confidence: 95,
    source: "Authority Graph - CourtListener cluster match",
    sourceLinks: [{ label: "CourtListener", href: "https://www.courtlistener.com/opinion/145562/travelers-cas-sur-co-v-pacific-gas-elec-co/" }],
    issue: "Authority is solid, but proposition phrasing often becomes broader than the Court's actual holding.",
    evidenceTrail: [
      "Direct citation lookup returns the correct Supreme Court matter.",
      "Reporter line and case caption match the authoritative record.",
      "Opinion language is available for proposition-level comparison.",
    ],
    opinionExcerpt:
      "\"We generally presume that claims enforceable under applicable state law will be allowed in bankruptcy unless they are expressly disallowed.\"",
    holding:
      "Travelers supports a strong presumption for state-law-valid claims, not an automatic fee recovery rule in every posture.",
    supportVerdict: "partial",
    supportSummary:
      "The citation is real, but the memo language usually needs narrowing to stay faithful to the holding.",
    exportArtifacts: ["HTML report", "Partner markup note"],
    exportNote: "Export with a yellow support marker and suggested narrowing language.",
    riskLevel: "high",
  },
  {
    reference: "United States v. Heppner, No. 23-cr-00084 (S.D.N.Y. 2025)",
    kind: "case",
    title: "Privilege posture of consumer AI usage",
    status: "warning",
    confidence: 68,
    source: "Authority Graph - docket-style name fallback",
    sourceLinks: [],
    issue: "The docket style looks plausible, but the cite is not yet stable enough to treat as filing-ready authority.",
    evidenceTrail: [
      "Name and docket pattern align with a plausible federal criminal matter.",
      "No stable reporter cite is available from the supplied reference.",
      "Proposition review should remain provisional until the underlying opinion is pinned down.",
    ],
    manualNextStep:
      "Replace the placeholder cite with the final docket or slip-opinion citation before using it in filed work.",
    opinionExcerpt:
      "\"Privilege analysis depends on the actual disclosure pathway and provider relationship.\"",
    holding:
      "The authority, if accurate, appears far more fact-specific than a categorical waiver rule.",
    supportVerdict: "unsupported",
    supportSummary:
      "Even assuming the underlying matter is right, the proposition overstates the likely holding into a categorical rule.",
    exportArtifacts: ["Warning card", "Research task note"],
    exportNote: "Keep out of any final packet until the authority is stabilized.",
    riskLevel: "critical",
  },
  {
    reference: "Fed. R. Bankr. P. 9011",
    kind: "rule",
    title: "Sanctions framework anchor",
    status: "verified",
    confidence: 96,
    source: "Authority Graph - Cornell LII rule lookup",
    sourceLinks: [{ label: "Cornell LII", href: "https://www.law.cornell.edu/rules/frbp/rule_9011" }],
    issue: "The rule exists and the locator is stable.",
    evidenceTrail: [
      "The rule resolves to the correct federal bankruptcy rule.",
      "No numbering mismatch appears in the citation.",
      "Application remains a legal-judgment question rather than a pure citation question.",
    ],
    opinionExcerpt: "Rules are verified for existence first; application remains a legal reasoning step.",
    holding: "The rule is real, though the filing still needs lawyer judgment about fit and sanctions posture.",
    supportVerdict: "partial",
    supportSummary:
      "Good authority locator, but proposition-level support should still be reviewed by counsel.",
    exportArtifacts: ["HTML report", "CSV audit row"],
    exportNote: "Export as a verified rule with a manual-application reminder.",
    riskLevel: "medium",
  },
  {
    reference: "Morrison v. Nat'l Australia Bank Ltd., 561 U.S. 247 (2010)",
    kind: "case",
    title: "Extraterritoriality boundary",
    status: "verified",
    confidence: 98,
    source: "Authority Graph - CourtListener cluster match",
    sourceLinks: [{ label: "CourtListener", href: "https://www.courtlistener.com/opinion/145753/morrison-v-national-australia-bank-ltd/" }],
    issue: "High-confidence authority and a strong proposition fit for the extracted memo sentence.",
    evidenceTrail: [
      "Reporter line resolves directly to the Supreme Court opinion.",
      "Case caption and year align with the authoritative record.",
      "Opinion text offers a very clear proposition-level comparison.",
    ],
    opinionExcerpt:
      "\"Section 10(b) reaches the purchase or sale of a security listed on an American stock exchange, and the purchase or sale of any other security in the United States.\"",
    holding:
      "Morrison draws a domestic-transactions boundary for federal securities claims and is cited accurately in the draft.",
    supportVerdict: "supported",
    supportSummary:
      "This proposition stays tightly aligned with the opinion, making it a strong support citation.",
    exportArtifacts: ["HTML report", "PDF packet", "CSV audit row"],
    exportNote: "Ready to export as a green-flag authority.",
    riskLevel: "low",
  },
  {
    reference: "Pub. L. No. 117-263",
    kind: "public_law",
    title: "Public law reference",
    status: "verified",
    confidence: 92,
    source: "Authority Graph - GovInfo public-law locator",
    sourceLinks: [{ label: "GovInfo", href: "https://www.govinfo.gov/app/details/PLAW-117publ263" }],
    issue: "The public law exists, but the draft still needs a more precise section-level locator.",
    evidenceTrail: [
      "The public law number resolves correctly in GovInfo.",
      "The authority exists as cited.",
      "The filing would still benefit from a pinpoint section before submission.",
    ],
    manualNextStep: "Add the relevant section or subtitle before relying on the citation in filed work.",
    opinionExcerpt: "Public laws are source-verified here, but section-level proposition fit remains manual.",
    holding: "Real authority, insufficiently specific citation.",
    supportVerdict: "partial",
    supportSummary:
      "Verification passes, but the drafting quality is still too broad for filing-grade precision.",
    exportArtifacts: ["Warning note", "CSV audit row"],
    exportNote: "Export with a pinpoint request before final delivery.",
    riskLevel: "high",
  },
];

const authorityIndex = new Map(
  authorityProfiles.map((profile) => [normalizeCitationReference(profile.reference), profile]),
);

export function findAuthorityProfile(reference: string) {
  return authorityIndex.get(normalizeCitationReference(reference));
}
