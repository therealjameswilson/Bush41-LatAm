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
const candidateTypeFilter = document.querySelector("#candidate-type-filter");
const clearCandidateFilters = document.querySelector("#clear-candidate-filters");
const candidateResultSummary = document.querySelector("#candidate-result-summary");
let allRecords = [];
let allPrintCandidates = [];

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
  if (/full/i.test(status)) return "Full release.";
  if (/partial/i.test(status)) return `Partial release: ${status}.`;
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
    duplicates: records.filter((record) => (record.source?.duplicateSources || []).length > 0).length
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
  populateSelect(candidateTypeFilter, unique(candidates.map((candidate) => candidate.documentType)));
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

function createSourceNote(record) {
  const citation = document.createElement("div");
  citation.className = "record-citation";

  const sourceNote = document.createElement("p");
  sourceNote.className = "record-source-note";
  sourceNote.textContent = frusSourceNote(record);
  citation.append(sourceNote);

  if (record.sourceNote && record.sourceNote !== sourceNote.textContent) {
    const details = document.createElement("details");
    details.className = "record-provenance";
    const summary = document.createElement("summary");
    summary.textContent = "Full provenance trail";
    const raw = document.createElement("p");
    raw.textContent = record.sourceNote;
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
    type: candidateTypeFilter?.value || ""
  };
}

function candidateMatches(candidate, filters) {
  if (filters.query && !candidateSearchText(candidate).includes(filters.query)) return false;
  if (filters.country && !(candidate.countries || []).includes(filters.country)) return false;
  if (filters.priority && candidate.priority !== filters.priority) return false;
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
    record.notes,
    record.participants,
    record.countries,
    record.topics,
    record.frusTopics,
    record.source?.name,
    record.source?.series,
    record.source?.fileUnitTitle,
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
  for (const control of [candidateSearchInput, candidateCountryFilter, candidatePriorityFilter, candidateTypeFilter]) {
    control?.addEventListener("input", updatePrintCandidates);
    control?.addEventListener("change", updatePrintCandidates);
  }

  clearCandidateFilters?.addEventListener("click", () => {
    if (candidateSearchInput) candidateSearchInput.value = "";
    if (candidateCountryFilter) candidateCountryFilter.value = "";
    if (candidatePriorityFilter) candidatePriorityFilter.value = "High";
    if (candidateTypeFilter) candidateTypeFilter.value = "";
    updatePrintCandidates();
    candidateSearchInput?.focus();
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
}

async function loadRecords() {
  const response = await fetch("data/memcons.json");
  if (!response.ok) throw new Error(`Could not load records: ${response.status}`);
  return response.json();
}

async function initPrintCandidates() {
  if (!printCandidatesRoot) return;
  try {
    const candidates = window.SUBJECT_PRINT_CANDIDATES || (await loadPrintCandidates());
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

async function loadPrintCandidates() {
  const response = await fetch("data/subject-print-candidates.json");
  if (!response.ok) throw new Error(`Could not load subject-file candidates: ${response.status}`);
  return response.json();
}

init();
