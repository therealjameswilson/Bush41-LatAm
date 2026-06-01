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

function riskRank(level) {
  return { Critical: 0, High: 1, Medium: 2, Monitor: 3, Reference: 4 }[level] ?? 9;
}

function riskByCountry() {
  return new Map((window.COMPILER_GAPS?.countryRisks || []).map((risk) => [risk.country, risk]));
}

function bestCountryRisk(countries, riskMap) {
  return (countries || [])
    .map((country) => riskMap.get(country))
    .filter(Boolean)
    .sort((a, b) => riskRank(a.riskLevel) - riskRank(b.riskLevel) || (b.riskScore || 0) - (a.riskScore || 0))[0];
}

function countBy(values) {
  return values.filter(Boolean).reduce((counts, value) => {
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function countSummary(values) {
  return Object.entries(countBy(values))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => `${value}: ${count}`);
}

function sortedUnique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function recordDateValue(record) {
  return record.sortDate || record.date || "";
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

function countryDossierExportRows() {
  const memcons = window.MEMCONS || [];
  const printCandidates = [
    ...(window.CHRONOLOGICAL_PRINT_CANDIDATES || []),
    ...(window.SUBJECT_PRINT_CANDIDATES || []),
    ...(window.DEAL_PRINT_CANDIDATES || [])
  ];
  const publicStatements = window.PUBLIC_STATEMENTS || [];
  const diaryReferences = window.DAILY_DIARY_REFERENCES || [];
  const riskMap = riskByCountry();
  const targetYears = ["1989", "1990", "1991", "1992"];

  return EXPORT_CHAPTER_ORDER.map((country, index) => {
    const countryRecords = memcons.filter((record) => (record.countries || []).includes(country));
    const countryPrint = printCandidates.filter((candidate) => (candidate.countries || []).includes(country));
    const highPrint = countryPrint.filter((candidate) => candidate.priority === "High");
    const countryStatements = publicStatements.filter((statement) => (statement.countries || []).includes(country));
    const countryDiary = diaryReferences.filter((reference) => (reference.countries || []).includes(country));
    const linkedDiary = countryDiary.filter((reference) => (reference.linkedRecordIds || []).length);
    const risk = riskMap.get(country);
    const sortedRecords = [...countryRecords].sort((a, b) => recordDateValue(a).localeCompare(recordDateValue(b)));
    const yearsCovered = sortedUnique(countryRecords.map((record) => (record.date || "").slice(0, 4)));
    const missingYears = targetYears.filter((year) => !yearsCovered.includes(year));

    return {
      chapter_number: index + 1,
      country,
      risk_level: risk?.riskLevel || "Monitor",
      risk_score: risk?.riskScore || "",
      private_record_count: countryRecords.length,
      private_page_count: countryRecords.reduce((total, record) => total + (record.pageCount || 0), 0),
      private_date_span: sortedRecords.length
        ? `${recordDateValue(sortedRecords[0])} to ${recordDateValue(sortedRecords[sortedRecords.length - 1])}`
        : "",
      private_years_covered: yearsCovered,
      private_years_missing: missingYears,
      partial_private_records: countryRecords.filter((record) => record.releaseStatus === "Partial").length,
      private_source_mix: countSummary(countryRecords.map(exportSourceLabel)),
      print_candidate_count: countryPrint.length,
      high_priority_print_candidates: highPrint.length,
      print_source_mix: countSummary(countryPrint.map(exportCandidateSource)),
      public_statement_count: countryStatements.length,
      daily_diary_reference_count: countryDiary.length,
      linked_daily_diary_references: linkedDiary.length,
      top_private_topics: countSummary(countryRecords.flatMap((record) => record.frusTopics || record.topics || [])).slice(0, 8),
      top_print_themes: countSummary(countryPrint.flatMap((candidate) => candidate.themes || [])).slice(0, 8),
      first_private_record: sortedRecords[0]?.documentTitle || sortedRecords[0]?.title || "",
      latest_private_record:
        sortedRecords[sortedRecords.length - 1]?.documentTitle || sortedRecords[sortedRecords.length - 1]?.title || "",
      highest_priority_print_leads: highPrint
        .sort(
          (a, b) =>
            (b.score || 0) - (a.score || 0) ||
            (a.documentDate || "").localeCompare(b.documentDate || "") ||
            (a.documentTitle || "").localeCompare(b.documentTitle || "")
        )
        .slice(0, 8)
        .map((candidate) => [candidate.documentDate, candidate.documentTitle].filter(Boolean).join(" - ")),
      risk_signals: risk?.riskSignals || [],
      recommended_actions: risk?.recommendedActions || []
    };
  });
}

function reviewQueueExportRows() {
  const audit = window.COMPILER_GAPS || {};
  const riskMap = riskByCountry();
  const rows = [];

  for (const gap of audit.structuralGaps || []) {
    rows.push({
      queue_order: 1000 + riskRank(gap.riskLevel) * 100,
      action_type: "Structural gap",
      urgency: gap.riskLevel || "",
      country: "",
      country_risk_score: "",
      private_record_count: "",
      high_priority_print_candidates: audit.summary?.highPriorityPrintCandidateCount || "",
      date: "",
      document_type: "Compiler audit",
      title: gap.title || "",
      source_series: "Compiler gap audit",
      source_folder: "",
      priority: "",
      score: "",
      release_or_access_status: "",
      page_count_or_range: "",
      evidence: gap.evidence || "",
      recommended_action: gap.recommendedAction || "",
      source_note: "",
      pdf_url: "",
      catalog_url: ""
    });
  }

  for (const gap of audit.countryRisks || []) {
    rows.push({
      queue_order: 2000 + riskRank(gap.riskLevel) * 100 - (gap.riskScore || 0),
      action_type: "Country coverage gap",
      urgency: gap.riskLevel || "",
      country: gap.country || "",
      country_risk_score: gap.riskScore || "",
      private_record_count: gap.privateRecordCount || 0,
      high_priority_print_candidates: gap.highPriorityCandidateCount || 0,
      date: "",
      document_type: "Country chapter audit",
      title: `${gap.country || "Country"} coverage risk`,
      source_series: "Compiler gap audit",
      source_folder: "",
      priority: "",
      score: "",
      release_or_access_status: "",
      page_count_or_range: gap.privatePageCount || 0,
      evidence: gap.riskSignals || [],
      recommended_action: gap.recommendedActions || [],
      source_note: "",
      pdf_url: "",
      catalog_url: ""
    });
  }

  for (const record of window.MEMCONS || []) {
    if (record.releaseStatus !== "Partial") continue;
    const countryRisk = bestCountryRisk(record.countries || [], riskMap);
    rows.push({
      queue_order: 3000 + riskRank(countryRisk?.riskLevel) * 100 - (countryRisk?.riskScore || 0),
      action_type: "Partial release",
      urgency: "Medium",
      country: exportCountries(record),
      country_risk_score: countryRisk?.riskScore || "",
      private_record_count: countryRisk?.privateRecordCount || "",
      high_priority_print_candidates: countryRisk?.highPriorityCandidateCount || "",
      date: record.date || "",
      document_type: record.type || "",
      title: record.documentTitle || record.title || "",
      source_series: exportSourceLabel(record),
      source_folder: record.sourceTitle || "",
      priority: "",
      score: "",
      release_or_access_status: record.releaseStatus || "",
      page_count_or_range: record.pageCount || 0,
      evidence: "Partial release in verified private memcon/telcon chronology.",
      recommended_action: "Check for less-redacted copies in parallel files, later releases, or cited backup material before final selection.",
      source_note: record.sourceNote || "",
      pdf_url: record.pdfUrl || "",
      catalog_url: record.catalogUrl || ""
    });
  }

  for (const candidate of printCandidateExportRows()) {
    if (candidate.priority !== "High") continue;
    const countries = Array.isArray(candidate.countries)
      ? candidate.countries
      : String(candidate.countries || "")
          .split(";")
          .map((country) => country.trim())
          .filter(Boolean);
    const countryRisk = bestCountryRisk(countries, riskMap);
    rows.push({
      queue_order: 4000 + riskRank(countryRisk?.riskLevel) * 100 - (countryRisk?.riskScore || 0),
      action_type: "High-priority print candidate",
      urgency: countryRisk?.riskLevel || "Review",
      country: candidate.countries || "",
      country_risk_score: countryRisk?.riskScore || "",
      private_record_count: countryRisk?.privateRecordCount || "",
      high_priority_print_candidates: countryRisk?.highPriorityCandidateCount || "",
      date: candidate.document_date || "",
      document_type: candidate.document_type || "",
      title: candidate.document_title || "",
      source_series: candidate.source_series || "",
      source_folder: candidate.folder_title || "",
      priority: candidate.priority || "",
      score: candidate.score || "",
      release_or_access_status: candidate.access_restriction || "",
      page_count_or_range: [candidate.page_start, candidate.page_end].filter(Boolean).join("-"),
      evidence: candidate.review_reason || candidate.ocr_snippet || "",
      recommended_action: "Verify page image, source folder, and date; compare against the country chronology before print selection.",
      source_note: candidate.source_note || "",
      pdf_url: candidate.pdf_url || "",
      catalog_url: candidate.catalog_url || candidate.page_link || ""
    });
  }

  return rows.sort(
    (a, b) =>
      (a.queue_order || 9999) - (b.queue_order || 9999) ||
      String(a.country || "").localeCompare(String(b.country || "")) ||
      String(a.date || "").localeCompare(String(b.date || "")) ||
      String(a.title || "").localeCompare(String(b.title || ""))
  );
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
  attachExport('[data-export="reviewQueue"]', "compiler-review-queue.csv", reviewQueueExportRows());
  attachExport('[data-export="countryDossiers"]', "country-dossiers.csv", countryDossierExportRows());
  attachExport('[data-export="printCandidates"]', "print-candidates.csv", printCandidateExportRows());
  attachExport('[data-export="dailyDiary"]', "daily-diary-references.csv", dailyDiaryExportRows());
  attachExport('[data-export="publicStatements"]', "public-statements.csv", publicStatementExportRows());
}

attachCompilerExports();
