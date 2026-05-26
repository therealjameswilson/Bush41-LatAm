const CHAPTER_ORDER = [
  "Argentina",
  "Bolivia",
  "Brazil",
  "Chile",
  "Colombia",
  "Ecuador",
  "Guyana",
  "Paraguay",
  "Peru",
  "Suriname",
  "Uruguay",
  "Venezuela"
];

const recordsRoot = document.querySelector("#records-root");
const totalRecords = document.querySelector("#total-records");
const totalChapters = document.querySelector("#total-chapters");
const totalPages = document.querySelector("#total-pages");
const resultSummary = document.querySelector("#result-summary");
const searchInput = document.querySelector("#record-search");
const countryFilter = document.querySelector("#country-filter");
const typeFilter = document.querySelector("#type-filter");
const sourceFilter = document.querySelector("#source-filter");
const releaseFilter = document.querySelector("#release-filter");
const clearFilters = document.querySelector("#clear-filters");
const printCandidatesRoot = document.querySelector("#print-candidates-root");
const candidateSearchInput = document.querySelector("#candidate-search");
const candidateCountryFilter = document.querySelector("#candidate-country-filter");
const candidatePriorityFilter = document.querySelector("#candidate-priority-filter");
const candidateSourceFilter = document.querySelector("#candidate-source-filter");
const candidateTypeFilter = document.querySelector("#candidate-type-filter");
const clearCandidateFilters = document.querySelector("#clear-candidate-filters");
const candidateResultSummary = document.querySelector("#candidate-result-summary");
const publicStatementsRoot = document.querySelector("#public-statements-root");
const statementSearchInput = document.querySelector("#statement-search");
const statementCountryFilter = document.querySelector("#statement-country-filter");
const statementTypeFilter = document.querySelector("#statement-type-filter");
const statementYearFilter = document.querySelector("#statement-year-filter");
const statementBookFilter = document.querySelector("#statement-book-filter");
const clearStatementFilters = document.querySelector("#clear-statement-filters");
const statementResultSummary = document.querySelector("#statement-result-summary");
const dailyDiaryRoot = document.querySelector("#daily-diary-root");
const dailyDiarySearchInput = document.querySelector("#daily-diary-search");
const dailyDiaryCountryFilter = document.querySelector("#daily-diary-country-filter");
const dailyDiaryTypeFilter = document.querySelector("#daily-diary-type-filter");
const dailyDiaryLinkFilter = document.querySelector("#daily-diary-link-filter");
const clearDailyDiaryFilters = document.querySelector("#clear-daily-diary-filters");
const dailyDiaryResultSummary = document.querySelector("#daily-diary-result-summary");
const compilerGapsRoot = document.querySelector("#compiler-gaps-root");
let allRecords = [];
let allPrintCandidates = [];
let allPublicStatements = [];
let allDailyDiaryReferences = [];

function chapterId(chapterName) {
  return `chapter-${chapterName.toLowerCase().replace(/\s+/g, "-")}`;
}

function formatDate(dateString) {
  if (!dateString) return "Undated";
  const date = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function shortDate(dateString) {
  if (!dateString) return "Undated";
  const date = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function byChapterThenDate(a, b) {
  return (
    chapterNumber(a) - chapterNumber(b) ||
    (a.sortDate || a.date || "").localeCompare(b.sortDate || b.date || "") ||
    (a.title || "").localeCompare(b.title || "")
  );
}

function chapterNumber(record) {
  return record.chapter?.number || CHAPTER_ORDER.indexOf(record.chapter?.name) + 1 || 999;
}

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value.toString();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function uniqueInOrder(values) {
  const seen = new Set();
  return values.filter((value) => {
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function sourceBucket(record) {
  if (record.source?.name === "Brent Scowcroft Papers") return "scowcroft";
  if (record.source?.series === "Presidential Memcon Files") return "memcon";
  if (record.source?.series === "Presidential Telcon Files") return "telcon";
  return "other";
}

function sourceLabel(record) {
  switch (sourceBucket(record)) {
    case "scowcroft":
      return "Scowcroft extract";
    case "memcon":
      return "Presidential Memcon Files";
    case "telcon":
      return "Presidential Telcon Files";
    default:
      return record.source?.series || record.source?.name || "Source pending";
  }
}

function candidateSourceName(candidate) {
  if (candidate.sourceSeries?.name) return candidate.sourceSeries.name;
  if (/^chronological-print-/.test(candidate.id || "")) return "Latin American Directorate Chronological Files";
  return "Latin American Affairs Directorate Subject Files";
}

function candidateSourceShort(candidate) {
  const name = candidateSourceName(candidate);
  if (/Timothy E\.?\s*Deal/i.test(name)) return "Deal Subject Files";
  return /Chronological/i.test(name) ? "Chronological Files" : "Subject Files";
}

function reviewFlags(record) {
  const flags = [];
  if (record.releaseStatus && record.releaseStatus !== "Full") {
    flags.push(record.releaseStatus);
  }
  if (record.source?.sourcePages) {
    flags.push(`Source pages ${record.source.sourcePages}`);
  }
  if ((record.source?.duplicateSources || []).length) {
    flags.push("Deduped cross-reference");
  }
  if (sourceBucket(record) === "scowcroft") {
    flags.push("Local page-range extract");
  }
  if (record.source?.priorityCollection) {
    flags.push("Priority collection");
  }
  return flags;
}

function normalizeSourceText(value) {
  return (value || "")
    .replace(/\s*--\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
}

function isMarkerLabel(value) {
  return /^(Collection\/Office of Origin|Series|Subseries|Folder ID Number|Folder Title):?$/i.test(value || "");
}

function cleanFolderTitle(record) {
  const source = record.source || {};
  const provenanceTitle = source.provenanceSheet?.folderTitle;
  const rawTitle = provenanceTitle || source.fileUnitTitle || record.sourceTitle || record.documentTitle || record.title || "";
  const pieces = rawTitle
    .split(";")
    .map((piece) => normalizeSourceText(piece))
    .filter(Boolean)
    .filter((piece) => !/\.pdf$/i.test(piece))
    .filter((piece) => !/^source pages?\b/i.test(piece));

  return (pieces[0] || normalizeSourceText(rawTitle)).replace(/^\d{5}\s+\d{5}-\d{3}\s+/, "");
}

function sentence(value) {
  if (!value) return "";
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function releaseSentence(record) {
  const status = record.releaseStatus || "";
  if (/declassified/i.test(status)) return "Declassified.";
  if (/full/i.test(status)) return "Declassified.";
  if (/partial/i.test(status)) return `Declassified; partial release: ${status}.`;
  if (/restricted|withheld|denied|excised/i.test(status)) return `Access restriction: ${status}.`;
  if (/unknown/i.test(status)) return "Release status not determined.";
  return sentence(status);
}

function collectionName(value) {
  if (isMarkerLabel(value)) return "Brent Scowcroft Collection";
  if (/Scowcroft,\s*Brent,\s*Collection/i.test(value || "")) return "Brent Scowcroft Collection";
  return normalizeSourceText(value);
}

function recordGroupName(value) {
  if (isMarkerLabel(value)) return "Bush Presidential Records";
  if (/Bush Presidential Records|George H\.?\s*W\.?\s*Bush Presidential Records/i.test(value || "")) {
    return "Bush Presidential Records";
  }
  return normalizeSourceText(value);
}

function scowcroftSubseries(record) {
  const provenance = record.source?.provenanceSheet || {};
  if (provenance.subseries && !isMarkerLabel(provenance.subseries) && !/George H\.?W\.?\s*Bush Presidential Records/i.test(provenance.subseries)) {
    return provenance.subseries;
  }
  if (/telcon|telephone/i.test(`${record.type || ""} ${record.title || ""}`)) return "Presidential Telcon Files";
  return "Presidential Memcons Files";
}

function scowcroftSourcePath(record) {
  const source = record.source || {};
  const provenance = source.provenanceSheet || {};
  const folderId = /^\d{5}-\d{3}$/.test(provenance.folderIdNumber || "")
    ? provenance.folderIdNumber
    : record.localIdentifier || provenance.folderIdNumber || provenance.oaIdNumber;
  return uniqueInOrder([
    "George H.W. Bush Library",
    recordGroupName(provenance.recordGroupCollection || "Bush Presidential Records"),
    collectionName(provenance.collectionOfficeOfOrigin || "Brent Scowcroft Collection"),
    isMarkerLabel(provenance.series) ? "Presidential Correspondence Files" : provenance.series || "Presidential Correspondence Files",
    scowcroftSubseries(record),
    `OA/ID ${folderId}`,
    cleanFolderTitle(record)
  ]).join(", ");
}

function nscSourcePath(record) {
  const source = record.source || {};
  return uniqueInOrder([
    "George H.W. Bush Library",
    "Bush Presidential Records",
    "National Security Council",
    source.series || "Presidential Memcon/Telcon Files",
    cleanFolderTitle(record)
  ]).join(", ");
}

function frusSourceNote(record) {
  const source = record.source || {};

  if (source.name === "Brent Scowcroft Papers") {
    return [`Source: ${scowcroftSourcePath(record)}.`, releaseSentence(record)].filter(Boolean).join(" ");
  }

  if (source.name === "Records of the National Security Council (George H. W. Bush Administration)") {
    return [`Source: ${nscSourcePath(record)}.`, releaseSentence(record)].filter(Boolean).join(" ");
  }

  return sentence(record.sourceNote || "Source: Provenance pending.");
}

function setChapterCounts(records) {
  totalRecords.textContent = records.length.toString();
  totalChapters.textContent = CHAPTER_ORDER.length.toString();
  totalPages.textContent = records.reduce((sum, record) => sum + (record.pageCount || 0), 0).toString();

  for (const chapterName of CHAPTER_ORDER) {
    const chapterRecords = records.filter((record) => record.chapter.name === chapterName);
    const countNode = document.querySelector(`[data-chapter-count="${chapterName}"]`);
    const pagesNode = document.querySelector(`[data-chapter-pages="${chapterName}"]`);
    const pageTotal = chapterRecords.reduce((sum, record) => sum + (record.pageCount || 0), 0);

    if (countNode) {
      countNode.textContent = chapterRecords.length.toString();
    }
    if (pagesNode) {
      pagesNode.textContent = pageTotal.toString();
    }
  }
}

function setProvenanceCounts(records) {
  const counts = {
    telcon: records.filter((record) => record.source?.series === "Presidential Telcon Files").length,
    memcon: records.filter((record) => record.source?.series === "Presidential Memcon Files").length,
    scowcroft: records.filter((record) => record.source?.name === "Brent Scowcroft Papers").length,
    duplicates: records.filter((record) => (record.source?.duplicateSources || []).length > 0).length,
    dailyDiary: records.filter((record) => (record.dailyDiaryReferences || []).length > 0).length
  };

  for (const [name, value] of Object.entries(counts)) {
    setText(`[data-source-count="${name}"]`, value);
  }
}

function setPrintCandidateCounts(candidates) {
  setText("#print-total", candidates.length);
  setText("#print-high", candidates.filter((candidate) => candidate.priority === "High").length);
  setText("#print-folders", new Set(candidates.map((candidate) => candidate.folderNaid)).size);
}

function setPublicStatementCounts(statements) {
  setText("#statement-total", statements.length);
  setText("#statement-countries", new Set(statements.flatMap((statement) => statement.countries || [])).size);
  setText("#statement-books", new Set(statements.map((statement) => statement.packageId)).size);
}

function setCompilerGapCounts(audit) {
  setText("#gap-critical", audit.summary?.criticalCountryCount || 0);
  setText("#gap-high", audit.summary?.highCountryCount || 0);
  setText("#gap-high-leads", audit.summary?.highPriorityPrintCandidateCount || 0);
}

function populateSelect(select, values) {
  if (!select) return;
  const existing = new Set([...select.options].map((option) => option.value));
  for (const value of values) {
    if (existing.has(value)) continue;
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
}

function populateFilters(records) {
  populateSelect(countryFilter, CHAPTER_ORDER);
  populateSelect(typeFilter, unique(records.map((record) => record.type)));
  populateSelect(releaseFilter, unique(records.map((record) => record.releaseStatus)));
}

function populateCandidateFilters(candidates) {
  const candidateCountries = unique(candidates.flatMap((candidate) => candidate.countries || []));
  const orderedCountries = [
    ...CHAPTER_ORDER.filter((country) => candidateCountries.includes(country)),
    ...candidateCountries.filter((country) => !CHAPTER_ORDER.includes(country))
  ];
  populateSelect(candidateCountryFilter, orderedCountries);
  populateSelect(candidateSourceFilter, unique(candidates.map(candidateSourceName)));
  populateSelect(candidateTypeFilter, unique(candidates.map((candidate) => candidate.documentType)));
}

function populateStatementFilters(statements) {
  const statementCountries = unique(statements.flatMap((statement) => statement.countries || []));
  const orderedCountries = [
    ...CHAPTER_ORDER.filter((country) => statementCountries.includes(country)),
    ...statementCountries.filter((country) => !CHAPTER_ORDER.includes(country))
  ];
  populateSelect(statementCountryFilter, orderedCountries);
  populateSelect(statementTypeFilter, unique(statements.map((statement) => statement.documentType)));
  populateSelect(statementYearFilter, unique(statements.map(statementYear)));
  populateSelect(statementBookFilter, unique(statements.map((statement) => statement.bookLabel)));
}

function createMeta(record) {
  const meta = document.createElement("div");
  meta.className = "record-meta";

  const countries = (record.countries || []).filter((country) => country !== "United States").join(", ");
  const naid = record.naid?.startsWith("local-")
    ? "Local PDF"
    : record.naid
      ? `NAID ${record.naid}`
      : record.localIdentifier || "";

  for (const value of [
    countries,
    sourceLabel(record),
    record.pageCount ? `${record.pageCount} pages` : "Pages pending",
    naid,
    record.releaseStatus
  ]) {
    if (!value) continue;
    const item = document.createElement("span");
    item.textContent = value;
    meta.append(item);
  }

  return meta;
}

function createDetailLine(label, values) {
  const items = Array.isArray(values) ? values.filter(Boolean) : [values].filter(Boolean);
  if (!items.length) return null;

  const detail = document.createElement("p");
  detail.className = "record-detail-line";
  const labelNode = document.createElement("strong");
  labelNode.textContent = `${label}: `;
  detail.append(labelNode, document.createTextNode(items.join(", ")));
  return detail;
}

function createReviewFlags(record) {
  const flags = reviewFlags(record);
  if (!flags.length) return null;

  const container = document.createElement("div");
  container.className = "record-flags";
  for (const flag of flags) {
    const item = document.createElement("span");
    item.textContent = flag;
    container.append(item);
  }
  return container;
}

function createRecordDailyDiaryReferences(record) {
  const references = record.dailyDiaryReferences || [];
  if (!references.length) return null;

  const details = document.createElement("details");
  details.className = "record-provenance daily-diary-provenance";
  const summary = document.createElement("summary");
  summary.textContent = "Daily diary/backup references";

  const note = document.createElement("p");
  note.textContent =
    "Date-level references from the White House Office of Appointments and Scheduling Files. These files document schedule/call context and supporting materials; they are not substantive meeting minutes or telephone-call summaries.";

  const list = document.createElement("ul");
  list.className = "reference-list";
  for (const reference of references) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = reference.pdfUrl || reference.catalogUrl;
    link.rel = "noreferrer";
    link.target = "_blank";
    link.textContent = reference.title;
    const meta = [
      reference.type,
      reference.localIdentifier,
      reference.naid ? `NAID ${reference.naid}` : "",
      reference.empty ? "empty diary folder" : ""
    ]
      .filter(Boolean)
      .join("; ");
    item.append(link, document.createTextNode(meta ? ` (${meta})` : ""));
    list.append(item);
  }

  details.append(summary, note, list);
  return details;
}

function createSourceNote(record) {
  const citation = document.createElement("div");
  citation.className = "record-citation";

  const sourceNote = document.createElement("p");
  sourceNote.className = "record-source-note";
  sourceNote.textContent = frusSourceNote(record);
  citation.append(sourceNote);

  const dailyDiaryReferences = createRecordDailyDiaryReferences(record);
  if (dailyDiaryReferences) citation.append(dailyDiaryReferences);

  const provenanceNote = record.provenanceNote || (record.sourceNote !== sourceNote.textContent ? record.sourceNote : "");

  if (provenanceNote) {
    const details = document.createElement("details");
    details.className = "record-provenance";
    const summary = document.createElement("summary");
    summary.textContent = "Full provenance trail";
    const raw = document.createElement("p");
    raw.textContent = provenanceNote;
    details.append(summary, raw);
    citation.append(details);
  }

  return citation;
}

function createSubject(record) {
  const subject = document.createElement("p");
  subject.className = "record-subject";
  subject.textContent = record.subjectLine || record.title;
  return subject;
}

function createDateLine(record) {
  const line = document.createElement("p");
  line.className = "record-date-line";
  line.textContent = record.dateLine || formatDate(record.date);
  return line;
}

function createRecordRow(record) {
  const row = document.createElement("article");
  row.className = "record-row";
  row.id = record.id;

  const date = document.createElement("time");
  date.className = "record-date";
  date.dateTime = record.date || "";
  date.textContent = shortDate(record.date);

  const body = document.createElement("div");
  const title = document.createElement("a");
  title.className = "record-title";
  title.href = record.catalogUrl || record.pdfUrl;
  title.rel = "noreferrer";
  title.textContent = record.documentTitle || record.title;
  const bodyParts = [
    title,
    createDateLine(record),
    createSubject(record),
    createDetailLine("Participants", record.participants),
    createDetailLine("Topics", record.frusTopics || record.topics),
    createMeta(record),
    createReviewFlags(record),
    createSourceNote(record)
  ].filter(Boolean);
  body.append(...bodyParts);

  const links = document.createElement("div");
  links.className = "record-links";

  if (record.catalogUrl && !record.naid?.startsWith("local-")) {
    const catalog = document.createElement("a");
    catalog.href = record.catalogUrl;
    catalog.rel = "noreferrer";
    catalog.textContent = "Catalog";
    links.append(catalog);
  }

  if (record.pdfUrl) {
    const pdf = document.createElement("a");
    pdf.href = record.pdfUrl;
    pdf.rel = "noreferrer";
    pdf.target = "_blank";
    pdf.textContent = "Open PDF";
    links.append(pdf);

    const print = document.createElement("a");
    print.href = record.pdfUrl;
    print.rel = "noreferrer";
    print.target = "_blank";
    print.textContent = "Print PDF";
    links.append(print);
  }

  row.append(date, body, links);
  return row;
}

function priorityRank(priority) {
  return { High: 0, Medium: 1, Reference: 2 }[priority] ?? 9;
}

function candidateDateValue(candidate) {
  const value = candidate.documentDate || "";
  if (!value || /^n\.d\.$/i.test(value)) return "";
  const parsed = Date.parse(`${value} UTC`);
  if (Number.isNaN(parsed)) return "";
  return new Date(parsed).toISOString().slice(0, 10);
}

function candidateCountryRank(candidate) {
  const country = (candidate.countries || [])[0] || "";
  const index = CHAPTER_ORDER.indexOf(country);
  return index === -1 ? 999 : index;
}

function byCandidateUtility(a, b) {
  return (
    priorityRank(a.priority) - priorityRank(b.priority) ||
    b.score - a.score ||
    candidateCountryRank(a) - candidateCountryRank(b) ||
    candidateDateValue(a).localeCompare(candidateDateValue(b)) ||
    a.folderTitle.localeCompare(b.folderTitle) ||
    a.pageStart - b.pageStart
  );
}

function candidateSearchText(candidate) {
  return [
    candidate.documentTitle,
    candidate.documentType,
    candidate.documentDate,
    candidate.documentNo,
    candidate.folderTitle,
    candidate.localIdentifier,
    candidate.folderNaid,
    candidate.accessRestriction,
    candidate.extraction,
    candidateSourceName(candidate),
    candidate.sourceSeries?.naid,
    candidate.reviewReason,
    candidate.sourceNote,
    candidate.ocrSnippet,
    candidate.countries,
    candidate.themes
  ]
    .flat()
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function activeCandidateFilters() {
  return {
    query: candidateSearchInput?.value.trim().toLowerCase() || "",
    country: candidateCountryFilter?.value || "",
    priority: candidatePriorityFilter?.value || "",
    source: candidateSourceFilter?.value || "",
    type: candidateTypeFilter?.value || ""
  };
}

function candidateMatches(candidate, filters) {
  if (filters.query && !candidateSearchText(candidate).includes(filters.query)) return false;
  if (filters.country && !(candidate.countries || []).includes(filters.country)) return false;
  if (filters.priority && candidate.priority !== filters.priority) return false;
  if (filters.source && candidateSourceName(candidate) !== filters.source) return false;
  if (filters.type && candidate.documentType !== filters.type) return false;
  return true;
}

function filteredPrintCandidates(candidates) {
  const filters = activeCandidateFilters();
  return candidates.filter((candidate) => candidateMatches(candidate, filters));
}

function createCandidateMeta(candidate) {
  const meta = document.createElement("div");
  meta.className = "record-meta candidate-meta";

  for (const value of [
    candidateSourceShort(candidate),
    candidate.documentType,
    (candidate.countries || []).join(", "),
    candidate.localIdentifier,
    candidate.pageStart ? `page ${candidate.pageStart}` : "",
    candidate.extraction === "withdrawal-sheet" ? "Withdrawal sheet" : "OCR text",
    candidate.accessRestriction
  ]) {
    if (!value) continue;
    const item = document.createElement("span");
    item.textContent = value;
    meta.append(item);
  }

  return meta;
}

function createCandidatePriority(candidate) {
  const badge = document.createElement("span");
  badge.className = `candidate-priority ${candidate.priority.toLowerCase()}`;
  badge.textContent = `${candidate.priority} priority`;
  return badge;
}

function createCandidateSourceNote(candidate) {
  const citation = document.createElement("div");
  citation.className = "record-citation";

  const sourceNote = document.createElement("p");
  sourceNote.className = "record-source-note";
  sourceNote.textContent = candidate.sourceNote || "Source: Provenance pending.";
  citation.append(sourceNote);

  const details = document.createElement("details");
  details.className = "record-provenance candidate-provenance";
  const summary = document.createElement("summary");
  summary.textContent = "OCR and review signal";
  const reason = document.createElement("p");
  reason.textContent = [candidate.reviewReason, candidate.ocrSnippet].filter(Boolean).join(" - ");
  details.append(summary, reason);
  citation.append(details);

  return citation;
}

function createCandidateRow(candidate) {
  const row = document.createElement("article");
  row.className = "candidate-row";

  const date = document.createElement("time");
  date.className = "record-date candidate-date";
  date.dateTime = candidateDateValue(candidate);
  date.textContent = candidate.documentDate || "Undated";

  const body = document.createElement("div");
  const title = document.createElement("a");
  title.className = "record-title candidate-title";
  title.href = candidate.pageLink || candidate.catalogUrl || candidate.pdfUrl;
  title.rel = "noreferrer";
  title.target = "_blank";
  title.textContent = candidate.documentNo
    ? `${candidate.documentNo} ${candidate.documentTitle}`
    : candidate.documentTitle;

  const folderLine = createDetailLine("Folder", [
    candidate.folderTitle,
    candidate.folderNaid ? `NAID ${candidate.folderNaid}` : ""
  ]);
  const themeLine = createDetailLine("Themes", candidate.themes);

  body.append(
    createCandidatePriority(candidate),
    title,
    createCandidateMeta(candidate),
    ...(folderLine ? [folderLine] : []),
    ...(themeLine ? [themeLine] : []),
    createCandidateSourceNote(candidate)
  );

  const links = document.createElement("div");
  links.className = "record-links candidate-links";

  for (const [label, url] of [
    ["PDF Page", candidate.pageLink],
    ["Catalog", candidate.catalogUrl],
    ["Folder PDF", candidate.pdfUrl]
  ]) {
    if (!url) continue;
    const link = document.createElement("a");
    link.href = url;
    link.rel = "noreferrer";
    link.target = "_blank";
    link.textContent = label;
    links.append(link);
  }

  row.append(date, body, links);
  return row;
}

function statementYear(statement) {
  return (statement.documentDate || statement.sortDate || "").slice(0, 4);
}

function statementDateValue(statement) {
  return statement.sortDate || statement.documentDate || "";
}

function statementPageLabel(statement) {
  if (!statement.pageStart) return "";
  if (statement.pageEnd && statement.pageEnd !== statement.pageStart) {
    return `pp. ${statement.pageStart}-${statement.pageEnd}`;
  }
  return `p. ${statement.pageStart}`;
}

function statementExtractionLabel(statement) {
  return statement.extraction === "govinfo-granule-html" ? "GovInfo HTML" : "Volume OCR";
}

function statementSearchText(statement) {
  return [
    statement.title,
    statement.documentDate,
    statement.documentType,
    statement.countries,
    statement.bookLabel,
    statement.packageId,
    statement.granuleId,
    statement.pageStart,
    statement.pageEnd,
    statement.extraction,
    statement.sourceNote,
    statement.snippet
  ]
    .flat()
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function activeStatementFilters() {
  return {
    query: statementSearchInput?.value.trim().toLowerCase() || "",
    country: statementCountryFilter?.value || "",
    type: statementTypeFilter?.value || "",
    year: statementYearFilter?.value || "",
    book: statementBookFilter?.value || ""
  };
}

function statementMatches(statement, filters) {
  if (filters.query && !statementSearchText(statement).includes(filters.query)) return false;
  if (filters.country && !(statement.countries || []).includes(filters.country)) return false;
  if (filters.type && statement.documentType !== filters.type) return false;
  if (filters.year && statementYear(statement) !== filters.year) return false;
  if (filters.book && statement.bookLabel !== filters.book) return false;
  return true;
}

function filteredPublicStatements(statements) {
  const filters = activeStatementFilters();
  return statements.filter((statement) => statementMatches(statement, filters));
}

function byStatementDate(a, b) {
  return (
    statementDateValue(a).localeCompare(statementDateValue(b)) ||
    (a.pageStart || 0) - (b.pageStart || 0) ||
    (a.title || "").localeCompare(b.title || "")
  );
}

function createStatementMeta(statement) {
  const meta = document.createElement("div");
  meta.className = "record-meta statement-meta";

  for (const value of [
    statement.documentType,
    (statement.countries || []).join(", "),
    statement.bookLabel,
    statementPageLabel(statement),
    statement.packageId,
    statementExtractionLabel(statement)
  ]) {
    if (!value) continue;
    const item = document.createElement("span");
    item.textContent = value;
    meta.append(item);
  }

  return meta;
}

function createStatementSourceNote(statement) {
  const citation = document.createElement("div");
  citation.className = "record-citation";

  const sourceNote = document.createElement("p");
  sourceNote.className = "record-source-note";
  sourceNote.textContent = statement.sourceNote || "Source: GovInfo Public Papers citation pending.";
  citation.append(sourceNote);

  if (statement.snippet) {
    const details = document.createElement("details");
    details.className = "record-provenance statement-signal";
    const summary = document.createElement("summary");
    summary.textContent = "Text signal";
    const signal = document.createElement("p");
    signal.textContent = statement.snippet;
    details.append(summary, signal);
    citation.append(details);
  }

  return citation;
}

function createStatementLinks(statement) {
  const links = document.createElement("div");
  links.className = "record-links statement-links";

  const seen = new Set();
  for (const [label, url] of [
    ["GovInfo", statement.detailsUrl],
    ["HTML", statement.htmlUrl],
    ["PDF", statement.pdfUrl],
    ["Volume Page", statement.pageLink]
  ]) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const link = document.createElement("a");
    link.href = url;
    link.rel = "noreferrer";
    link.target = "_blank";
    link.textContent = label;
    links.append(link);
  }

  return links;
}

function createStatementRow(statement) {
  const row = document.createElement("article");
  row.className = "statement-row";

  const date = document.createElement("time");
  date.className = "record-date statement-date";
  date.dateTime = statement.documentDate || "";
  date.textContent = shortDate(statement.documentDate);

  const body = document.createElement("div");
  const title = document.createElement("a");
  title.className = "record-title statement-title";
  title.href = statement.htmlUrl || statement.pageLink || statement.pdfUrl || statement.detailsUrl;
  title.rel = "noreferrer";
  title.target = "_blank";
  title.textContent = statement.title;

  const dateLine = document.createElement("p");
  dateLine.className = "record-date-line";
  dateLine.textContent = `${formatDate(statement.documentDate)}; ${statement.bookLabel}`;

  body.append(title, dateLine, createStatementMeta(statement), createStatementSourceNote(statement));
  row.append(date, body, createStatementLinks(statement));
  return row;
}

function updateStatementSummary(statements) {
  if (!statementResultSummary) return;
  const countryCount = new Set(statements.flatMap((statement) => statement.countries || [])).size;
  statementResultSummary.textContent = `${statements.length} statements / ${countryCount} countries`;
}

function renderPublicStatements(statements) {
  if (!publicStatementsRoot) return;
  const sorted = [...statements].sort(byStatementDate);
  publicStatementsRoot.replaceChildren();

  if (!sorted.length) {
    const empty = document.createElement("p");
    empty.className = "empty-chapter";
    empty.textContent = "No public statements match the current reference filters.";
    publicStatementsRoot.append(empty);
    return;
  }

  for (const statement of sorted) {
    publicStatementsRoot.append(createStatementRow(statement));
  }
}

function updatePublicStatements() {
  const statements = filteredPublicStatements(allPublicStatements);
  updateStatementSummary(statements);
  renderPublicStatements(statements);
}

function dailyDiaryDateValue(reference) {
  return reference.date || "";
}

function dailyDiarySearchText(reference) {
  return [
    reference.title,
    reference.date,
    reference.catalogDate,
    reference.sourceType,
    reference.localIdentifier,
    reference.naid,
    reference.accessRestriction,
    reference.relationship,
    reference.reviewReason,
    reference.sourceNote,
    reference.countries,
    reference.matchedTerms,
    reference.linkedRecordTitles
  ]
    .flat()
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function activeDailyDiaryFilters() {
  return {
    query: dailyDiarySearchInput?.value.trim().toLowerCase() || "",
    country: dailyDiaryCountryFilter?.value || "",
    type: dailyDiaryTypeFilter?.value || "",
    relationship: dailyDiaryLinkFilter?.value || ""
  };
}

function dailyDiaryMatches(reference, filters) {
  if (filters.query && !dailyDiarySearchText(reference).includes(filters.query)) return false;
  if (filters.country && !(reference.countries || []).includes(filters.country)) return false;
  if (filters.type && reference.sourceType !== filters.type) return false;
  if (filters.relationship && reference.relationship !== filters.relationship) return false;
  return true;
}

function filteredDailyDiaryReferences(references) {
  const filters = activeDailyDiaryFilters();
  return references.filter((reference) => dailyDiaryMatches(reference, filters));
}

function setDailyDiaryCounts(references) {
  setText("#daily-diary-total", references.length);
  setText("#daily-diary-linked", references.filter((reference) => (reference.linkedRecordIds || []).length).length);
  setText("#daily-diary-countries", new Set(references.flatMap((reference) => reference.countries || [])).size);
}

function populateDailyDiaryFilters(references) {
  const referenceCountries = unique(references.flatMap((reference) => reference.countries || []));
  const orderedCountries = [
    ...CHAPTER_ORDER.filter((country) => referenceCountries.includes(country)),
    ...referenceCountries.filter((country) => !CHAPTER_ORDER.includes(country))
  ];
  populateSelect(dailyDiaryCountryFilter, orderedCountries);
  populateSelect(dailyDiaryTypeFilter, unique(references.map((reference) => reference.sourceType)));
}

function createDailyDiaryMeta(reference) {
  const meta = document.createElement("div");
  meta.className = "record-meta statement-meta daily-diary-meta";

  const terms = (reference.matchedTerms || []).slice(0, 4).join(", ");
  for (const value of [
    reference.sourceType,
    (reference.countries || []).join(", "),
    reference.relationship,
    reference.localIdentifier,
    reference.naid ? `NAID ${reference.naid}` : "",
    terms ? `Terms: ${terms}` : "",
    reference.accessRestriction
  ]) {
    if (!value) continue;
    const item = document.createElement("span");
    item.textContent = value;
    meta.append(item);
  }

  return meta;
}

function createDailyDiarySourceNote(reference) {
  const citation = document.createElement("div");
  citation.className = "record-citation";

  const sourceNote = document.createElement("p");
  sourceNote.className = "record-source-note";
  sourceNote.textContent = reference.sourceNote || "Source: Daily diary/backup provenance pending.";
  citation.append(sourceNote);

  if (reference.reviewReason || (reference.linkedRecordTitles || []).length) {
    const details = document.createElement("details");
    details.className = "record-provenance statement-signal";
    const summary = document.createElement("summary");
    summary.textContent = "Review signal";
    const signal = document.createElement("p");
    const linked = (reference.linkedRecordTitles || []).length
      ? `Linked memcons/telcons: ${reference.linkedRecordTitles.join("; ")}.`
      : "";
    signal.textContent = [reference.reviewReason, linked].filter(Boolean).join(" ");
    details.append(summary, signal);
    citation.append(details);
  }

  return citation;
}

function createDailyDiaryLinks(reference) {
  const links = document.createElement("div");
  links.className = "record-links statement-links daily-diary-links";
  const seen = new Set();
  for (const [label, url] of [
    ["PDF", reference.pdfUrl],
    ["Catalog", reference.catalogUrl]
  ]) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const link = document.createElement("a");
    link.href = url;
    link.rel = "noreferrer";
    link.target = "_blank";
    link.textContent = label;
    links.append(link);
  }
  return links;
}

function createDailyDiaryRow(reference) {
  const row = document.createElement("article");
  row.className = "statement-row daily-diary-row";

  const date = document.createElement("time");
  date.className = "record-date statement-date";
  date.dateTime = reference.date || "";
  date.textContent = shortDate(reference.date);

  const body = document.createElement("div");
  const title = document.createElement("a");
  title.className = "record-title statement-title";
  title.href = reference.pdfUrl || reference.catalogUrl;
  title.rel = "noreferrer";
  title.target = "_blank";
  title.textContent = reference.title;

  const dateLine = document.createElement("p");
  dateLine.className = "record-date-line";
  dateLine.textContent = `${formatDate(reference.date)}; ${reference.relationship}`;

  body.append(title, dateLine, createDailyDiaryMeta(reference), createDailyDiarySourceNote(reference));
  row.append(date, body, createDailyDiaryLinks(reference));
  return row;
}

function updateDailyDiarySummary(references) {
  if (!dailyDiaryResultSummary) return;
  const linkedCount = references.filter((reference) => (reference.linkedRecordIds || []).length).length;
  dailyDiaryResultSummary.textContent = `${references.length} references / ${linkedCount} matched to listed memcons or telcons`;
}

function renderDailyDiaryReferences(references) {
  if (!dailyDiaryRoot) return;
  const sorted = [...references].sort(
    (a, b) =>
      dailyDiaryDateValue(a).localeCompare(dailyDiaryDateValue(b)) ||
      (a.sourceType || "").localeCompare(b.sourceType || "") ||
      (a.title || "").localeCompare(b.title || "")
  );
  dailyDiaryRoot.replaceChildren();

  if (!sorted.length) {
    const empty = document.createElement("p");
    empty.className = "empty-chapter";
    empty.textContent = "No daily diary or backup references match the current filters.";
    dailyDiaryRoot.append(empty);
    return;
  }

  for (const reference of sorted) {
    dailyDiaryRoot.append(createDailyDiaryRow(reference));
  }
}

function updateDailyDiaryReferences() {
  const references = filteredDailyDiaryReferences(allDailyDiaryReferences);
  updateDailyDiarySummary(references);
  renderDailyDiaryReferences(references);
}

function createGapBadge(level) {
  const badge = document.createElement("span");
  badge.className = `gap-risk ${String(level || "Monitor").toLowerCase()}`;
  badge.textContent = level || "Monitor";
  return badge;
}

function createGapMeta(countryGap) {
  const meta = document.createElement("div");
  meta.className = "record-meta gap-meta";

  for (const value of [
    `${countryGap.privateRecordCount} private records`,
    `${countryGap.privatePageCount} private pages`,
    `${countryGap.highPriorityCandidateCount} high-priority leads`,
    `${countryGap.publicStatementCount} public statements`,
    countryGap.partialPrivateRecordCount ? `${countryGap.partialPrivateRecordCount} partial release(s)` : ""
  ]) {
    if (!value) continue;
    const item = document.createElement("span");
    item.textContent = value;
    meta.append(item);
  }

  return meta;
}

function createGapList(label, values) {
  const list = document.createElement("ul");
  list.className = "gap-list";
  const heading = document.createElement("li");
  heading.className = "gap-list-heading";
  heading.textContent = label;
  list.append(heading);
  for (const value of values || []) {
    const item = document.createElement("li");
    item.textContent = value;
    list.append(item);
  }
  return list;
}

function createCountryGapRow(countryGap) {
  const row = document.createElement("article");
  row.className = "gap-row";

  const risk = document.createElement("div");
  risk.className = "gap-score";
  risk.append(createGapBadge(countryGap.riskLevel));
  const score = document.createElement("span");
  score.textContent = `Score ${countryGap.riskScore}`;
  risk.append(score);

  const body = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = countryGap.country;
  body.append(
    title,
    createGapMeta(countryGap),
    createGapList("Risk signals", countryGap.riskSignals),
    createGapList("Actions", countryGap.recommendedActions)
  );

  row.append(risk, body);
  return row;
}

function createStructuralGapRow(gap) {
  const row = document.createElement("article");
  row.className = "gap-row structural-gap-row";

  const risk = document.createElement("div");
  risk.className = "gap-score";
  risk.append(createGapBadge(gap.riskLevel));

  const body = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = gap.title;
  const evidence = document.createElement("p");
  evidence.className = "record-detail-line";
  evidence.textContent = gap.evidence;
  const action = createDetailLine("Action", gap.recommendedAction);
  body.append(title, evidence, ...(action ? [action] : []));
  row.append(risk, body);
  return row;
}

function renderCompilerGaps(audit) {
  if (!compilerGapsRoot) return;
  compilerGapsRoot.replaceChildren();

  const countryHeading = document.createElement("div");
  countryHeading.className = "record-chapter-header gap-heading";
  const countryTitle = document.createElement("h3");
  countryTitle.textContent = "Country Risk Ranking";
  const countryCount = document.createElement("p");
  countryCount.className = "record-count";
  countryCount.textContent = `${audit.countryRisks?.length || 0} countries`;
  countryHeading.append(countryTitle, countryCount);
  compilerGapsRoot.append(countryHeading);

  for (const countryGap of audit.countryRisks || []) {
    compilerGapsRoot.append(createCountryGapRow(countryGap));
  }

  const structuralHeading = document.createElement("div");
  structuralHeading.className = "record-chapter-header gap-heading structural-heading";
  const structuralTitle = document.createElement("h3");
  structuralTitle.textContent = "Structural Gaps";
  const structuralCount = document.createElement("p");
  structuralCount.className = "record-count";
  structuralCount.textContent = `${audit.structuralGaps?.length || 0} gaps`;
  structuralHeading.append(structuralTitle, structuralCount);
  compilerGapsRoot.append(structuralHeading);

  for (const gap of audit.structuralGaps || []) {
    compilerGapsRoot.append(createStructuralGapRow(gap));
  }
}

function searchText(record) {
  return [
    record.title,
    record.documentTitle,
    record.subjectLine,
    record.dateLine,
    record.date,
    record.type,
    record.releaseStatus,
    record.naid,
    record.localIdentifier,
    record.sourceTitle,
    record.sourceNote,
    record.provenanceNote,
    record.notes,
    record.participants,
    record.countries,
    record.topics,
    record.frusTopics,
    record.dailyDiaryReferences?.map((reference) => [
      reference.title,
      reference.type,
      reference.naid,
      reference.localIdentifier,
      reference.sourceNote
    ]),
    record.source?.name,
    record.source?.series,
    record.source?.fileUnitTitle,
    record.source?.dailyDiarySeries?.name,
    record.source?.dailyDiarySeries?.naid,
    record.source?.priorityCollection?.name,
    record.source?.priorityCollection?.naid,
    record.source?.sourcePages
  ]
    .flat()
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function activeFilters() {
  return {
    query: searchInput?.value.trim().toLowerCase() || "",
    country: countryFilter?.value || "",
    type: typeFilter?.value || "",
    source: sourceFilter?.value || "",
    release: releaseFilter?.value || ""
  };
}

function hasActiveFilters(filters) {
  return Object.values(filters).some(Boolean);
}

function recordMatches(record, filters) {
  if (filters.query && !searchText(record).includes(filters.query)) return false;
  if (filters.country && record.chapter?.name !== filters.country) return false;
  if (filters.type && record.type !== filters.type) return false;
  if (filters.source && sourceBucket(record) !== filters.source) return false;
  if (filters.release && record.releaseStatus !== filters.release) return false;
  return true;
}

function filteredRecords(records) {
  const filters = activeFilters();
  return {
    filters,
    records: records.filter((record) => recordMatches(record, filters))
  };
}

function updateResultSummary(records) {
  if (!resultSummary) return;
  const pageTotal = records.reduce((sum, record) => sum + (record.pageCount || 0), 0);
  resultSummary.textContent = `${records.length} records / ${pageTotal} pages`;
}

function renderRecords(records, options = {}) {
  const sorted = [...records].sort(byChapterThenDate);
  recordsRoot.replaceChildren();

  if (!sorted.length) {
    const empty = document.createElement("p");
    empty.className = "empty-chapter";
    empty.textContent = "No records match the current compiler filters.";
    recordsRoot.append(empty);
    return;
  }

  const visibleChapters = options.filtered
    ? CHAPTER_ORDER.filter((chapterName) => sorted.some((record) => record.chapter.name === chapterName))
    : CHAPTER_ORDER;

  for (const chapterName of visibleChapters) {
    const chapterRecords = sorted.filter((record) => record.chapter.name === chapterName);
    const section = document.createElement("section");
    section.className = "record-chapter";
    section.id = chapterId(chapterName);

    const header = document.createElement("div");
    header.className = "record-chapter-header";

    const heading = document.createElement("h3");
    heading.textContent = `Chapter ${CHAPTER_ORDER.indexOf(chapterName) + 1}: ${chapterName}`;

    const count = document.createElement("p");
    count.className = "record-count";
    const pageTotal = chapterRecords.reduce((sum, record) => sum + (record.pageCount || 0), 0);
    count.textContent = `${chapterRecords.length} records / ${pageTotal} pages`;
    header.append(heading, count);

    const list = document.createElement("div");
    list.className = "record-list";
    if (chapterRecords.length) {
      for (const record of chapterRecords) {
        list.append(createRecordRow(record));
      }
    } else {
      const empty = document.createElement("p");
      empty.className = "empty-chapter";
      empty.textContent =
        "No released memcons or telcons for this country have been identified in the public record set yet.";
      list.append(empty);
    }

    section.append(header, list);
    recordsRoot.append(section);
  }
}

function updateRecords() {
  const { filters, records } = filteredRecords(allRecords);
  updateResultSummary(records);
  renderRecords(records, { filtered: hasActiveFilters(filters) });
}

function updateCandidateSummary(candidates) {
  if (!candidateResultSummary) return;
  const highCount = candidates.filter((candidate) => candidate.priority === "High").length;
  const folderCount = new Set(candidates.map((candidate) => candidate.folderNaid)).size;
  candidateResultSummary.textContent = `${candidates.length} candidates / ${highCount} high priority / ${folderCount} folders`;
}

function renderPrintCandidates(candidates) {
  if (!printCandidatesRoot) return;
  const sorted = [...candidates].sort(byCandidateUtility);
  printCandidatesRoot.replaceChildren();

  if (!sorted.length) {
    const empty = document.createElement("p");
    empty.className = "empty-chapter";
    empty.textContent = "No subject-file candidates match the current compiler filters.";
    printCandidatesRoot.append(empty);
    return;
  }

  for (const candidate of sorted) {
    printCandidatesRoot.append(createCandidateRow(candidate));
  }
}

function updatePrintCandidates() {
  const candidates = filteredPrintCandidates(allPrintCandidates);
  updateCandidateSummary(candidates);
  renderPrintCandidates(candidates);
}

function enableRecordFilters() {
  for (const control of [searchInput, countryFilter, typeFilter, sourceFilter, releaseFilter]) {
    control?.addEventListener("input", updateRecords);
    control?.addEventListener("change", updateRecords);
  }

  clearFilters?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    if (countryFilter) countryFilter.value = "";
    if (typeFilter) typeFilter.value = "";
    if (sourceFilter) sourceFilter.value = "";
    if (releaseFilter) releaseFilter.value = "";
    updateRecords();
    searchInput?.focus();
  });
}

function enableCandidateFilters() {
  for (const control of [
    candidateSearchInput,
    candidateCountryFilter,
    candidatePriorityFilter,
    candidateSourceFilter,
    candidateTypeFilter
  ]) {
    control?.addEventListener("input", updatePrintCandidates);
    control?.addEventListener("change", updatePrintCandidates);
  }

  clearCandidateFilters?.addEventListener("click", () => {
    if (candidateSearchInput) candidateSearchInput.value = "";
    if (candidateCountryFilter) candidateCountryFilter.value = "";
    if (candidatePriorityFilter) candidatePriorityFilter.value = "High";
    if (candidateSourceFilter) candidateSourceFilter.value = "";
    if (candidateTypeFilter) candidateTypeFilter.value = "";
    updatePrintCandidates();
    candidateSearchInput?.focus();
  });
}

function enableStatementFilters() {
  for (const control of [
    statementSearchInput,
    statementCountryFilter,
    statementTypeFilter,
    statementYearFilter,
    statementBookFilter
  ]) {
    control?.addEventListener("input", updatePublicStatements);
    control?.addEventListener("change", updatePublicStatements);
  }

  clearStatementFilters?.addEventListener("click", () => {
    if (statementSearchInput) statementSearchInput.value = "";
    if (statementCountryFilter) statementCountryFilter.value = "";
    if (statementTypeFilter) statementTypeFilter.value = "";
    if (statementYearFilter) statementYearFilter.value = "";
    if (statementBookFilter) statementBookFilter.value = "";
    updatePublicStatements();
    statementSearchInput?.focus();
  });
}

function enableDailyDiaryFilters() {
  for (const control of [
    dailyDiarySearchInput,
    dailyDiaryCountryFilter,
    dailyDiaryTypeFilter,
    dailyDiaryLinkFilter
  ]) {
    control?.addEventListener("input", updateDailyDiaryReferences);
    control?.addEventListener("change", updateDailyDiaryReferences);
  }

  clearDailyDiaryFilters?.addEventListener("click", () => {
    if (dailyDiarySearchInput) dailyDiarySearchInput.value = "";
    if (dailyDiaryCountryFilter) dailyDiaryCountryFilter.value = "";
    if (dailyDiaryTypeFilter) dailyDiaryTypeFilter.value = "";
    if (dailyDiaryLinkFilter) dailyDiaryLinkFilter.value = "";
    updateDailyDiaryReferences();
    dailyDiarySearchInput?.focus();
  });
}

function enableChapterCards() {
  for (const card of document.querySelectorAll(".chapter-card")) {
    card.addEventListener("click", (event) => {
      const targetId = card.getAttribute("href");
      if (!targetId?.startsWith("#")) return;

      const target = document.querySelector(targetId);
      if (!target) return;

      event.preventDefault();
      history.pushState(null, "", targetId);
      target.scrollIntoView({ block: "start" });
    });
  }
}

async function init() {
  try {
    const records = window.MEMCONS || window.MEMCON_RECORDS || (await loadRecords());
    allRecords = records;
    setChapterCounts(records);
    setProvenanceCounts(records);
    populateFilters(records);
    enableRecordFilters();
    updateRecords();
    enableChapterCards();
    if (window.location.hash) {
      const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      target?.scrollIntoView();
    }
  } catch (error) {
    recordsRoot.innerHTML =
      '<p class="error">The memcon records could not be loaded. Try opening this site through a local server or GitHub Pages.</p>';
  }

  await initPrintCandidates();
  await initPublicStatements();
  await initDailyDiaryReferences();
  await initCompilerGaps();
}

async function loadRecords() {
  const response = await fetch("data/memcons.json");
  if (!response.ok) throw new Error(`Could not load records: ${response.status}`);
  return response.json();
}

async function initPrintCandidates() {
  if (!printCandidatesRoot) return;
  try {
    const chronological = window.CHRONOLOGICAL_PRINT_CANDIDATES || (await loadPrintCandidates("data/chronological-print-candidates.json"));
    const subject = window.SUBJECT_PRINT_CANDIDATES || (await loadPrintCandidates("data/subject-print-candidates.json"));
    const deal = window.DEAL_PRINT_CANDIDATES || (await loadPrintCandidates("data/deal-print-candidates.json"));
    const candidates = [...chronological, ...subject, ...deal];
    allPrintCandidates = candidates;
    setPrintCandidateCounts(candidates);
    populateCandidateFilters(candidates);
    enableCandidateFilters();
    updatePrintCandidates();
  } catch (error) {
    printCandidatesRoot.innerHTML =
      '<p class="error">The subject-file print candidates could not be loaded. Try opening this site through a local server or GitHub Pages.</p>';
  }
}

async function loadPrintCandidates(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load print candidates: ${response.status}`);
  return response.json();
}

async function initPublicStatements() {
  if (!publicStatementsRoot) return;
  try {
    const statements = window.PUBLIC_STATEMENTS || (await loadPublicStatements());
    allPublicStatements = statements;
    setPublicStatementCounts(statements);
    populateStatementFilters(statements);
    enableStatementFilters();
    updatePublicStatements();
  } catch (error) {
    publicStatementsRoot.innerHTML =
      '<p class="error">The public statements reference list could not be loaded. Try opening this site through a local server or GitHub Pages.</p>';
  }
}

async function loadPublicStatements() {
  const response = await fetch("data/public-statements.json");
  if (!response.ok) throw new Error(`Could not load public statements: ${response.status}`);
  return response.json();
}

async function initDailyDiaryReferences() {
  if (!dailyDiaryRoot) return;
  try {
    const references = window.DAILY_DIARY_REFERENCES || (await loadDailyDiaryReferences());
    allDailyDiaryReferences = references;
    setDailyDiaryCounts(references);
    populateDailyDiaryFilters(references);
    enableDailyDiaryFilters();
    updateDailyDiaryReferences();
  } catch (error) {
    dailyDiaryRoot.innerHTML =
      '<p class="error">The daily diary and backup references could not be loaded. Try opening this site through a local server or GitHub Pages.</p>';
  }
}

async function loadDailyDiaryReferences() {
  const response = await fetch("data/daily-diary-references.json");
  if (!response.ok) throw new Error(`Could not load daily diary references: ${response.status}`);
  return response.json();
}

async function initCompilerGaps() {
  if (!compilerGapsRoot) return;
  try {
    const audit = window.COMPILER_GAPS || (await loadCompilerGaps());
    setCompilerGapCounts(audit);
    renderCompilerGaps(audit);
  } catch (error) {
    compilerGapsRoot.innerHTML =
      '<p class="error">The compiler gap audit could not be loaded. Try opening this site through a local server or GitHub Pages.</p>';
  }
}

async function loadCompilerGaps() {
  const response = await fetch("data/compiler-gaps.json");
  if (!response.ok) throw new Error(`Could not load compiler gaps: ${response.status}`);
  return response.json();
}

init();
