import { format } from "sql-formatter";

const abapKeywordReplacements: Array<[RegExp, string]> = [
  [/\bup\s+to\b/gi, "UP TO"],
  [/\brows\b/gi, "ROWS"],
  [/\bclient\s+specified\b/gi, "CLIENT SPECIFIED"],
  [/\bbypassing\s+buffer\b/gi, "BYPASSING BUFFER"],
  [/\binto\s+table\b/gi, "INTO TABLE"],
  [/\bfor\s+all\s+entries\s+in\b/gi, "FOR ALL ENTRIES IN"],
  [/\bdescribe\s+keys\s+for\b/gi, "DESCRIBE KEYS FOR"],
  [/\bshow\s+last\s+sync\s+for\b/gi, "SHOW LAST SYNC FOR"],
];

function normalizeAbapKeywords(value: string) {
  return abapKeywordReplacements.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    value,
  );
}

function addAbapClauseBreaks(value: string) {
  return value
    .replace(/\s+(UP TO\s+\d+\s+ROWS)\b/g, "\n$1")
    .replace(/\s+(CLIENT SPECIFIED)\b/g, "\n$1")
    .replace(/\s+(BYPASSING BUFFER)\b/g, "\n$1")
    .replace(/\s+(INTO TABLE\b[^\n]*)/g, "\n$1")
    .replace(/\s+(FOR ALL ENTRIES IN\b[^\n]*)/g, "\n$1");
}

function formatWithFallback(queryText: string) {
  try {
    return format(queryText, {
      language: "sql",
      keywordCase: "upper",
      functionCase: "upper",
      dataTypeCase: "upper",
      logicalOperatorNewline: "before",
      tabWidth: 2,
      linesBetweenQueries: 2,
    });
  } catch {
    return queryText;
  }
}

export function formatOpenSql(queryText: string) {
  const trimmedQuery = queryText.trim();

  if (!trimmedQuery) {
    return "";
  }

  return addAbapClauseBreaks(
    normalizeAbapKeywords(formatWithFallback(trimmedQuery)),
  ).trim();
}
