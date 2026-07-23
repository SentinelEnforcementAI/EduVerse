// Contextual document search (spec 5.9). The point of this feature: it matches
// what a document SAYS and the themes it covers, not its filename or title.
// The incumbents match filenames, which is worthless; this ranks on content,
// summary and themes, and explains the match by returning the matched themes
// and a snippet from the body.

export type SearchableDoc = {
  id: string;
  title: string;
  type: string;
  status: string;
  docDate: Date;
  themes: string[];
  summary: string;
  content: string;
  scope: string;
};

export type SearchHit = {
  id: string;
  title: string;
  type: string;
  status: string;
  docDate: Date;
  scope: string;
  score: number;
  matchedThemes: string[];
  snippet: string;
};

function terms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

// A snippet of body content around the first matched term, so the DSL sees why
// a document matched, not just that it did.
function snippetFor(content: string, matchTerms: string[]): string {
  const lower = content.toLowerCase();
  let at = -1;
  for (const t of matchTerms) {
    const i = lower.indexOf(t);
    if (i !== -1 && (at === -1 || i < at)) at = i;
  }
  if (at === -1) return content.slice(0, 160).trim();
  const start = Math.max(0, at - 70);
  const end = Math.min(content.length, at + 90);
  return `${start > 0 ? "…" : ""}${content.slice(start, end).trim()}${
    end < content.length ? "…" : ""
  }`;
}

// Ranks documents against a query. Weights: a theme match is the strongest
// signal (this is a themed corpus), then summary, then body content; the title
// is the weakest so that filename/title matching never dominates.
export function rankDocuments(
  docs: SearchableDoc[],
  query: string,
): SearchHit[] {
  const qterms = terms(query);
  if (qterms.length === 0) return [];

  const hits: SearchHit[] = [];
  for (const doc of docs) {
    const content = doc.content.toLowerCase();
    const summary = doc.summary.toLowerCase();
    const title = doc.title.toLowerCase();
    const matchedThemes = doc.themes.filter((theme) =>
      qterms.some((t) => theme.toLowerCase().includes(t)),
    );

    let score = 0;
    const contentTerms: string[] = [];
    for (const t of qterms) {
      if (content.includes(t)) {
        score += 2;
        contentTerms.push(t);
      }
      if (summary.includes(t)) score += 3;
      if (title.includes(t)) score += 1;
    }
    score += matchedThemes.length * 4;

    if (score > 0) {
      hits.push({
        id: doc.id,
        title: doc.title,
        type: doc.type,
        status: doc.status,
        docDate: doc.docDate,
        scope: doc.scope,
        score,
        matchedThemes,
        snippet: snippetFor(doc.content, contentTerms.length ? contentTerms : qterms),
      });
    }
  }

  return hits.sort((a, b) => b.score - a.score);
}

// A short, deterministic synthesis of the result set (spec 5.9: a search
// synthesis summary). No LLM; the advisory synthesis (step 15) falls back here.
export function synthesise(query: string, hits: SearchHit[]): string {
  if (hits.length === 0) {
    return `No documents in the repository match "${query}".`;
  }
  const themes = [...new Set(hits.flatMap((h) => h.matchedThemes))].slice(0, 5);
  const themePart = themes.length
    ? ` They cover ${themes.join(", ")}.`
    : "";
  return `Found ${hits.length} document${hits.length > 1 ? "s" : ""} relating to "${query}".${themePart}`;
}
