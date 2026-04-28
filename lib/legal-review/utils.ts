export function normalizeCitationReference(value: string) {
  return value
    .replace(/\u00A0/g, " ")
    .replace(/Â§/g, "§")
    .replace(/\b(?:section|sec\.)\s+/gi, "§ ")
    .replace(/\s+/g, " ")
    .replace(/\s*§+\s*/g, " § ")
    .replace(/\s*,\s*/g, ", ")
    .trim()
    .toLowerCase();
}

export function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return slug || "review-session";
}

export function sentenceWindow(text: string, start: number, end: number) {
  const left = text.slice(0, start);
  const right = text.slice(end);

  const leftBreak = Math.max(left.lastIndexOf("."), left.lastIndexOf("\n"));
  const rightPeriod = right.search(/[.\n]/);
  const windowStart = leftBreak === -1 ? 0 : leftBreak + 1;
  const windowEnd = rightPeriod === -1 ? text.length : end + rightPeriod + 1;

  return text
    .slice(windowStart, windowEnd)
    .replace(/\s+/g, " ")
    .trim();
}

export function simplifyClaim(context: string, citation: string) {
  return context.replace(citation, "this authority").replace(/\s+/g, " ").trim();
}

export function relativeTimeLabel(timestamp: string) {
  const delta = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.max(0, Math.floor(delta / 60_000));

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hr ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function keywordSet(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 3),
  );
}

export function overlapScore(left: string, right: string) {
  const leftTokens = keywordSet(left);
  const rightTokens = keywordSet(right);

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let matches = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) {
      matches += 1;
    }
  });

  return matches / Math.max(leftTokens.size, rightTokens.size);
}
