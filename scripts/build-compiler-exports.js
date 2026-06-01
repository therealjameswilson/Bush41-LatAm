const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "data");
const REPORT = path.join(ROOT, "reports", "compiler-exports-build.json");
const MONTHS = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11
};

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

function normalizePersonText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function personNameVariants(name) {
  const [surnamePart, givenPart = ""] = String(name || "").split(",").map((part) => part.trim());
  const surname = surnamePart.replace(/\([^)]*\)/g, "").trim();
  const given = givenPart.replace(/\([^)]*\)/g, "").trim();
  const firstGiven = given.split(/\s+/)[0] || "";
  const variants = [
    name,
    [given, surname].filter(Boolean).join(" "),
    [firstGiven, surname].filter(Boolean).join(" ")
  ];

  if (/^Bush,\s*George/i.test(name)) {
    variants.push("George H. W. Bush", "George H W Bush", "President Bush");
  }

  return sortedUnique(variants.map(normalizePersonText).filter((variant) => variant.length > 5));
}

function personNameParts(name) {
  const [surnamePart, givenPart = ""] = String(name || "").split(",").map((part) => part.trim());
  return {
    surname: normalizePersonText(surnamePart),
    firstGiven: normalizePersonText(givenPart).split(/\s+/)[0] || ""
  };
}

function personAuthorityCollisions(person, persons) {
  const parts = personNameParts(person.name);
  if (!parts.surname || !parts.firstGiven) return [];
  return persons
    .filter((other) => other.id !== person.id)
    .filter((other) => {
      const otherParts = personNameParts(other.name);
      return otherParts.surname === parts.surname && otherParts.firstGiven === parts.firstGiven;
    })
    .map((other) => other.name);
}

function textMatchesPerson(value, variants) {
  const normalized = ` ${normalizePersonText(value)} `;
  return variants.some((variant) => normalized.includes(` ${variant} `));
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

function primaryCountry(countries) {
  const chapterOrder = [
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
  const rank = (country) => {
    const value = chapterOrder.indexOf(country);
    return value === -1 ? 999 : value;
  };
  return [...(countries || [])]
    .filter((country) => country !== "United States")
    .sort((a, b) => rank(a) - rank(b))[0] || "Regional/No single country";
}

function dateObject(value) {
  if (!value) return null;
  const text = String(value).trim();
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (match) {
    const year = Number(match[3]);
    return new Date(Date.UTC(year < 100 ? 1900 + year : year, Number(match[1]) - 1, Number(match[2])));
  }
  match = text.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (match && MONTHS[match[1].toLowerCase()] !== undefined) {
    return new Date(Date.UTC(Number(match[3]), MONTHS[match[1].toLowerCase()], Number(match[2])));
  }
  return null;
}

function normalizedDate(value) {
  const parsed = dateObject(value);
  return parsed ? parsed.toISOString().slice(0, 10) : "";
}

function volumeDateScope(value) {
  const date = normalizedDate(value);
  if (!date) return "Undated/needs verification";
  if (date < "1989-01-20") return "Pre-Bush/background";
  if (date > "1992-12-31") return "Post-1992/review scope";
  return "Volume date range";
}

function exportYear(value) {
  return normalizedDate(value).slice(0, 4);
}

function foiaNumberFromText(...values) {
  const match = values
    .filter(Boolean)
    .join(" ")
    .match(/\bFOIA\s+([0-9]{4}-[0-9]{4}-[A-Z])\b/i);
  return match ? match[1] : "";
}

function archivalSourceNoteConforms(note) {
  return (
    /^Source: /.test(note || "") &&
    !/https?:\/\//i.test(note || "") &&
    !/\bNAID\b/i.test(note || "") &&
    !/Digital object|Digital Research Room|National Archives Catalog|Folder ID Number|Catalog:|Project PDF/i.test(note || "")
  );
}

function citationStatus(recordClass, note) {
  if (!note) return "Missing source note";
  if (recordClass === "Public statement") return "Published reference";
  if (recordClass === "Daily diary/backup reference") return "Supporting reference";
  return archivalSourceNoteConforms(note) ? "FRUS-style ready" : "Needs source-note review";
}

function citationStatusRank(status) {
  return {
    "Missing source note": 0,
    "Needs source-note review": 1,
    "FRUS-style ready": 2,
    "Supporting reference": 3,
    "Published reference": 4
  }[status] ?? 9;
}

function citationReviewFlags(fields) {
  const flags = [];
  const note = fields.sourceNote || "";
  if (!note) flags.push("missing_source_note");
  if (/https?:\/\//i.test(note)) flags.push("source_note_contains_url");
  if (/\bNAID\b/i.test(note)) flags.push("source_note_contains_naid");
  if (/Digital object|Digital Research Room|National Archives Catalog|Folder ID Number|Catalog:|Project PDF/i.test(note)) {
    flags.push("source_note_contains_catalog_trail");
  }
  if (!normalizedDate(fields.date)) flags.push("missing_or_unparsed_date");
  if (!fields.title) flags.push("missing_title");
  if (!fields.pdfUrl) flags.push("missing_pdf_url");
  if (!fields.catalogUrl) flags.push("missing_catalog_or_details_url");
  if (fields.volumeScope && fields.volumeScope !== "Volume date range") flags.push("outside_volume_date_scope_or_undated");
  if (fields.primaryCountry === "Regional/No single country") flags.push("regional_no_single_country");

  if (fields.recordClass === "Declassified memcon/telcon") {
    if (!fields.provenanceNote) flags.push("missing_provenance_note");
    if (!fields.pageCountOrRange) flags.push("missing_page_count");
    if (/partial/i.test(fields.releaseOrAccessStatus || "")) flags.push("partial_release_check_less_redacted_copy");
    if (fields.sourceName === "Brent Scowcroft Papers" && !fields.hasProvenanceSheet) {
      flags.push("scowcroft_missing_pdf_provenance_sheet");
    }
  }

  if (fields.recordClass === "Print-candidate lead") {
    flags.push("ocr_lead_verify_page_image");
    if (!fields.pageCountOrRange) flags.push("missing_page_start_or_range");
    if (!fields.pageLink) flags.push("missing_pdf_page_link");
    if (fields.priority === "High") flags.push("high_priority_print_candidate");
  }

  if (fields.recordClass === "Daily diary/backup reference" && /empty/i.test(fields.releaseOrAccessStatus || "")) {
    flags.push("empty_folder");
  }

  return flags;
}

function citationAction(recordClass, status, flags) {
  if (status === "Missing source note" || status === "Needs source-note review") {
    return "Repair visible Source note against the Volume XXXI Bush-document model before selection.";
  }
  if (recordClass === "Print-candidate lead") {
    return "Verify OCR, page image, document boundaries, date, and folder provenance before printing.";
  }
  if (flags.includes("partial_release_check_less_redacted_copy")) {
    return "Check parallel files or later releases for a less-redacted copy before final selection.";
  }
  if (recordClass === "Daily diary/backup reference") {
    return "Use as schedule and backup-material evidence for timing, calls, meetings, and support packets.";
  }
  if (recordClass === "Public statement") {
    return "Use as public-line reference and compare against private record context.";
  }
  return "Source note is ready for compiler review with provenance retained separately.";
}

function candidateFileGroup(candidate) {
  const source = sourceName(candidate);
  if (/Chronological/i.test(source)) return "Latin American Affairs Directorate Files, Chronological Files";
  if (/Latin American Affairs Directorate Subject/i.test(source)) return "Latin American Affairs Directorate Files, Subject File 1989";
  if (/Timothy E\.?\s*Deal/i.test(source)) return "Deal, Timothy E., Files, Subject Files";
  return "";
}

function selectionRiskBonus(risk) {
  return { Critical: 16, High: 10, Medium: 6, Monitor: 2, Reference: 0 }[risk?.riskLevel] || 0;
}

function selectionDatePenalty(scope) {
  if (scope === "Volume date range") return 0;
  if (scope === "Undated/needs verification") return 14;
  return 8;
}

function selectionThemes(item) {
  return item.frusTopics || item.topics || item.themes || [];
}

function selectionTopicBonus(themes) {
  const text = (themes || []).join(" ").toLowerCase();
  let bonus = 0;
  if (/presidential diplomacy|head.of.state|head of state|president/.test(text)) bonus += 8;
  if (/democracy|human rights|narcotics|debt|economy|trade|security|insurgency|enterprise/.test(text)) bonus += 6;
  if (/regional policy|latin america|south america/.test(text)) bonus += 3;
  return Math.min(bonus, 14);
}

function nearbyPrivateRecords(candidate, memcons, maxDays) {
  return memcons
    .map((record) => ({
      record,
      distance: dayDistance(candidate.documentDate, recordDateValue(record)),
      sharedCountries: sharedCountries(candidate, record)
    }))
    .filter((item) => item.distance !== null && Math.abs(item.distance) <= maxDays && item.sharedCountries.length)
    .sort(
      (a, b) =>
        Math.abs(a.distance) - Math.abs(b.distance) ||
        recordDateValue(a.record).localeCompare(recordDateValue(b.record)) ||
        (a.record.documentTitle || a.record.title || "").localeCompare(b.record.documentTitle || b.record.title || "")
    );
}

function privateSelectionScore(record, risk, nearbyHighLeads, nearbyStatements) {
  const scope = volumeDateScope(recordDateValue(record));
  let score = 72 + selectionRiskBonus(risk) + selectionTopicBonus(selectionThemes(record));
  if (/memcon/i.test(record.type || "")) score += 6;
  if (/telcon/i.test(record.type || "")) score += 4;
  if ((record.pageCount || 0) >= 5) score += 5;
  if ((record.dailyDiaryReferences || []).length) score += 3;
  score += Math.min(nearbyHighLeads.length * 2, 12);
  score += Math.min(nearbyStatements.length, 6);
  if (/partial/i.test(record.releaseStatus || "")) score += 4;
  score -= selectionDatePenalty(scope);
  return Math.max(0, Math.round(score));
}

function candidateSelectionScore(candidate, risk, nearbyPrivate) {
  const scope = volumeDateScope(candidate.documentDate);
  let score = Math.min(Number(candidate.score || 0), 100) + selectionRiskBonus(risk) + selectionTopicBonus(candidate.themes || []);
  if (candidate.priority === "High") score += 14;
  if (candidate.priority === "Medium") score += 5;
  if (nearbyPrivate.length) score += 6;
  if (/withdrawal/i.test(candidate.extraction || "")) score += 4;
  score -= selectionDatePenalty(scope);
  return Math.max(0, Math.round(score));
}

function selectionBand(recordClass, score, statusOrPriority, scope) {
  if (scope !== "Volume date range") return "Verify date/scope before selection";
  if (recordClass === "Declassified memcon/telcon") {
    if (/partial/i.test(statusOrPriority || "")) return "Private record - partial release check";
    if (score >= 105) return "Core private record";
    if (score >= 90) return "Strong private record";
    return "Private record - context";
  }
  if (statusOrPriority === "High" && score >= 110) return "Top print lead";
  if (statusOrPriority === "High") return "High-priority print lead";
  if (statusOrPriority === "Medium") return "Secondary print/context lead";
  return "Reference lead";
}

function selectionActionFor(row) {
  if (row.volume_date_scope !== "Volume date range") {
    return "Verify date and volume scope before investing selection time.";
  }
  if (row.selection_band === "Private record - partial release check") {
    return "Check for a less-redacted copy, then decide whether to print, annotate, or replace.";
  }
  if (row.record_class === "Declassified memcon/telcon") {
    return "Evaluate for print or annotation, using nearby leads and public statements as surrounding context.";
  }
  if (/Top|High-priority/.test(row.selection_band)) {
    return "Verify page image/OCR and compare against the private chronology before print selection.";
  }
  if (row.selection_band === "Secondary print/context lead") {
    return "Use to fill country chronology gaps or support annotation after high-priority leads are checked.";
  }
  return "Retain as reference unless it resolves a country gap, public-private mismatch, or annotation need.";
}

function coverageSignal({ privateRecords, highPrintCandidates, printCandidates, publicStatements, partialRecords }) {
  if (!privateRecords && highPrintCandidates) return "No private records; high print pressure";
  if (!privateRecords && publicStatements) return "No private records; public-private mismatch";
  if (!privateRecords && printCandidates) return "No private records; print leads exist";
  if (!privateRecords) return "No private record identified";
  if (partialRecords) return "Private record includes partial release";
  if (privateRecords <= 1 && highPrintCandidates >= 3) return "Thin private record; high print pressure";
  if (privateRecords <= 1 && publicStatements >= 3) return "Thin private record; public-private mismatch";
  if (highPrintCandidates >= 5) return "Private record present; high print pressure";
  return "Coverage present";
}

function coverageAction(signal) {
  if (/No private records; high print pressure/.test(signal)) {
    return "Prioritize high-priority print leads and adjacent NSC/State files for this country-year before closing the chapter chronology.";
  }
  if (/No private records; public-private mismatch/.test(signal)) {
    return "Map public statements to surrounding briefing papers, memoranda, cables, and schedule records for this country-year.";
  }
  if (/No private records; print leads exist/.test(signal)) {
    return "Verify print leads and decide whether they supply the missing country-year narrative.";
  }
  if (/No private record identified/.test(signal)) {
    return "Treat this country-year as a gap until non-presidential and agency files are checked.";
  }
  if (/partial release/.test(signal)) {
    return "Check parallel files and later releases for less-redacted copies before selecting or annotating.";
  }
  if (/Thin private record; high print pressure/.test(signal)) {
    return "Use high-priority print leads to test whether the private chronology is only a presidential-contact skeleton.";
  }
  if (/Thin private record; public-private mismatch/.test(signal)) {
    return "Compare public line to surrounding private material and add explanatory context where needed.";
  }
  if (/high print pressure/.test(signal)) {
    return "Triage high-priority leads against the verified private records for possible print additions or annotations.";
  }
  return "Use existing private records as the anchor and scan leads only for annotation or missing-decision context.";
}

function dayDistance(a, b) {
  const left = dateObject(a);
  const right = dateObject(b);
  if (!left || !right) return null;
  return Math.round((right.getTime() - left.getTime()) / 86400000);
}

function sharedCountries(left, right) {
  const leftCountries = new Set(countryList(left));
  return countryList(right).filter((country) => leftCountries.has(country));
}

function contextLabel(item, dateField = "documentDate") {
  return [item[dateField] || item.sortDate || "", item.documentTitle || item.title || ""].filter(Boolean).join(" - ");
}

function nearbyPrintCandidates(record, candidates, maxDays) {
  return candidates
    .map((candidate) => ({
      candidate,
      distance: dayDistance(recordDateValue(record), candidate.documentDate),
      sharedCountries: sharedCountries(record, candidate)
    }))
    .filter((item) => item.distance !== null && Math.abs(item.distance) <= maxDays && item.sharedCountries.length)
    .sort(
      (a, b) =>
        Math.abs(a.distance) - Math.abs(b.distance) ||
        (b.candidate.score || 0) - (a.candidate.score || 0) ||
        (a.candidate.documentDate || "").localeCompare(b.candidate.documentDate || "") ||
        (a.candidate.documentTitle || "").localeCompare(b.candidate.documentTitle || "")
    );
}

function nearbyPublicStatements(record, statements, maxDays) {
  return statements
    .map((statement) => ({
      statement,
      distance: dayDistance(recordDateValue(record), statement.documentDate || statement.sortDate),
      sharedCountries: sharedCountries(record, statement)
    }))
    .filter((item) => item.distance !== null && Math.abs(item.distance) <= maxDays && item.sharedCountries.length)
    .sort(
      (a, b) =>
        Math.abs(a.distance) - Math.abs(b.distance) ||
        (a.statement.documentDate || a.statement.sortDate || "").localeCompare(b.statement.documentDate || b.statement.sortDate || "") ||
        (a.statement.title || "").localeCompare(b.statement.title || "")
    );
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

function documentContextRows({ audit, memcons, printCandidates, publicStatements }) {
  const riskMap = riskByCountry(audit);

  return [...memcons]
    .sort(
      (a, b) =>
        (a.chapter?.number || 999) - (b.chapter?.number || 999) ||
        recordDateValue(a).localeCompare(recordDateValue(b)) ||
        (a.documentTitle || a.title || "").localeCompare(b.documentTitle || b.title || "")
    )
    .map((record) => {
      const risk = bestCountryRisk(record.countries || [], riskMap);
      const nearbyLeads = nearbyPrintCandidates(record, printCandidates, 14);
      const nearbyHighLeads = nearbyLeads.filter((item) => item.candidate.priority === "High");
      const nearbyStatements = nearbyPublicStatements(record, publicStatements, 7);

      return {
        chapter_number: record.chapter?.number || "",
        chapter_country: record.chapter?.name || "",
        date: record.date || "",
        document_type: record.type || "",
        document_title: record.documentTitle || record.title || "",
        release_status: record.releaseStatus || "",
        page_count: record.pageCount || 0,
        source_bucket: sourceShort(record),
        country_risk_level: risk?.riskLevel || "",
        country_risk_score: risk?.riskScore || "",
        participants: record.participants || [],
        frus_topics: record.frusTopics || record.topics || [],
        same_date_diary_backup_count: (record.dailyDiaryReferences || []).length,
        same_date_diary_backup_titles: (record.dailyDiaryReferences || []).map((reference) => reference.title),
        nearby_high_priority_print_lead_count: nearbyHighLeads.length,
        nearby_high_priority_print_leads: nearbyHighLeads
          .slice(0, 10)
          .map((item) => `${item.distance >= 0 ? "+" : ""}${item.distance}d ${contextLabel(item.candidate)}`),
        nearby_print_lead_count_14_days: nearbyLeads.length,
        nearby_public_statement_count_7_days: nearbyStatements.length,
        nearby_public_statements: nearbyStatements
          .slice(0, 10)
          .map((item) => `${item.distance >= 0 ? "+" : ""}${item.distance}d ${contextLabel(item.statement, "documentDate")}`),
        context_review_note: "Check nearby leads/statements as surrounding evidence; OCR-derived leads require page-image confirmation before selection.",
        source_note: record.sourceNote || "",
        pdf_url: record.pdfUrl || "",
        catalog_url: record.catalogUrl || ""
      };
    });
}

function timelineSortValue(value) {
  return normalizedDate(value) || "9999-99-99";
}

function evidenceTimelineRows({ memcons, printCandidates, dailyDiaryReferences, publicStatements }) {
  const chapterOrder = [
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
  const countryRank = (country) => {
    const value = chapterOrder.indexOf(country);
    return value === -1 ? 999 : value;
  };
  const rows = [];

  for (const record of memcons) {
    const countries = countryList(record);
    rows.push({
      sort_date: normalizedDate(recordDateValue(record)),
      display_date: record.date || "",
      volume_date_scope: volumeDateScope(recordDateValue(record)),
      countries,
      primary_chapter_country: record.chapter?.name || primaryCountry(countries),
      record_class: "Declassified memcon/telcon",
      document_type: record.type || "",
      title: record.documentTitle || record.title || "",
      subject_or_context: record.subjectLine || record.title || "",
      priority_or_status: record.releaseStatus || "",
      score: "",
      page_count_or_range: record.pageCount || 0,
      source_collection: record.source?.name || "",
      source_series: sourceShort(record),
      source_folder_or_title: record.sourceTitle || "",
      local_identifier: record.localIdentifier || "",
      naid_or_folder_naid: record.naid || "",
      source_note: record.sourceNote || "",
      provenance_note: record.provenanceNote || "",
      review_note: "Verified declassified private record; compare with same-date diary/backup and nearby print leads before final selection.",
      pdf_url: record.pdfUrl || "",
      catalog_or_details_url: record.catalogUrl || "",
      page_link: "",
      record_id: record.id || ""
    });
  }

  for (const candidate of printCandidates) {
    const countries = countryList(candidate);
    rows.push({
      sort_date: normalizedDate(candidate.documentDate),
      display_date: candidate.documentDate || "",
      volume_date_scope: volumeDateScope(candidate.documentDate),
      countries,
      primary_chapter_country: primaryCountry(countries),
      record_class: "Print-candidate lead",
      document_type: candidate.documentType || "",
      title: candidate.documentTitle || "",
      subject_or_context: candidate.reviewReason || candidate.ocrSnippet || "",
      priority_or_status: candidate.priority || "",
      score: candidate.score || "",
      page_count_or_range: [candidate.pageStart, candidate.pageEnd].filter(Boolean).join("-"),
      source_collection: "George H.W. Bush Library",
      source_series: sourceName(candidate),
      source_folder_or_title: candidate.folderTitle || "",
      local_identifier: candidate.localIdentifier || "",
      naid_or_folder_naid: candidate.folderNaid || "",
      source_note: candidate.sourceNote || "",
      provenance_note: "",
      review_note: "OCR-derived lead; verify the page image, date, title, and folder provenance before printing.",
      pdf_url: candidate.pdfUrl || "",
      catalog_or_details_url: candidate.catalogUrl || "",
      page_link: candidate.pageLink || "",
      record_id: candidate.id || ""
    });
  }

  for (const reference of dailyDiaryReferences) {
    const countries = countryList(reference);
    rows.push({
      sort_date: normalizedDate(reference.date),
      display_date: reference.catalogDate || reference.date || "",
      volume_date_scope: volumeDateScope(reference.date),
      countries,
      primary_chapter_country: primaryCountry(countries),
      record_class: "Daily diary/backup reference",
      document_type: reference.sourceType || "",
      title: reference.title || "",
      subject_or_context: reference.relationship || reference.reviewReason || "",
      priority_or_status: reference.empty ? "Empty folder" : reference.accessRestriction || "",
      score: "",
      page_count_or_range: "",
      source_collection: reference.sourceSeries?.collection || "White House Office of Appointments and Scheduling Files",
      source_series: reference.sourceSeries?.name || "Presidential Daily Diary and Presidential Daily Backup Materials",
      source_folder_or_title: reference.title || "",
      local_identifier: reference.localIdentifier || "",
      naid_or_folder_naid: reference.naid || "",
      source_note: reference.sourceNote || "",
      provenance_note: "",
      review_note: "Schedule/supporting-materials evidence; use to confirm timing, calls, meetings, and backup packets.",
      pdf_url: reference.pdfUrl || "",
      catalog_or_details_url: reference.catalogUrl || "",
      page_link: "",
      record_id: reference.id || ""
    });
  }

  for (const statement of publicStatements) {
    const countries = countryList(statement);
    rows.push({
      sort_date: normalizedDate(statement.sortDate || statement.documentDate),
      display_date: statement.documentDate || statement.sortDate || "",
      volume_date_scope: volumeDateScope(statement.sortDate || statement.documentDate),
      countries,
      primary_chapter_country: primaryCountry(countries),
      record_class: "Public statement",
      document_type: statement.documentType || "",
      title: statement.title || "",
      subject_or_context: statement.snippet || "",
      priority_or_status: "",
      score: "",
      page_count_or_range: [statement.pageStart, statement.pageEnd].filter(Boolean).join("-"),
      source_collection: statement.sourceCollection?.name || "Public Papers of the Presidents of the United States: George H. W. Bush",
      source_series: statement.bookLabel || "",
      source_folder_or_title: statement.packageId || "",
      local_identifier: statement.granuleId || "",
      naid_or_folder_naid: "",
      source_note: statement.sourceNote || "",
      provenance_note: "",
      review_note: "Public line/reference evidence; compare against private record and final source-note context.",
      pdf_url: statement.pdfUrl || "",
      catalog_or_details_url: statement.detailsUrl || statement.htmlUrl || "",
      page_link: statement.pageLink || statement.htmlUrl || "",
      record_id: statement.id || ""
    });
  }

  return rows.sort(
    (a, b) =>
      timelineSortValue(a.sort_date).localeCompare(timelineSortValue(b.sort_date)) ||
      countryRank(a.primary_chapter_country) - countryRank(b.primary_chapter_country) ||
      String(a.record_class || "").localeCompare(String(b.record_class || "")) ||
      String(a.title || "").localeCompare(String(b.title || ""))
  );
}

function citationWorkbenchRows({ memcons, printCandidates, dailyDiaryReferences, publicStatements }) {
  const chapterOrder = [
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
  const countryRank = (country) => {
    const value = chapterOrder.indexOf(country);
    return value === -1 ? 999 : value;
  };
  const rows = [];

  const pushRow = (fields) => {
    const status = citationStatus(fields.recordClass, fields.sourceNote);
    const flags = citationReviewFlags(fields);
    rows.push({
      source_note_status: status,
      source_note_review_flags: flags,
      compiler_action: citationAction(fields.recordClass, status, flags),
      record_class: fields.recordClass,
      primary_chapter_country: fields.primaryCountry,
      countries: fields.countries,
      sort_date: normalizedDate(fields.date),
      display_date: fields.displayDate || fields.date || "",
      volume_date_scope: fields.volumeScope || volumeDateScope(fields.date),
      document_type: fields.documentType || "",
      title: fields.title || "",
      source_note_model: fields.sourceNoteModel,
      source_note: fields.sourceNote || "",
      provenance_note: fields.provenanceNote || "",
      repository: fields.repository || "",
      record_group_or_collection: fields.recordGroupOrCollection || "",
      office_or_collection: fields.officeOrCollection || "",
      series: fields.series || "",
      subseries_or_file_group: fields.subseriesOrFileGroup || "",
      oa_or_local_identifier: fields.oaOrLocalIdentifier || "",
      folder_or_source_title: fields.folderOrSourceTitle || "",
      record_naid: fields.recordNaid || "",
      series_or_folder_naid: fields.seriesOrFolderNaid || "",
      page_count_or_range: fields.pageCountOrRange || "",
      release_or_access_status: fields.releaseOrAccessStatus || "",
      foia_or_processing: fields.foiaOrProcessing || "",
      pdf_url: fields.pdfUrl || "",
      catalog_or_details_url: fields.catalogUrl || "",
      page_link: fields.pageLink || "",
      record_id: fields.recordId || ""
    });
  };

  for (const record of memcons) {
    const source = record.source || {};
    const provenance = source.provenanceSheet || {};
    const countries = countryList(record);
    const recordClass = "Declassified memcon/telcon";
    const date = recordDateValue(record);
    const primaryChapterCountry = record.chapter?.name || primaryCountry(countries);

    pushRow({
      recordClass,
      countries,
      primaryCountry: primaryChapterCountry,
      date,
      displayDate: record.date || "",
      volumeScope: volumeDateScope(date),
      documentType: record.type || "",
      title: record.documentTitle || record.title || "",
      sourceNoteModel: "FRUS Volume XXXI Bush-document source-note model",
      sourceNote: record.sourceNote || "",
      provenanceNote: record.provenanceNote || "",
      repository: "George H.W. Bush Library",
      recordGroupOrCollection: provenance.recordGroupCollection || "Bush Presidential Records",
      officeOrCollection:
        provenance.collectionOfficeOfOrigin ||
        (source.name === "Brent Scowcroft Papers" ? "Brent Scowcroft Collection" : "National Security Council"),
      series: provenance.series || source.series || "",
      subseriesOrFileGroup: provenance.subseries || "",
      oaOrLocalIdentifier: provenance.folderIdNumber || provenance.oaIdNumber || record.localIdentifier || "",
      folderOrSourceTitle: provenance.folderTitle || source.fileUnitTitle || record.sourceTitle || "",
      recordNaid: record.naid || "",
      seriesOrFolderNaid: source.fileUnitNaid || source.seriesNaid || "",
      pageCountOrRange: source.sourcePages || record.pageCount || "",
      releaseOrAccessStatus: record.releaseStatus || "",
      foiaOrProcessing: provenance.foiaNumber || source.foiaNumber || foiaNumberFromText(record.sourceNote, record.provenanceNote),
      pdfUrl: record.pdfUrl || "",
      catalogUrl: record.catalogUrl || "",
      pageLink: "",
      recordId: record.id || "",
      sourceName: source.name || "",
      hasProvenanceSheet: Boolean(source.provenanceSheet)
    });
  }

  for (const candidate of printCandidates) {
    const countries = countryList(candidate);
    const recordClass = "Print-candidate lead";
    const date = candidate.documentDate || "";
    const pageRange = [candidate.pageStart, candidate.pageEnd].filter(Boolean).join("-");

    pushRow({
      recordClass,
      countries,
      primaryCountry: primaryCountry(countries),
      date,
      displayDate: date,
      volumeScope: volumeDateScope(date),
      documentType: candidate.documentType || "",
      title: candidate.documentTitle || "",
      sourceNoteModel: "FRUS Volume XXXI Bush-document source-note model",
      sourceNote: candidate.sourceNote || "",
      provenanceNote: "",
      repository: "George H.W. Bush Library",
      recordGroupOrCollection: "Bush Presidential Records",
      officeOrCollection: "National Security Council",
      series: sourceName(candidate),
      subseriesOrFileGroup: candidateFileGroup(candidate),
      oaOrLocalIdentifier: candidate.localIdentifier || "",
      folderOrSourceTitle: candidate.folderTitle || "",
      recordNaid: "",
      seriesOrFolderNaid: candidate.folderNaid || candidate.sourceSeries?.naid || "",
      pageCountOrRange: pageRange,
      releaseOrAccessStatus: candidate.accessRestriction || "",
      foiaOrProcessing: foiaNumberFromText(candidate.sourceNote),
      pdfUrl: candidate.pdfUrl || "",
      catalogUrl: candidate.catalogUrl || "",
      pageLink: candidate.pageLink || "",
      recordId: candidate.id || "",
      priority: candidate.priority || ""
    });
  }

  for (const reference of dailyDiaryReferences) {
    const countries = countryList(reference);
    const recordClass = "Daily diary/backup reference";
    const date = reference.date || "";

    pushRow({
      recordClass,
      countries,
      primaryCountry: primaryCountry(countries),
      date,
      displayDate: reference.catalogDate || date,
      volumeScope: volumeDateScope(date),
      documentType: reference.sourceType || "",
      title: reference.title || "",
      sourceNoteModel: "Supporting Daily Diary and backup-material source citation",
      sourceNote: reference.sourceNote || "",
      provenanceNote: "",
      repository: reference.sourceSeries?.repository || "George H.W. Bush Library",
      recordGroupOrCollection: reference.sourceSeries?.recordGroup || "Bush Presidential Records",
      officeOrCollection: reference.sourceSeries?.collection || "White House Office of Appointments and Scheduling Files",
      series: reference.sourceSeries?.name || "Presidential Daily Diary and Presidential Daily Backup Materials",
      subseriesOrFileGroup: "",
      oaOrLocalIdentifier: reference.localIdentifier || "",
      folderOrSourceTitle: reference.title || "",
      recordNaid: reference.naid || "",
      seriesOrFolderNaid: reference.sourceSeries?.naid || "",
      pageCountOrRange: "",
      releaseOrAccessStatus: reference.empty ? "Empty folder" : reference.accessRestriction || "",
      foiaOrProcessing: foiaNumberFromText(reference.sourceNote),
      pdfUrl: reference.pdfUrl || "",
      catalogUrl: reference.catalogUrl || "",
      pageLink: "",
      recordId: reference.id || ""
    });
  }

  for (const statement of publicStatements) {
    const countries = countryList(statement);
    const recordClass = "Public statement";
    const date = statement.sortDate || statement.documentDate || "";

    pushRow({
      recordClass,
      countries,
      primaryCountry: primaryCountry(countries),
      date,
      displayDate: statement.documentDate || statement.sortDate || "",
      volumeScope: volumeDateScope(date),
      documentType: statement.documentType || "",
      title: statement.title || "",
      sourceNoteModel: "GovInfo Public Papers published reference",
      sourceNote: statement.sourceNote || "",
      provenanceNote: "",
      repository: "Government Publishing Office",
      recordGroupOrCollection: statement.sourceCollection?.name || "Public Papers of the Presidents of the United States: George H. W. Bush",
      officeOrCollection: "GovInfo",
      series: statement.bookLabel || "",
      subseriesOrFileGroup: statement.packageId || "",
      oaOrLocalIdentifier: statement.granuleId || "",
      folderOrSourceTitle: statement.title || "",
      recordNaid: "",
      seriesOrFolderNaid: statement.packageId || "",
      pageCountOrRange: [statement.pageStart, statement.pageEnd].filter(Boolean).join("-"),
      releaseOrAccessStatus: "",
      foiaOrProcessing: "",
      pdfUrl: statement.pdfUrl || "",
      catalogUrl: statement.detailsUrl || statement.htmlUrl || "",
      pageLink: statement.pageLink || statement.htmlUrl || "",
      recordId: statement.id || ""
    });
  }

  return rows.sort(
    (a, b) =>
      citationStatusRank(a.source_note_status) - citationStatusRank(b.source_note_status) ||
      countryRank(a.primary_chapter_country) - countryRank(b.primary_chapter_country) ||
      timelineSortValue(a.sort_date).localeCompare(timelineSortValue(b.sort_date)) ||
      String(a.record_class || "").localeCompare(String(b.record_class || "")) ||
      String(a.title || "").localeCompare(String(b.title || ""))
  );
}

function selectionMatrixRows({ audit, memcons, printCandidates, publicStatements }) {
  const chapterOrder = [
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
  const countryRank = (country) => {
    const value = chapterOrder.indexOf(country);
    return value === -1 ? 999 : value;
  };
  const riskMap = riskByCountry(audit);
  const rows = [];

  for (const record of memcons) {
    const countries = countryList(record);
    const risk = bestCountryRisk(record.countries || [], riskMap);
    const nearbyLeads = nearbyPrintCandidates(record, printCandidates, 14);
    const nearbyHighLeads = nearbyLeads.filter((item) => item.candidate.priority === "High");
    const nearbyStatements = nearbyPublicStatements(record, publicStatements, 7);
    const citationFields = {
      recordClass: "Declassified memcon/telcon",
      date: recordDateValue(record),
      title: record.documentTitle || record.title || "",
      pdfUrl: record.pdfUrl || "",
      catalogUrl: record.catalogUrl || "",
      volumeScope: volumeDateScope(recordDateValue(record)),
      primaryCountry: record.chapter?.name || primaryCountry(countries),
      sourceNote: record.sourceNote || "",
      provenanceNote: record.provenanceNote || "",
      pageCountOrRange: record.pageCount || "",
      releaseOrAccessStatus: record.releaseStatus || "",
      sourceName: record.source?.name || "",
      hasProvenanceSheet: Boolean(record.source?.provenanceSheet)
    };
    const selectionScore = privateSelectionScore(record, risk, nearbyHighLeads, nearbyStatements);
    const band = selectionBand(
      "Declassified memcon/telcon",
      selectionScore,
      record.releaseStatus || "",
      citationFields.volumeScope
    );
    const flags = citationReviewFlags(citationFields);

    rows.push({
      selection_rank: "",
      selection_score: selectionScore,
      selection_band: band,
      compiler_action: "",
      record_class: "Declassified memcon/telcon",
      source_note_status: citationStatus("Declassified memcon/telcon", record.sourceNote || ""),
      selection_flags: flags,
      country_risk_level: risk?.riskLevel || "",
      country_risk_score: risk?.riskScore || "",
      primary_chapter_country: citationFields.primaryCountry,
      countries,
      sort_date: normalizedDate(recordDateValue(record)),
      display_date: record.date || "",
      volume_date_scope: citationFields.volumeScope,
      document_type: record.type || "",
      title: record.documentTitle || record.title || "",
      subject_or_context: record.subjectLine || "",
      priority_or_release_status: record.releaseStatus || "",
      source_score: "",
      page_count_or_range: record.pageCount || "",
      themes_or_topics: selectionThemes(record),
      same_date_diary_backup_count: (record.dailyDiaryReferences || []).length,
      nearby_high_priority_print_lead_count: nearbyHighLeads.length,
      nearby_high_priority_print_leads: nearbyHighLeads
        .slice(0, 8)
        .map((item) => `${item.distance >= 0 ? "+" : ""}${item.distance}d ${contextLabel(item.candidate)}`),
      nearby_private_records_14_days: "",
      nearby_public_statement_count_7_days: nearbyStatements.length,
      source_series: sourceShort(record),
      source_folder_or_title: record.sourceTitle || "",
      source_note: record.sourceNote || "",
      provenance_note: record.provenanceNote || "",
      pdf_url: record.pdfUrl || "",
      catalog_or_details_url: record.catalogUrl || "",
      page_link: "",
      record_id: record.id || ""
    });
  }

  for (const candidate of printCandidates) {
    const countries = countryList(candidate);
    const risk = bestCountryRisk(candidate.countries || [], riskMap);
    const privateNeighbors = nearbyPrivateRecords(candidate, memcons, 14);
    const citationFields = {
      recordClass: "Print-candidate lead",
      date: candidate.documentDate || "",
      title: candidate.documentTitle || "",
      pdfUrl: candidate.pdfUrl || "",
      catalogUrl: candidate.catalogUrl || "",
      volumeScope: volumeDateScope(candidate.documentDate),
      primaryCountry: primaryCountry(countries),
      sourceNote: candidate.sourceNote || "",
      provenanceNote: "",
      pageCountOrRange: [candidate.pageStart, candidate.pageEnd].filter(Boolean).join("-"),
      releaseOrAccessStatus: candidate.accessRestriction || "",
      pageLink: candidate.pageLink || ""
    };
    const selectionScore = candidateSelectionScore(candidate, risk, privateNeighbors);
    const band = selectionBand("Print-candidate lead", selectionScore, candidate.priority || "", citationFields.volumeScope);
    const flags = citationReviewFlags({ ...citationFields, priority: candidate.priority || "" });

    rows.push({
      selection_rank: "",
      selection_score: selectionScore,
      selection_band: band,
      compiler_action: "",
      record_class: "Print-candidate lead",
      source_note_status: citationStatus("Print-candidate lead", candidate.sourceNote || ""),
      selection_flags: flags,
      country_risk_level: risk?.riskLevel || "",
      country_risk_score: risk?.riskScore || "",
      primary_chapter_country: citationFields.primaryCountry,
      countries,
      sort_date: normalizedDate(candidate.documentDate),
      display_date: candidate.documentDate || "",
      volume_date_scope: citationFields.volumeScope,
      document_type: candidate.documentType || "",
      title: candidate.documentTitle || "",
      subject_or_context: candidate.reviewReason || candidate.ocrSnippet || "",
      priority_or_release_status: candidate.priority || "",
      source_score: candidate.score || "",
      page_count_or_range: citationFields.pageCountOrRange,
      themes_or_topics: candidate.themes || [],
      same_date_diary_backup_count: "",
      nearby_high_priority_print_lead_count: "",
      nearby_high_priority_print_leads: "",
      nearby_private_records_14_days: privateNeighbors
        .slice(0, 8)
        .map((item) => `${item.distance >= 0 ? "+" : ""}${item.distance}d ${contextLabel(item.record, "date")}`),
      nearby_public_statement_count_7_days: "",
      source_series: sourceName(candidate),
      source_folder_or_title: candidate.folderTitle || "",
      source_note: candidate.sourceNote || "",
      provenance_note: "",
      pdf_url: candidate.pdfUrl || "",
      catalog_or_details_url: candidate.catalogUrl || "",
      page_link: candidate.pageLink || "",
      record_id: candidate.id || ""
    });
  }

  return rows
    .sort(
      (a, b) =>
        (b.selection_score || 0) - (a.selection_score || 0) ||
        riskRank(a.country_risk_level) - riskRank(b.country_risk_level) ||
        countryRank(a.primary_chapter_country) - countryRank(b.primary_chapter_country) ||
        timelineSortValue(a.sort_date).localeCompare(timelineSortValue(b.sort_date)) ||
        String(a.record_class || "").localeCompare(String(b.record_class || "")) ||
        String(a.title || "").localeCompare(String(b.title || ""))
    )
    .map((row, index) => ({
      ...row,
      selection_rank: index + 1,
      compiler_action: selectionActionFor(row)
    }));
}

function coverageMatrixRows({ audit, memcons, printCandidates, dailyDiaryReferences, publicStatements }) {
  const chapterOrder = [
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
  const years = ["1989", "1990", "1991", "1992"];
  const riskMap = riskByCountry(audit);

  return chapterOrder.flatMap((country, countryIndex) => {
    const risk = riskMap.get(country);
    const countryPrintAll = printCandidates.filter((candidate) => (candidate.countries || []).includes(country));
    const outOfGridPrint = countryPrintAll.filter((candidate) => !years.includes(exportYear(candidate.documentDate)));
    const outOfGridHighPrint = outOfGridPrint.filter((candidate) => candidate.priority === "High");
    return years.map((year) => {
      const countryRecords = memcons.filter(
        (record) => (record.countries || []).includes(country) && exportYear(recordDateValue(record)) === year
      );
      const countryPrint = printCandidates.filter(
        (candidate) => (candidate.countries || []).includes(country) && exportYear(candidate.documentDate) === year
      );
      const highPrint = countryPrint.filter((candidate) => candidate.priority === "High");
      const mediumPrint = countryPrint.filter((candidate) => candidate.priority === "Medium");
      const countryStatements = publicStatements.filter(
        (statement) =>
          (statement.countries || []).includes(country) &&
          exportYear(statement.sortDate || statement.documentDate) === year
      );
      const countryDiary = dailyDiaryReferences.filter(
        (reference) => (reference.countries || []).includes(country) && exportYear(reference.date) === year
      );
      const linkedDiary = countryDiary.filter((reference) => (reference.linkedRecordIds || []).length);
      const partialRecords = countryRecords.filter((record) => /partial/i.test(record.releaseStatus || ""));
      const signal = coverageSignal({
        privateRecords: countryRecords.length,
        highPrintCandidates: highPrint.length,
        printCandidates: countryPrint.length,
        publicStatements: countryStatements.length,
        partialRecords: partialRecords.length
      });

      return {
        chapter_number: countryIndex + 1,
        country,
        year,
        country_risk_level: risk?.riskLevel || "Monitor",
        country_risk_score: risk?.riskScore || "",
        coverage_signal: signal,
        compiler_action: coverageAction(signal),
        private_record_count: countryRecords.length,
        private_page_count: countryRecords.reduce((total, record) => total + (record.pageCount || 0), 0),
        partial_private_records: partialRecords.length,
        private_source_mix: countSummary(countryRecords.map(sourceShort)),
        private_record_titles: countryRecords
          .sort((a, b) => recordDateValue(a).localeCompare(recordDateValue(b)) || (a.title || "").localeCompare(b.title || ""))
          .map((record) => [record.date, record.type, record.subjectLine || record.title || record.documentTitle].filter(Boolean).join(" - ")),
        print_candidate_count: countryPrint.length,
        high_priority_print_candidates: highPrint.length,
        medium_priority_print_candidates: mediumPrint.length,
        undated_or_out_of_scope_country_print_candidates: outOfGridPrint.length,
        undated_or_out_of_scope_high_priority_print_candidates: outOfGridHighPrint.length,
        print_source_mix: countSummary(countryPrint.map(sourceName)),
        top_print_leads: highPrint
          .sort(
            (a, b) =>
              (b.score || 0) - (a.score || 0) ||
              (normalizedDate(a.documentDate) || "9999").localeCompare(normalizedDate(b.documentDate) || "9999") ||
              (a.documentTitle || "").localeCompare(b.documentTitle || "")
          )
          .slice(0, 10)
          .map((candidate) => [candidate.documentDate, candidate.priority, candidate.score, candidate.documentTitle].filter(Boolean).join(" - ")),
        public_statement_count: countryStatements.length,
        public_statement_titles: countryStatements
          .sort(
            (a, b) =>
              (a.sortDate || a.documentDate || "").localeCompare(b.sortDate || b.documentDate || "") ||
              (a.title || "").localeCompare(b.title || "")
          )
          .slice(0, 10)
          .map((statement) => [statement.documentDate || statement.sortDate, statement.title].filter(Boolean).join(" - ")),
        daily_diary_reference_count: countryDiary.length,
        linked_daily_diary_references: linkedDiary.length,
        daily_diary_reference_titles: countryDiary
          .sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.title || "").localeCompare(b.title || ""))
          .slice(0, 10)
          .map((reference) => [reference.date, reference.sourceType, reference.title].filter(Boolean).join(" - ")),
        recommended_country_actions: risk?.recommendedActions || [],
        risk_signals: risk?.riskSignals || []
      };
    });
  });
}

function personIndexRows({ persons, memcons, printCandidates, dailyDiaryReferences, publicStatements }) {
  return persons.map((person) => {
    const variants = personNameVariants(person.name);
    const authorityCollisions = personAuthorityCollisions(person, persons);
    const verifiedRecords = memcons.filter((record) =>
      (record.participants || []).some((participant) => textMatchesPerson(participant, variants))
    );
    const printMentions = printCandidates.filter((candidate) =>
      textMatchesPerson(
        [candidate.documentTitle, candidate.ocrSnippet, candidate.reviewReason].filter(Boolean).join(" "),
        variants
      )
    );
    const statementMentions = publicStatements.filter((statement) =>
      textMatchesPerson([statement.title, statement.snippet].filter(Boolean).join(" "), variants)
    );
    const diaryMentions = dailyDiaryReferences.filter((reference) =>
      textMatchesPerson(
        [
          reference.title,
          reference.reviewReason,
          reference.matchedTerms || [],
          reference.linkedRecordTitles || []
        ]
          .flat()
          .filter(Boolean)
          .join(" "),
        variants
      )
    );
    const allCountries = sortedUnique([
      ...verifiedRecords.flatMap(countryList),
      ...printMentions.flatMap(countryList),
      ...statementMentions.flatMap(countryList),
      ...diaryMentions.flatMap(countryList)
    ]);
    const verifiedDates = sortedUnique(verifiedRecords.map(recordDateValue));
    const siteEvidenceTotal = verifiedRecords.length + printMentions.length + statementMentions.length + diaryMentions.length;

    return {
      person_name: person.name || "",
      description: person.description || "",
      included_reasons: person.reasons || [],
      authority_name_collision_count: authorityCollisions.length,
      authority_name_collisions: authorityCollisions,
      match_caution: authorityCollisions.length
        ? "Potential abbreviated-name collision; inspect mention rows before attribution."
        : "",
      has_site_evidence: siteEvidenceTotal ? "yes" : "no",
      site_evidence_total: siteEvidenceTotal,
      verified_participant_record_count: verifiedRecords.length,
      print_candidate_mention_count: printMentions.length,
      public_statement_mention_count: statementMentions.length,
      daily_diary_reference_mention_count: diaryMentions.length,
      countries: allCountries,
      first_verified_record_date: verifiedDates[0] || "",
      latest_verified_record_date: verifiedDates[verifiedDates.length - 1] || "",
      verified_record_titles: verifiedRecords
        .sort((a, b) => recordDateValue(a).localeCompare(recordDateValue(b)) || (a.title || "").localeCompare(b.title || ""))
        .map((record) => [record.date, record.type, record.subjectLine || record.title || record.documentTitle].filter(Boolean).join(" - ")),
      print_candidate_mentions: printMentions
        .sort(
          (a, b) =>
            timelineSortValue(a.documentDate).localeCompare(timelineSortValue(b.documentDate)) ||
            (a.documentTitle || "").localeCompare(b.documentTitle || "")
        )
        .slice(0, 20)
        .map((candidate) => [candidate.documentDate, candidate.priority, candidate.documentTitle].filter(Boolean).join(" - ")),
      public_statement_mentions: statementMentions
        .sort(
          (a, b) =>
            timelineSortValue(a.sortDate || a.documentDate).localeCompare(timelineSortValue(b.sortDate || b.documentDate)) ||
            (a.title || "").localeCompare(b.title || "")
        )
        .slice(0, 20)
        .map((statement) => [statement.documentDate || statement.sortDate, statement.title].filter(Boolean).join(" - ")),
      daily_diary_reference_mentions: diaryMentions
        .sort((a, b) => timelineSortValue(a.date).localeCompare(timelineSortValue(b.date)) || (a.title || "").localeCompare(b.title || ""))
        .slice(0, 20)
        .map((reference) => [reference.date, reference.sourceType, reference.title].filter(Boolean).join(" - ")),
      name_variants_used: variants,
      source_entry: person.entry || "",
      person_id: person.id || ""
    };
  });
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

function countryDossierRows({ audit, memcons, printCandidates, dailyDiaryReferences, publicStatements }) {
  const chapterOrder = [
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
  const riskMap = riskByCountry(audit);
  const targetYears = ["1989", "1990", "1991", "1992"];

  return chapterOrder.map((country, index) => {
    const countryRecords = memcons.filter((record) => (record.countries || []).includes(country));
    const countryPrint = printCandidates.filter((candidate) => (candidate.countries || []).includes(country));
    const highPrint = countryPrint.filter((candidate) => candidate.priority === "High");
    const countryStatements = publicStatements.filter((statement) => (statement.countries || []).includes(country));
    const countryDiary = dailyDiaryReferences.filter((reference) => (reference.countries || []).includes(country));
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
      private_source_mix: countSummary(countryRecords.map(sourceShort)),
      print_candidate_count: countryPrint.length,
      high_priority_print_candidates: highPrint.length,
      print_source_mix: countSummary(countryPrint.map(sourceName)),
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
  const persons = readJson("data/persons.json").persons || [];

  const exports = [
    writeCsv("compiler-chronology.csv", chronologyRows(memcons)),
    writeCsv(
      "document-context.csv",
      documentContextRows({
        audit: compilerGaps,
        memcons,
        printCandidates,
        publicStatements
      })
    ),
    writeCsv(
      "evidence-timeline.csv",
      evidenceTimelineRows({
        memcons,
        printCandidates,
        dailyDiaryReferences,
        publicStatements
      })
    ),
    writeCsv(
      "citation-workbench.csv",
      citationWorkbenchRows({
        memcons,
        printCandidates,
        dailyDiaryReferences,
        publicStatements
      })
    ),
    writeCsv(
      "selection-matrix.csv",
      selectionMatrixRows({
        audit: compilerGaps,
        memcons,
        printCandidates,
        publicStatements
      })
    ),
    writeCsv(
      "coverage-matrix.csv",
      coverageMatrixRows({
        audit: compilerGaps,
        memcons,
        printCandidates,
        dailyDiaryReferences,
        publicStatements
      })
    ),
    writeCsv(
      "person-index.csv",
      personIndexRows({
        persons,
        memcons,
        printCandidates,
        dailyDiaryReferences,
        publicStatements
      })
    ),
    writeCsv("compiler-review-queue.csv", reviewQueueRows({ audit: compilerGaps, memcons, printCandidates })),
    writeCsv(
      "country-dossiers.csv",
      countryDossierRows({
        audit: compilerGaps,
        memcons,
        printCandidates,
        dailyDiaryReferences,
        publicStatements
      })
    ),
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
