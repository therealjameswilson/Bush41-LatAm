const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "data");
const REPORT = path.join(ROOT, "reports", "compiler-exports-build.json");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function csvCell(value) {
  if (Array.isArray(value)) return csvCell(value.filter(Boolean).join("; "));
  if (value === null || value === undefined) return "";
  const text = String(value).replace(/\s+/g, " ").trim();
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(filename, rows) {
  const headers = Object.keys(rows[0] || {});
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvCell(row[header])).join(","));
  }
  const filePath = path.join(OUT, filename);
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`);
  return { filename, rows: rows.length, columns: headers.length };
}

function countryList(record) {
  return (record.countries || []).filter((country) => country !== "United States");
}

function sourceName(candidate) {
  if (candidate.sourceSeries?.name) return candidate.sourceSeries.name;
  if (/^chronological-print-/.test(candidate.id || "")) return "Latin American Directorate Chronological Files";
  return "Latin American Affairs Directorate Subject Files";
}

function sourceShort(record) {
  if (record.source?.name === "Brent Scowcroft Papers") return "Scowcroft extract";
  return record.source?.series || record.source?.name || "";
}

function chronologyRows(records) {
  return [...records]
    .sort(
      (a, b) =>
        (a.chapter?.number || 999) - (b.chapter?.number || 999) ||
        (a.sortDate || a.date || "").localeCompare(b.sortDate || b.date || "") ||
        (a.documentTitle || a.title || "").localeCompare(b.documentTitle || b.title || "")
    )
    .map((record) => ({
      chapter_number: record.chapter?.number || "",
      chapter_country: record.chapter?.name || "",
      date: record.date || "",
      date_line: record.dateLine || "",
      document_type: record.type || "",
      document_title: record.documentTitle || record.title || "",
      subject_line: record.subjectLine || "",
      participants: record.participants || [],
      page_count: record.pageCount || 0,
      release_status: record.releaseStatus || "",
      source_bucket: sourceShort(record),
      local_identifier: record.localIdentifier || "",
      naid: record.naid || "",
      source_title: record.sourceTitle || "",
      source_note: record.sourceNote || "",
      provenance_note: record.provenanceNote || "",
      frus_topics: record.frusTopics || record.topics || [],
      pdf_url: record.pdfUrl || "",
      catalog_url: record.catalogUrl || "",
      daily_diary_backup_titles: (record.dailyDiaryReferences || []).map((reference) => reference.title),
      daily_diary_backup_pdfs: (record.dailyDiaryReferences || []).map((reference) => reference.pdfUrl),
      daily_diary_backup_catalog_urls: (record.dailyDiaryReferences || []).map((reference) => reference.catalogUrl)
    }));
}

function printCandidateRows(candidates) {
  return [...candidates]
    .sort(
      (a, b) =>
        ({ High: 0, Medium: 1, Reference: 2 }[a.priority] ?? 9) -
          ({ High: 0, Medium: 1, Reference: 2 }[b.priority] ?? 9) ||
        (b.score || 0) - (a.score || 0) ||
        (a.documentDate || "").localeCompare(b.documentDate || "") ||
        (a.documentTitle || "").localeCompare(b.documentTitle || "")
    )
    .map((candidate) => ({
      priority: candidate.priority || "",
      score: candidate.score || "",
      countries: countryList(candidate),
      document_date: candidate.documentDate || "",
      document_type: candidate.documentType || "",
      document_no: candidate.documentNo || "",
      document_title: candidate.documentTitle || "",
      source_series: sourceName(candidate),
      local_identifier: candidate.localIdentifier || "",
      folder_title: candidate.folderTitle || "",
      folder_naid: candidate.folderNaid || "",
      page_start: candidate.pageStart || "",
      page_end: candidate.pageEnd || "",
      extraction: candidate.extraction || "",
      themes: candidate.themes || [],
      review_reason: candidate.reviewReason || "",
      ocr_snippet: candidate.ocrSnippet || "",
      access_restriction: candidate.accessRestriction || "",
      source_note: candidate.sourceNote || "",
      page_link: candidate.pageLink || "",
      pdf_url: candidate.pdfUrl || "",
      catalog_url: candidate.catalogUrl || ""
    }));
}

function diaryReferenceRows(references) {
  return [...references]
    .sort(
      (a, b) =>
        (a.date || "").localeCompare(b.date || "") ||
        (a.sourceType || "").localeCompare(b.sourceType || "") ||
        (a.title || "").localeCompare(b.title || "")
    )
    .map((reference) => ({
      date: reference.date || "",
      catalog_date: reference.catalogDate || "",
      source_type: reference.sourceType || "",
      title: reference.title || "",
      countries: reference.countries || [],
      relationship: reference.relationship || "",
      matched_terms: reference.matchedTerms || [],
      linked_memcon_telcon_titles: reference.linkedRecordTitles || [],
      local_identifier: reference.localIdentifier || "",
      naid: reference.naid || "",
      empty_folder: reference.empty ? "yes" : "no",
      access_restriction: reference.accessRestriction || "",
      source_note: reference.sourceNote || "",
      pdf_url: reference.pdfUrl || "",
      catalog_url: reference.catalogUrl || ""
    }));
}

function publicStatementRows(statements) {
  return [...statements]
    .sort(
      (a, b) =>
        (a.sortDate || a.documentDate || "").localeCompare(b.sortDate || b.documentDate || "") ||
        (a.title || "").localeCompare(b.title || "")
    )
    .map((statement) => ({
      date: statement.documentDate || statement.sortDate || "",
      title: statement.title || "",
      document_type: statement.documentType || "",
      countries: countryList(statement),
      book_label: statement.bookLabel || "",
      package_id: statement.packageId || "",
      granule_id: statement.granuleId || "",
      page_start: statement.pageStart || "",
      page_end: statement.pageEnd || "",
      extraction: statement.extraction || "",
      snippet: statement.snippet || "",
      source_note: statement.sourceNote || "",
      html_url: statement.htmlUrl || "",
      pdf_url: statement.pdfUrl || "",
      details_url: statement.detailsUrl || "",
      page_link: statement.pageLink || ""
    }));
}

function main() {
  const memcons = readJson("data/memcons.json");
  const printCandidates = [
    ...readJson("data/chronological-print-candidates.json"),
    ...readJson("data/subject-print-candidates.json"),
    ...readJson("data/deal-print-candidates.json")
  ];
  const dailyDiaryReferences = readJson("data/daily-diary-references.json");
  const publicStatements = readJson("data/public-statements.json");

  const exports = [
    writeCsv("compiler-chronology.csv", chronologyRows(memcons)),
    writeCsv("print-candidates.csv", printCandidateRows(printCandidates)),
    writeCsv("daily-diary-references.csv", diaryReferenceRows(dailyDiaryReferences)),
    writeCsv("public-statements.csv", publicStatementRows(publicStatements))
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    exports
  };
  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main();
