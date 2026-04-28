import { type CitationKind } from "./contracts";
import { sentenceWindow, simplifyClaim } from "./utils";

export interface CitationDraft {
  reference: string;
  kind: CitationKind;
  memoClaim: string;
}

type MatchPattern = {
  kind: CitationKind;
  expression: RegExp;
};

const patterns: MatchPattern[] = [
  {
    kind: "case",
    expression:
      /\b[A-Z][A-Za-z.&'\-]+(?: (?:[A-Z][A-Za-z.&'\-]+|&))* v\. [A-Z][A-Za-z.&'\-]+(?: (?:[A-Z][A-Za-z.&'\-]+|&))*\, \d+ [A-Z][A-Za-z0-9.\-]{0,12}(?: [A-Z][A-Za-z0-9.\-]{0,12}){0,3} \d+(?:,\s*\d+(?:-\d+)?)?(?: \(\d{4}\))?/g,
  },
  {
    kind: "case",
    expression:
      /\b[A-Z][A-Za-z.&'\-]+(?: (?:[A-Z][A-Za-z.&'\-]+|&))* v\. [A-Z][A-Za-z.&'\-]+(?: (?:[A-Z][A-Za-z.&'\-]+|&))*\, \d{4} WL \d+/g,
  },
  {
    kind: "case",
    expression:
      /\b[A-Z][A-Za-z.&'\-]+(?: (?:[A-Z][A-Za-z.&'\-]+|&))* v\. [A-Z][A-Za-z.&'\-]+(?: (?:[A-Z][A-Za-z.&'\-]+|&))*\, No\. [0-9A-Za-z:\-]+ \([A-Za-z.\s]+\d{4}\)/g,
  },
  {
    kind: "statute",
    expression:
      /\b\d+\s+U\.S\.C\.\s*(?:§+|section|sec\.)\s*[\w.\-]+(?:\([a-z0-9]+\))*/gi,
  },
  {
    kind: "rule",
    expression: /\bFed\. R\. [A-Za-z. ]+ \d+(?:[A-Za-z0-9.\-]|\([a-z0-9]+\))*/g,
  },
  {
    kind: "public_law",
    expression: /\bPub\. L\. No\. \d+-\d+\b/g,
  },
  {
    kind: "statute",
    expression: /\bRegulation \(EU\) \d{4}\/\d{3,4}\b/g,
  },
  {
    kind: "statute",
    expression: /\bDirective \(EU\) \d{4}\/\d{3,4}\b/g,
  },
  {
    kind: "statute",
    expression: /\b(?:EU )?(?:Artificial Intelligence Act|AI Act)\b/g,
  },
  {
    kind: "statute",
    expression: /\b(?:General Data Protection Regulation|GDPR)\b/g,
  },
  {
    kind: "rule",
    expression: /\bArticle\s+\d+[a-zA-Z]?(?:\(\d+\))?(?:\([a-z]\))?\b/g,
  },
  {
    kind: "rule",
    expression: /\bAnnex\s+(?:[IVXLC]+|\d+)\b/g,
  },
];

function cleanReference(reference: string) {
  return reference
    .replace(/^(?:Under|See|But see|Cf\.?|Contra|Compare|Accord)\s+/i, "")
    .replace(/Â§/g, "§")
    .replace(/\bU\.S\.C\.\s*(?:section|sec\.)\s*/i, "U.S.C. § ")
    .replace(/\s*§+\s*/g, " § ")
    .replace(/[.;,\s]+$/, "")
    .trim();
}

export function extractCitationDrafts(text: string) {
  const drafts = new Map<string, CitationDraft>();

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern.expression)) {
      const reference = cleanReference(match[0] ?? "");
      const index = match.index ?? 0;

      if (!reference || drafts.has(reference)) {
        continue;
      }

      const context = sentenceWindow(text, index, index + reference.length);
      drafts.set(reference, {
        reference,
        kind: pattern.kind,
        memoClaim: simplifyClaim(context, reference),
      });
    }
  }

  return Array.from(drafts.values());
}
