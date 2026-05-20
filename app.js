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
let allRecords = [];

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

function cleanFileTitle(title) {
  return (title || "")
    .replace(/;\s*source pages\s+\S+$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sentence(value) {
  if (!value) return "";
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function sourceIdentifiers(record) {
  const source = record.source || {};
  const parts = [];
  if (source.fileUnitNaid) parts.push(`file unit NAID ${source.fileUnitNaid}`);
  if (record.naid) parts.push(`item NAID ${record.naid}`);
  if (source.objectFilename) parts.push(`digital object ${source.objectFilename}`);
  return parts.join("; ");
}

function duplicateSourceLine(record) {
  const duplicates = record.source?.duplicateSources || [];
  if (!duplicates.length) return "";
  const citations = duplicates.map((source) => {
    const parts = [
      source.sourceName,
      source.series,
      source.localIdentifier,
      source.naid ? `NAID ${source.naid}` : "",
      source.sourcePages ? `source pages ${source.sourcePages}` : ""
    ].filter(Boolean);
    return parts.join(", ");
  });
  return `Related copy retained as provenance: ${citations.join("; ")}.`;
}

function frusSourceNote(record) {
  const source = record.source || {};
  const release = record.releaseStatus ? `Release status: ${record.releaseStatus}.` : "";

  if (source.name === "Brent Scowcroft Papers") {
    const title = cleanFileTitle(record.sourceTitle || source.objectFilename);
    return [
      "Source: George H.W. Bush Library, Bush Presidential Records, Brent Scowcroft Papers, Presidential Correspondence Files",
      title,
      record.localIdentifier,
      record.naid ? `NAID ${record.naid}` : "",
      source.sourcePages ? `source pages ${source.sourcePages}` : ""
    ]
      .filter(Boolean)
      .join(", ")
      .concat(". ", release, " Local PDF extract prepared from the public catalog scan.");
  }

  if (source.name === "Records of the National Security Council (George H. W. Bush Administration)") {
    const sourcePath = [
      "Source: George H.W. Bush Library",
      "Bush Presidential Records",
      "National Security Council",
      source.series || "Presidential Memcon/Telcon Files",
      source.fileUnitTitle
    ]
      .filter(Boolean)
      .join(", ");
    const identifiers = sourceIdentifiers(record);
    return [
      identifiers ? `${sourcePath}, ${identifiers}.` : `${sourcePath}.`,
      release,
      duplicateSourceLine(record)
    ]
      .filter(Boolean)
      .join(" ");
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
    summary.textContent = "Catalog provenance details";
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
}

async function loadRecords() {
  const response = await fetch("data/memcons.json");
  if (!response.ok) throw new Error(`Could not load records: ${response.status}`);
  return response.json();
}

init();
