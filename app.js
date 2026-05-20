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
  const date = new Date(`${dateString}T00:00:00Z`);
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

function createSourceNote(record) {
  const sourceNote = document.createElement("p");
  sourceNote.className = "record-source-note";
  sourceNote.textContent = record.sourceNote || "Source: Provenance pending.";
  return sourceNote;
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
  body.append(title, createDateLine(record), createSubject(record), createMeta(record), createSourceNote(record));

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

function renderRecords(records) {
  const sorted = [...records].sort(byChapterThenDate);
  recordsRoot.replaceChildren();

  for (const chapterName of CHAPTER_ORDER) {
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
    setChapterCounts(records);
    setProvenanceCounts(records);
    renderRecords(records);
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
