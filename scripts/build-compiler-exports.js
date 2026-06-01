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

function riskRank(level) {
  return { Critical: 0, High: 1, Medium: 2, Monitor: 3, Reference: 4 }[level] ?? 9;
}

function riskByCountry(audit) {
  return new Map((audit.countryRisks || []).map((risk) => [risk.country, risk]));
}

function bestCountryRisk(countries, riskMap) {
  return (countries || [])
    .map((country) => riskMap.get(country))
    .filter(Boolean)
    .sort((a, b) => riskRank(a.riskLevel) - riskRank(b.riskLevel) || (b.riskScore || 0) - (a.riskScore || 0))[0];
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

function reviewQueueRows({ audit, memcons, printCandidates }) {
  const riskMap = riskByCountry(audit);
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

  for (const record of memcons) {
    if (record.releaseStatus !== "Partial") continue;
    const countryRisk = bestCountryRisk(record.countries || [], riskMap);
    rows.push({
      queue_order: 3000 + riskRank(countryRisk?.riskLevel) * 100 - (countryRisk?.riskScore || 0),
      action_type: "Partial release",
      urgency: "Medium",
      country: countryList(record),
      country_risk_score: countryRisk?.riskScore || "",
      private_record_count: countryRisk?.privateRecordCount || "",
      high_priority_print_candidates: countryRisk?.highPriorityCandidateCount || "",
      date: record.date || "",
      document_type: record.type || "",
      title: record.documentTitle || record.title || "",
      source_series: sourceShort(record),
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

  for (const candidate of printCandidateRows(printCandidates)) {
    if (candidate.priority !== "High") continue;
    const countryRisk = bestCountryRisk(candidate.countries || [], riskMap);
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

function main() {
  const memcons = readJson("data/memcons.json");
  const printCandidates = [
    ...readJson("data/chronological-print-candidates.json"),
    ...readJson("data/subject-print-candidates.json"),
    ...readJson("data/deal-print-candidates.json")
  ];
  const dailyDiaryReferences = readJson("data/daily-diary-references.json");
  const publicStatements = readJson("data/public-statements.json");
  const compilerGaps = readJson("data/compiler-gaps.json");

  const exports = [
    writeCsv("compiler-chronology.csv", chronologyRows(memcons)),
    writeCsv("compiler-review-queue.csv", reviewQueueRows({ audit: compilerGaps, memcons, printCandidates })),
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
