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
const totalPages = document.querySelector("#total-pages");
const nscTotalRecords = document.querySelector("#nsc-total-records");
const nscPdfRecords = document.querySelector("#nsc-pdf-records");
const nscRoot = document.querySelector("#nsc-root");

function chapterId(chapterName) {
  return `chapter-${chapterName.toLowerCase().replaceAll(" ", "-")}`;
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`);
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
    a.chapter.number - b.chapter.number ||
    a.sortDate.localeCompare(b.sortDate) ||
    a.title.localeCompare(b.title)
  );
}

function setChapterCounts(records) {
  totalRecords.textContent = records.length.toString();
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

function createMeta(record) {
  const meta = document.createElement("div");
  meta.className = "record-meta";

  for (const value of [
    record.countries.filter((country) => country !== "United States").join(", "),
    record.pageCount ? `${record.pageCount} pages` : "Pages pending",
    record.naid?.startsWith("local-") ? "Local PDF" : `NAID ${record.naid}`,
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
  date.dateTime = record.date;
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

function createNscRow(record) {
  const row = document.createElement("article");
  row.className = "record-row";

  const date = document.createElement("time");
  date.className = "record-date";
  date.dateTime = record.startDate || "";
  date.textContent = record.startDate ? shortDate(record.startDate) : "Undated";

  const body = document.createElement("div");
  const title = document.createElement("a");
  title.className = "record-title";
  title.href = record.catalogUrl || record.pdfUrl;
  title.rel = "noreferrer";
  title.textContent = record.title;

  const dateLine = document.createElement("p");
  dateLine.className = "record-date-line";
  dateLine.textContent = [record.startDate, record.endDate].filter(Boolean).join(" to ") || "Date pending";

  const subject = document.createElement("p");
  subject.className = "record-subject";
  subject.textContent = record.series?.title || record.levelOfDescription;

  const meta = document.createElement("div");
  meta.className = "record-meta";
  for (const value of [
    record.countries?.length ? record.countries.join(", ") : "Regional / multi-country",
    record.levelOfDescription,
    record.localIdentifier,
    `NAID ${record.naid}`,
    record.accessRestriction
  ]) {
    if (!value) continue;
    const item = document.createElement("span");
    item.textContent = value;
    meta.append(item);
  }

  body.append(title, dateLine, subject, meta);

  const links = document.createElement("div");
  links.className = "record-links";

  if (record.catalogUrl) {
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
    for (const record of chapterRecords) {
      list.append(createRecordRow(record));
    }

    section.append(header, list);
    recordsRoot.append(section);
  }
}

function renderNscCollection(records) {
  if (!nscRoot) return;

  const groups = new Map();
  for (const record of records) {
    const groupName = record.countries?.[0] || "Regional / Multi-country";
    if (!groups.has(groupName)) groups.set(groupName, []);
    groups.get(groupName).push(record);
  }

  const groupOrder = [...CHAPTER_ORDER, "Regional / Multi-country"];
  nscRoot.replaceChildren();

  for (const groupName of groupOrder) {
    const groupRecords = groups.get(groupName) || [];
    if (!groupRecords.length) continue;

    groupRecords.sort((a, b) => {
      return (a.startDate || "").localeCompare(b.startDate || "") || a.title.localeCompare(b.title);
    });

    const section = document.createElement("section");
    section.className = "record-chapter";

    const header = document.createElement("div");
    header.className = "record-chapter-header";

    const heading = document.createElement("h3");
    heading.textContent = groupName;

    const count = document.createElement("p");
    count.className = "record-count";
    count.textContent = `${groupRecords.length} records`;
    header.append(heading, count);

    const list = document.createElement("div");
    list.className = "record-list";
    for (const record of groupRecords) {
      list.append(createNscRow(record));
    }

    section.append(header, list);
    nscRoot.append(section);
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
    const nscRecords = window.NSC_SOUTH_AMERICA || [];
    setChapterCounts(records);
    renderRecords(records);
    if (nscTotalRecords) nscTotalRecords.textContent = nscRecords.length.toString();
    if (nscPdfRecords) {
      nscPdfRecords.textContent = nscRecords.filter((record) => record.pdfUrl).length.toString();
    }
    renderNscCollection(nscRecords);
    enableChapterCards();
    if (window.location.hash) {
      document.querySelector(window.location.hash)?.scrollIntoView();
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
