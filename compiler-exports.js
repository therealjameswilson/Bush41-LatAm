const EXPORT_CHAPTER_ORDER = [
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

const exportObjectUrls = [];

function csvCell(value) {
  if (Array.isArray(value)) return csvCell(value.filter(Boolean).join("; "));
  if (value === null || value === undefined) return "";
  const text = String(value).replace(/\s+/g, " ").trim();
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvFromRows(rows) {
  const headers = Object.keys(rows[0] || {});
  return [
    headers.map(csvCell).join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))
  ].join("\n") + "\n";
}

function exportCountries(record) {
  return (record.countries || []).filter((country) => country !== "United States");
}

function exportChapterNumber(record) {
  return record.chapter?.number || EXPORT_CHAPTER_ORDER.indexOf(record.chapter?.name) + 1 || 999;
}

function exportSourceLabel(record) {
  if (record.source?.name === "Brent Scowcroft Papers") return "Scowcroft extract";
  return record.source?.series || record.source?.name || "";
}

function exportCandidateSource(candidate) {
  if (candidate.sourceSeries?.name) return candidate.sourceSeries.name;
  if (/^chronological-print-/.test(candidate.id || "")) return "Latin American Directorate Chronological Files";
  return "Latin American Affairs Directorate Subject Files";
}

function chronologyExportRows() {
  return [...(window.MEMCONS || [])]
    .sort(
      (a, b) =>
        exportChapterNumber(a) - exportChapterNumber(b) ||
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
      source_bucket: exportSourceLabel(record),
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

function printCandidateExportRows() {
  const priority = { High: 0, Medium: 1, Reference: 2 };
  return [
    ...(window.CHRONOLOGICAL_PRINT_CANDIDATES || []),
    ...(window.SUBJECT_PRINT_CANDIDATES || []),
    ...(window.DEAL_PRINT_CANDIDATES || [])
  ]
    .sort(
      (a, b) =>
        (priority[a.priority] ?? 9) - (priority[b.priority] ?? 9) ||
        (b.score || 0) - (a.score || 0) ||
        (a.documentDate || "").localeCompare(b.documentDate || "") ||
        (a.documentTitle || "").localeCompare(b.documentTitle || "")
    )
    .map((candidate) => ({
      priority: candidate.priority || "",
      score: candidate.score || "",
      countries: exportCountries(candidate),
      document_date: candidate.documentDate || "",
      document_type: candidate.documentType || "",
      document_no: candidate.documentNo || "",
      document_title: candidate.documentTitle || "",
      source_series: exportCandidateSource(candidate),
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

function dailyDiaryExportRows() {
  return [...(window.DAILY_DIARY_REFERENCES || [])]
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

function publicStatementExportRows() {
  return [...(window.PUBLIC_STATEMENTS || [])]
    .sort(
      (a, b) =>
        (a.sortDate || a.documentDate || "").localeCompare(b.sortDate || b.documentDate || "") ||
        (a.title || "").localeCompare(b.title || "")
    )
    .map((statement) => ({
      date: statement.documentDate || statement.sortDate || "",
      title: statement.title || "",
      document_type: statement.documentType || "",
      countries: exportCountries(statement),
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

function attachExport(selector, filename, rows) {
  const link = document.querySelector(selector);
  if (!link) return;
  const href = URL.createObjectURL(new Blob([csvFromRows(rows)], { type: "text/csv;charset=utf-8" }));
  exportObjectUrls.push(href);
  link.href = href;
  link.download = filename;
}

function attachCompilerExports() {
  for (const href of exportObjectUrls) URL.revokeObjectURL(href);
  exportObjectUrls.length = 0;
  attachExport('[data-export="chronology"]', "compiler-chronology.csv", chronologyExportRows());
  attachExport('[data-export="printCandidates"]', "print-candidates.csv", printCandidateExportRows());
  attachExport('[data-export="dailyDiary"]', "daily-diary-references.csv", dailyDiaryExportRows());
  attachExport('[data-export="publicStatements"]', "public-statements.csv", publicStatementExportRows());
}

attachCompilerExports();
