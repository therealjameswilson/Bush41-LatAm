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
const EXPORT_MONTHS = {
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

const ISSUE_DEFINITIONS = [
  {
    id: "narcotics-andean-policy",
    label: "Narcotics and Andean drug policy",
    themes: ["narcotics", "drug", "Andean"],
    keywords: [
      "narcotic",
      "drug",
      "andean",
      "cartagena",
      "cocaine",
      "cartel",
      "medellin",
      "eradication",
      "anti narcotics",
      "anti-drug",
      "traffick"
    ]
  },
  {
    id: "debt-trade-eai",
    label: "Debt, trade, and Enterprise for the Americas",
    themes: ["debt and economy", "enterprise for the americas", "trade policy", "business groups", "debt"],
    keywords: [
      "debt",
      "trade",
      "enterprise for the americas",
      "eai",
      "investment",
      "export",
      "economic",
      "finance",
      "brady",
      "imf",
      "world bank",
      "development"
    ]
  },
  {
    id: "democracy-elections-transitions",
    label: "Democracy, elections, and transitions",
    themes: ["democracy"],
    keywords: [
      "democracy",
      "democratic",
      "election",
      "transition",
      "inauguration",
      "human rights",
      "constitutional",
      "coup",
      "plebiscite",
      "opposition"
    ]
  },
  {
    id: "regional-security-panama",
    label: "Regional security and Panama spillover",
    themes: ["panama spillover"],
    keywords: [
      "panama",
      "noriega",
      "regional security",
      "military",
      "terrorism",
      "intelligence",
      "border",
      "hostage",
      "sanctions"
    ]
  },
  {
    id: "regional-policy-inter-american",
    label: "Regional policy and inter-American affairs",
    themes: ["regional policy", "Latin America", "South America"],
    keywords: [
      "latin america",
      "south america",
      "western hemisphere",
      "inter american",
      "inter-american",
      "regional policy",
      "hemisphere",
      "oas",
      "organization of american states"
    ]
  },
  {
    id: "cuba-ussr-cold-war",
    label: "Cuba, USSR, and Cold War transition",
    themes: ["ussr/cuba"],
    keywords: [
      "cuba",
      "castro",
      "soviet",
      "ussr",
      "gorbachev",
      "communist",
      "cold war",
      "nicaragua",
      "sandinista"
    ]
  },
  {
    id: "summits-multilateral-diplomacy",
    label: "Summits and multilateral diplomacy",
    themes: ["summit diplomacy", "Columbus Group"],
    keywords: [
      "summit",
      "cartagena",
      "unga",
      "united nations",
      "oas",
      "rio group",
      "columbus group",
      "multilateral",
      "ministerial",
      "conference"
    ]
  },
  {
    id: "environment-energy-development",
    label: "Environment, energy, and development",
    themes: ["environment"],
    keywords: [
      "environment",
      "environmental",
      "rain forest",
      "rainforest",
      "amazon",
      "energy",
      "climate",
      "conservation",
      "development"
    ]
  },
  {
    id: "presidential-diplomacy",
    label: "Presidential diplomacy and head-of-state contacts",
    themes: ["presidential diplomacy"],
    keywords: [
      "president",
      "presidential",
      "bilateral",
      "meeting",
      "telephone",
      "telcon",
      "memcon",
      "conversation",
      "call",
      "state visit",
      "working visit",
      "letter"
    ]
  }
];

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

function issueText(values) {
  return normalizePersonText(values.flat().filter(Boolean).join(" "));
}

function evidenceIssues({ themes = [], textValues = [], forcePresidential = false }) {
  const normalizedText = issueText([themes, textValues]);
  const matches = ISSUE_DEFINITIONS.filter((issue) =>
    [...(issue.themes || []), ...(issue.keywords || [])].some((term) => {
      const normalizedTerm = normalizePersonText(term);
      return normalizedTerm && normalizedText.includes(normalizedTerm);
    })
  );
  if (forcePresidential) {
    const presidential = ISSUE_DEFINITIONS.find((issue) => issue.id === "presidential-diplomacy");
    if (presidential && !matches.includes(presidential)) matches.push(presidential);
  }
  return matches;
}

function issueCountries(record) {
  const countries = exportCountries(record);
  return countries.length ? countries : ["Regional/No single country"];
}

function newIssueDossier(issue, country) {
  return {
    issue,
    country,
    dates: [],
    years: new Set(),
    sourceMix: new Set(),
    sourceFolders: new Set(),
    recordIds: new Set(),
    links: new Set(),
    privateRecords: [],
    printLeads: [],
    publicStatements: [],
    diaryReferences: [],
    evidenceTotal: 0,
    verifiedPrivateRecordCount: 0,
    printCandidateCount: 0,
    highPriorityPrintCandidateCount: 0,
    publicStatementCount: 0,
    dailyDiaryBackupReferenceCount: 0
  };
}

function issueDossierEntry(dossiers, issue, country) {
  const key = `${issue.id}|${country}`;
  if (!dossiers.has(key)) dossiers.set(key, newIssueDossier(issue, country));
  return dossiers.get(key);
}

function addIssueDossierEvidence(dossiers, issue, country, evidence) {
  const entry = issueDossierEntry(dossiers, issue, country);
  const date = normalizedDate(evidence.date);
  if (date) {
    entry.dates.push(date);
    entry.years.add(date.slice(0, 4));
  }
  if (evidence.source) entry.sourceMix.add(evidence.source);
  if (evidence.sourceFolder) entry.sourceFolders.add(evidence.sourceFolder);
  if (evidence.recordId) entry.recordIds.add(evidence.recordId);
  if (evidence.link) entry.links.add(evidence.link);
  entry.evidenceTotal += 1;

  const label = [date || evidence.date, evidence.priority, evidence.title].filter(Boolean).join(" - ");
  if (evidence.recordClass === "Verified private record") {
    entry.verifiedPrivateRecordCount += 1;
    entry.privateRecords.push(label);
  } else if (evidence.recordClass === "Print-candidate lead") {
    entry.printCandidateCount += 1;
    if (evidence.priority === "High") entry.highPriorityPrintCandidateCount += 1;
    entry.printLeads.push(label);
  } else if (evidence.recordClass === "Public statement") {
    entry.publicStatementCount += 1;
    entry.publicStatements.push(label);
  } else if (evidence.recordClass === "Daily diary/backup reference") {
    entry.dailyDiaryBackupReferenceCount += 1;
    entry.diaryReferences.push(label);
  }
}

function issueDateSpan(dates) {
  const sorted = sortedUnique(dates);
  if (!sorted.length) return "";
  return sorted[0] === sorted[sorted.length - 1] ? sorted[0] : `${sorted[0]} to ${sorted[sorted.length - 1]}`;
}

function issuePriority(entry, risk) {
  if (entry.highPriorityPrintCandidateCount >= 10 || (entry.highPriorityPrintCandidateCount >= 5 && risk?.riskLevel === "Critical")) {
    return "Critical";
  }
  if (entry.highPriorityPrintCandidateCount >= 3 || (entry.printCandidateCount && ["Critical", "High"].includes(risk?.riskLevel || ""))) {
    return "High";
  }
  if (entry.verifiedPrivateRecordCount || entry.printCandidateCount || entry.publicStatementCount >= 3) return "Medium";
  return "Reference";
}

function issueScore(entry, risk) {
  return (
    (risk?.riskScore || 0) +
    entry.highPriorityPrintCandidateCount * 5 +
    entry.printCandidateCount * 2 +
    entry.verifiedPrivateRecordCount * 3 +
    Math.min(entry.publicStatementCount, 20) +
    Math.min(entry.dailyDiaryBackupReferenceCount, 10)
  );
}

function issueRecommendedUse(entry, risk) {
  if (entry.highPriorityPrintCandidateCount && ["Critical", "High"].includes(risk?.riskLevel || "")) {
    return "Use this issue-country cluster to test top OCR leads against a thin or risky chapter chronology.";
  }
  if (!entry.verifiedPrivateRecordCount && entry.printCandidateCount) {
    return "Use this as a candidate issue trail where no released private memcon/telcon currently anchors the chapter.";
  }
  if (entry.verifiedPrivateRecordCount && entry.printCandidateCount) {
    return "Compare print leads against verified private records before deciding whether the issue needs additional printed documents or annotation.";
  }
  if (entry.publicStatementCount && !entry.verifiedPrivateRecordCount) {
    return "Use public statements as a signpost for possible private-record gaps and annotation needs.";
  }
  return "Retain as context for chapter annotation, chronology checking, or source-note review.";
}

function workplanPriorityRank(priority) {
  return { Critical: 0, High: 1, Medium: 2, Monitor: 3, Review: 4, Reference: 5 }[priority] ?? 9;
}

function workplanList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function firstWorkplanLink(value) {
  return workplanList(value).find((item) => /^https?:\/\//i.test(item)) || "";
}

function workplanRow({
  sortKey,
  priority,
  workstream,
  country = "",
  issue = "",
  dateOrSpan = "",
  titleOrScope = "",
  evidenceCount = "",
  privateRecordCount = "",
  highPriorityPrintLeads = "",
  publicStatementCount = "",
  sourceOrFolder = "",
  relatedExport = "",
  relatedRankOrId = "",
  recommendedAction = "",
  whyItMatters = "",
  links = []
}) {
  const linkList = workplanList(links);
  return {
    _sort_key: sortKey,
    priority: priority || "Review",
    workstream,
    country,
    issue,
    date_or_span: dateOrSpan,
    title_or_scope: titleOrScope,
    evidence_count: evidenceCount,
    private_record_count: privateRecordCount,
    high_priority_print_leads: highPriorityPrintLeads,
    public_statement_count: publicStatementCount,
    source_or_folder: sourceOrFolder,
    related_export: relatedExport,
    related_rank_or_id: relatedRankOrId,
    recommended_action: recommendedAction,
    why_it_matters: whyItMatters,
    first_link: firstWorkplanLink(linkList),
    supporting_links: linkList.slice(0, 8)
  };
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

function ledgerKeyPart(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function ledgerSourceKey(fields) {
  return [
    fields.sourceFamily,
    fields.recordGroupOrCollection,
    fields.series,
    fields.subseriesOrFileGroup,
    fields.folderOrFileId,
    fields.folderNaid,
    fields.folderTitle,
    fields.pdfUrl
  ]
    .map(ledgerKeyPart)
    .join("|");
}

function newLedgerEntry(fields) {
  return {
    sourceFamily: fields.sourceFamily || "",
    repository: fields.repository || "",
    recordGroupOrCollection: fields.recordGroupOrCollection || "",
    series: fields.series || "",
    subseriesOrFileGroup: fields.subseriesOrFileGroup || "",
    folderTitle: fields.folderTitle || "",
    folderOrFileId: fields.folderOrFileId || "",
    folderNaid: fields.folderNaid || "",
    parentCollectionNaid: fields.parentCollectionNaid || "",
    catalogUrl: fields.catalogUrl || "",
    pdfUrl: fields.pdfUrl || "",
    parentCollectionUrl: fields.parentCollectionUrl || "",
    provenanceTrail: new Set(fields.provenanceTrail || []),
    countries: new Set(),
    years: new Set(),
    dates: [],
    evidenceClasses: new Set(),
    accessStatuses: new Set(),
    foiaNumbers: new Set(),
    sourceNoteStatuses: new Set(),
    sourceNotes: new Set(),
    candidatePageStarts: new Set(),
    privateTitles: [],
    duplicatePrivateTitles: [],
    printTitles: [],
    diaryTitles: [],
    verifiedPrivateRecordCount: 0,
    duplicatePrivateRecordCount: 0,
    printCandidateCount: 0,
    highPriorityPrintCandidateCount: 0,
    dailyDiaryBackupReferenceCount: 0,
    verifiedPrivatePageTotal: 0,
    duplicateSourcePageTotal: 0
  };
}

function sourceLedgerEntry(ledger, fields) {
  const key = ledgerSourceKey(fields);
  if (!ledger.has(key)) ledger.set(key, newLedgerEntry(fields));
  const entry = ledger.get(key);
  for (const field of ["catalogUrl", "pdfUrl", "parentCollectionUrl", "parentCollectionNaid", "folderNaid"]) {
    if (!entry[field] && fields[field]) entry[field] = fields[field];
  }
  for (const trail of fields.provenanceTrail || []) entry.provenanceTrail.add(trail);
  return entry;
}

function addSourceLedgerEvidence(ledger, fields, evidence) {
  const entry = sourceLedgerEntry(ledger, fields);
  entry.evidenceClasses.add(evidence.evidenceClass);
  for (const country of evidence.countries || []) entry.countries.add(country);
  const date = normalizedDate(evidence.date);
  if (date) {
    entry.dates.push(date);
    entry.years.add(date.slice(0, 4));
  } else if (evidence.year) {
    entry.years.add(evidence.year);
  }
  if (evidence.accessStatus) entry.accessStatuses.add(evidence.accessStatus);
  if (evidence.foiaNumber) entry.foiaNumbers.add(evidence.foiaNumber);
  if (evidence.sourceNoteStatus) entry.sourceNoteStatuses.add(evidence.sourceNoteStatus);
  if (evidence.sourceNote) entry.sourceNotes.add(evidence.sourceNote);
  if (evidence.pageStart) entry.candidatePageStarts.add(evidence.pageStart);

  const sample = [date || evidence.date, evidence.title].filter(Boolean).join(" - ");
  if (evidence.evidenceClass === "Verified private record") {
    entry.verifiedPrivateRecordCount += 1;
    entry.verifiedPrivatePageTotal += Number(evidence.pageCount || 0);
    entry.privateTitles.push(sample);
  } else if (evidence.evidenceClass === "Duplicate private source") {
    entry.duplicatePrivateRecordCount += 1;
    entry.duplicateSourcePageTotal += Number(evidence.pageCount || 0);
    entry.duplicatePrivateTitles.push(sample);
  } else if (evidence.evidenceClass === "Print-candidate lead") {
    entry.printCandidateCount += 1;
    if (evidence.priority === "High") entry.highPriorityPrintCandidateCount += 1;
    entry.printTitles.push([date || evidence.date, evidence.priority, evidence.title].filter(Boolean).join(" - "));
  } else if (evidence.evidenceClass === "Daily diary/backup reference") {
    entry.dailyDiaryBackupReferenceCount += 1;
    entry.diaryTitles.push(sample);
  }
}

function privateLedgerSourceFields(record) {
  const source = record.source || {};
  const sheet = source.provenanceSheet || {};
  const scowcroft = source.name === "Brent Scowcroft Papers";
  return {
    sourceFamily: scowcroft ? "Brent Scowcroft Papers" : "Presidential memcon/telcon files",
    repository: source.referenceUnit || "George H.W. Bush Library",
    recordGroupOrCollection: scowcroft ? sheet.recordGroupCollection || source.name || "" : source.name || "",
    series: source.series || sheet.series || "",
    subseriesOrFileGroup: sheet.subseries || source.priorityCollection?.name || "",
    folderTitle: sheet.folderTitle || source.fileUnitTitle || record.sourceTitle || record.localIdentifier || "",
    folderOrFileId: sheet.folderIdNumber || source.fileUnitNaid || record.localIdentifier || "",
    folderNaid: source.fileUnitNaid || record.naid || "",
    parentCollectionNaid: source.seriesNaid || source.priorityCollection?.naid || "",
    catalogUrl: record.catalogUrl || source.url || "",
    pdfUrl: record.pdfUrl || source.objectUrl || "",
    parentCollectionUrl: source.seriesUrl || source.priorityCollection?.url || source.url || "",
    provenanceTrail: [
      source.name,
      source.series,
      sheet.subseries,
      sheet.folderIdNumber,
      sheet.folderTitle,
      source.priorityCollection?.name
    ].filter(Boolean)
  };
}

function duplicateLedgerSourceFields(record, duplicate) {
  const sheet = duplicate.provenanceSheet || {};
  return {
    sourceFamily: "Brent Scowcroft duplicate source",
    repository: "George H.W. Bush Library",
    recordGroupOrCollection: sheet.recordGroupCollection || duplicate.sourceName || "Brent Scowcroft Papers",
    series: duplicate.series || sheet.series || "",
    subseriesOrFileGroup: sheet.subseries || "",
    folderTitle: sheet.folderTitle || duplicate.localIdentifier || "",
    folderOrFileId: sheet.folderIdNumber || duplicate.localIdentifier || "",
    folderNaid: duplicate.naid || "",
    parentCollectionNaid: "4522156",
    catalogUrl: duplicate.catalogUrl || "",
    pdfUrl: duplicate.pdfUrl || "",
    parentCollectionUrl: "https://catalog.archives.gov/id/4522156",
    provenanceTrail: [
      duplicate.sourceName,
      duplicate.series,
      sheet.subseries,
      sheet.folderIdNumber,
      sheet.folderTitle,
      duplicate.sourcePages ? `Source-folder pages ${duplicate.sourcePages}` : ""
    ].filter(Boolean)
  };
}

function printLedgerSourceFields(candidate) {
  const source = candidate.sourceSeries || {};
  return {
    sourceFamily: source.name || exportCandidateSource(candidate),
    repository: "George H.W. Bush Library",
    recordGroupOrCollection: source.name || exportCandidateSource(candidate),
    series: source.name || exportCandidateSource(candidate),
    subseriesOrFileGroup: candidate.localIdentifier || "",
    folderTitle: candidate.folderTitle || "",
    folderOrFileId: candidate.localIdentifier || candidate.folderNaid || "",
    folderNaid: candidate.folderNaid || "",
    parentCollectionNaid: source.naid || "",
    catalogUrl: candidate.catalogUrl || "",
    pdfUrl: candidate.pdfUrl || "",
    parentCollectionUrl: source.url || "",
    provenanceTrail: [source.name, candidate.localIdentifier, candidate.folderTitle].filter(Boolean)
  };
}

function diaryLedgerSourceFields(reference) {
  const source = reference.sourceSeries || {};
  return {
    sourceFamily: "Presidential Daily Diary and Backup",
    repository: source.repository || "George H.W. Bush Library",
    recordGroupOrCollection: source.collection || source.recordGroup || "",
    series: source.name || "",
    subseriesOrFileGroup: reference.sourceType || "",
    folderTitle: reference.title || "",
    folderOrFileId: reference.localIdentifier || reference.naid || "",
    folderNaid: reference.naid || "",
    parentCollectionNaid: source.naid || source.collectionNaid || "",
    catalogUrl: reference.catalogUrl || "",
    pdfUrl: reference.pdfUrl || "",
    parentCollectionUrl: source.url || source.collectionUrl || "",
    provenanceTrail: [source.recordGroup, source.collection, source.name, reference.sourceType, reference.localIdentifier].filter(Boolean)
  };
}

function ledgerDateSpan(dates) {
  const sorted = sortedUnique(dates);
  if (!sorted.length) return "";
  return sorted[0] === sorted[sorted.length - 1] ? sorted[0] : `${sorted[0]} to ${sorted[sorted.length - 1]}`;
}

function ledgerPriority(entry, risk) {
  if (entry.highPriorityPrintCandidateCount && ["Critical", "High"].includes(risk?.riskLevel || "")) return "Critical";
  if (entry.highPriorityPrintCandidateCount >= 3 || (entry.printCandidateCount && !entry.verifiedPrivateRecordCount)) return "High";
  if (entry.verifiedPrivateRecordCount || entry.duplicatePrivateRecordCount) return "Medium";
  if (entry.dailyDiaryBackupReferenceCount) return "Reference";
  return "Monitor";
}

function ledgerRecommendedUse(entry, risk) {
  if (entry.highPriorityPrintCandidateCount && ["Critical", "High"].includes(risk?.riskLevel || "")) {
    return "Start here: verify high-priority OCR leads against page images, then compare with country chronology and gap audit.";
  }
  if (entry.printCandidateCount && !entry.verifiedPrivateRecordCount) {
    return "Use this folder to test whether print leads fill a country or year with thin private-record coverage.";
  }
  if (entry.verifiedPrivateRecordCount && entry.duplicatePrivateRecordCount) {
    return "Use as verified private-record source and compare duplicate Scowcroft holdings/provenance before final citation.";
  }
  if (entry.verifiedPrivateRecordCount) {
    return "Use as the folder-level provenance anchor for released memcons/telcons in the chronology.";
  }
  if (entry.dailyDiaryBackupReferenceCount) {
    return "Use to confirm timing, participants, call status, and backup packets around candidate documents.";
  }
  return "Retain as a source-control row for provenance review.";
}

function sortedUnique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function recordDateValue(record) {
  return record.sortDate || record.date || "";
}

function exportCountryRank(country) {
  const rank = EXPORT_CHAPTER_ORDER.indexOf(country);
  return rank === -1 ? 999 : rank;
}

function exportPrimaryCountry(countries) {
  return [...(countries || [])]
    .filter((country) => country !== "United States")
    .sort((a, b) => exportCountryRank(a) - exportCountryRank(b))[0] || "Regional/No single country";
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
  if (match && EXPORT_MONTHS[match[1].toLowerCase()] !== undefined) {
    return new Date(Date.UTC(Number(match[3]), EXPORT_MONTHS[match[1].toLowerCase()], Number(match[2])));
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
  const source = exportCandidateSource(candidate);
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
      sharedCountries: sharedExportCountries(candidate, record)
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

function sharedExportCountries(left, right) {
  const leftCountries = new Set(exportCountries(left));
  return exportCountries(right).filter((country) => leftCountries.has(country));
}

function contextLabel(item, dateField = "documentDate") {
  return [item[dateField] || item.sortDate || "", item.documentTitle || item.title || ""].filter(Boolean).join(" - ");
}

function annotationPriorityRank(priority) {
  return { High: 0, Medium: 1, Reference: 2 }[priority] ?? 9;
}

function annotationRow({
  priority,
  annotationType,
  anchorRecord,
  contextDate = "",
  distanceDays = "",
  contextTitle = "",
  contextSource = "",
  contextPriorityOrStatus = "",
  issueOrTheme = "",
  recommendedUse = "",
  sourceNote = "",
  contextLink = "",
  contextRecordId = ""
}) {
  return {
    annotation_order: "",
    priority,
    annotation_type: annotationType,
    anchor_chapter_country: anchorRecord.chapter?.name || exportPrimaryCountry(exportCountries(anchorRecord)),
    anchor_date: recordDateValue(anchorRecord),
    anchor_document_type: anchorRecord.type || "",
    anchor_title: anchorRecord.documentTitle || anchorRecord.title || "",
    context_date: contextDate,
    context_distance_days: distanceDays,
    context_title: contextTitle,
    context_source: contextSource,
    context_priority_or_status: contextPriorityOrStatus,
    issue_or_theme: issueOrTheme,
    recommended_annotation_use: recommendedUse,
    source_note: sourceNote,
    anchor_pdf_url: anchorRecord.pdfUrl || "",
    anchor_catalog_url: anchorRecord.catalogUrl || "",
    context_link: contextLink,
    anchor_record_id: anchorRecord.id || "",
    context_record_id: contextRecordId
  };
}

function nearbyPrintCandidates(record, candidates, maxDays) {
  return candidates
    .map((candidate) => ({
      candidate,
      distance: dayDistance(recordDateValue(record), candidate.documentDate),
      sharedCountries: sharedExportCountries(record, candidate)
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
      sharedCountries: sharedExportCountries(record, statement)
    }))
    .filter((item) => item.distance !== null && Math.abs(item.distance) <= maxDays && item.sharedCountries.length)
    .sort(
      (a, b) =>
        Math.abs(a.distance) - Math.abs(b.distance) ||
        (a.statement.documentDate || a.statement.sortDate || "").localeCompare(b.statement.documentDate || b.statement.sortDate || "") ||
        (a.statement.title || "").localeCompare(b.statement.title || "")
    );
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

function documentContextExportRows() {
  const memcons = window.MEMCONS || [];
  const printCandidates = [
    ...(window.CHRONOLOGICAL_PRINT_CANDIDATES || []),
    ...(window.SUBJECT_PRINT_CANDIDATES || []),
    ...(window.DEAL_PRINT_CANDIDATES || [])
  ];
  const publicStatements = window.PUBLIC_STATEMENTS || [];
  const riskMap = riskByCountry();

  return [...memcons]
    .sort(
      (a, b) =>
        exportChapterNumber(a) - exportChapterNumber(b) ||
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
        source_bucket: exportSourceLabel(record),
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

function annotationRegisterExportRows() {
  const memcons = window.MEMCONS || [];
  const printCandidates = [
    ...(window.CHRONOLOGICAL_PRINT_CANDIDATES || []),
    ...(window.SUBJECT_PRINT_CANDIDATES || []),
    ...(window.DEAL_PRINT_CANDIDATES || [])
  ];
  const publicStatements = window.PUBLIC_STATEMENTS || [];
  const riskMap = riskByCountry();
  const rows = [];

  for (const record of memcons) {
    const risk = bestCountryRisk(record.countries || [], riskMap);

    if (/partial/i.test(record.releaseStatus || "")) {
      rows.push(
        annotationRow({
          priority: ["Critical", "High"].includes(risk?.riskLevel || "") ? "High" : "Medium",
          annotationType: "Partial release / alternate-copy check",
          anchorRecord: record,
          contextDate: recordDateValue(record),
          contextTitle: record.documentTitle || record.title || "",
          contextSource: exportSourceLabel(record),
          contextPriorityOrStatus: record.releaseStatus || "",
          issueOrTheme: selectionThemes(record),
          recommendedUse:
            "Before printing or annotating this document, check parallel Scowcroft, backup, later-release, or agency files for a less-redacted copy.",
          sourceNote: record.sourceNote || "",
          contextLink: record.pdfUrl || record.catalogUrl || "",
          contextRecordId: record.id || ""
        })
      );
    }

    for (const reference of record.dailyDiaryReferences || []) {
      rows.push(
        annotationRow({
          priority: reference.empty ? "Reference" : "Medium",
          annotationType: reference.empty ? "Daily Diary empty-file check" : "Daily Diary/backup timing support",
          anchorRecord: record,
          contextDate: recordDateValue(record),
          distanceDays: 0,
          contextTitle: reference.title || "",
          contextSource: reference.type || "Presidential Daily Diary/Backup",
          contextPriorityOrStatus: reference.accessRestriction || "",
          issueOrTheme: selectionThemes(record),
          recommendedUse: reference.empty
            ? "Use only to confirm that the diary file was empty or that no schedule detail is presently available."
            : "Use to confirm timing, call/meeting status, participants, or backup packet context for a possible source note or editorial note.",
          sourceNote: reference.sourceNote || "",
          contextLink: reference.pdfUrl || reference.catalogUrl || "",
          contextRecordId: reference.naid || ""
        })
      );
    }

    for (const item of nearbyPublicStatements(record, publicStatements, 7).slice(0, 8)) {
      const statement = item.statement;
      rows.push(
        annotationRow({
          priority: Math.abs(item.distance) <= 1 ? "Medium" : "Reference",
          annotationType: "Nearby public statement",
          anchorRecord: record,
          contextDate: statement.documentDate || statement.sortDate || "",
          distanceDays: item.distance,
          contextTitle: statement.title || "",
          contextSource: "Public Papers of the Presidents",
          contextPriorityOrStatus: statement.documentType || "",
          issueOrTheme: statement.countries || [],
          recommendedUse:
            "Compare the public line with the private conversation; use for annotation when it explains public posture, timing, or follow-up.",
          sourceNote: statement.sourceNote || "",
          contextLink: statement.pageLink || statement.pdfUrl || statement.detailsUrl || "",
          contextRecordId: statement.id || ""
        })
      );
    }

    for (const item of nearbyPrintCandidates(record, printCandidates, 14).filter((lead) => lead.candidate.priority === "High").slice(0, 8)) {
      const candidate = item.candidate;
      rows.push(
        annotationRow({
          priority: Math.abs(item.distance) <= 3 ? "High" : "Medium",
          annotationType: "Nearby high-priority print lead",
          anchorRecord: record,
          contextDate: candidate.documentDate || "",
          distanceDays: item.distance,
          contextTitle: candidate.documentTitle || "",
          contextSource: exportCandidateSource(candidate),
          contextPriorityOrStatus: [candidate.priority, candidate.score].filter(Boolean).join(" / "),
          issueOrTheme: candidate.themes || [],
          recommendedUse:
            "Verify the page image/OCR and decide whether this lead should be printed, used as annotation context, or ruled out against the anchor document.",
          sourceNote: candidate.sourceNote || "",
          contextLink: candidate.pageLink || candidate.pdfUrl || candidate.catalogUrl || "",
          contextRecordId: candidate.id || ""
        })
      );
    }
  }

  return rows
    .sort(
      (a, b) =>
        annotationPriorityRank(a.priority) - annotationPriorityRank(b.priority) ||
        exportCountryRank(a.anchor_chapter_country) - exportCountryRank(b.anchor_chapter_country) ||
        timelineSortValue(a.anchor_date).localeCompare(timelineSortValue(b.anchor_date)) ||
        Math.abs(Number(a.context_distance_days) || 0) - Math.abs(Number(b.context_distance_days) || 0) ||
        String(a.annotation_type || "").localeCompare(String(b.annotation_type || "")) ||
        String(a.context_title || "").localeCompare(String(b.context_title || ""))
    )
    .map((row, index) => ({ ...row, annotation_order: index + 1 }));
}

function timelineSortValue(value) {
  return normalizedDate(value) || "9999-99-99";
}

function evidenceTimelineExportRows() {
  const rows = [];
  const printCandidates = [
    ...(window.CHRONOLOGICAL_PRINT_CANDIDATES || []),
    ...(window.SUBJECT_PRINT_CANDIDATES || []),
    ...(window.DEAL_PRINT_CANDIDATES || [])
  ];

  for (const record of window.MEMCONS || []) {
    const countries = exportCountries(record);
    rows.push({
      sort_date: normalizedDate(recordDateValue(record)),
      display_date: record.date || "",
      volume_date_scope: volumeDateScope(recordDateValue(record)),
      countries,
      primary_chapter_country: record.chapter?.name || exportPrimaryCountry(countries),
      record_class: "Declassified memcon/telcon",
      document_type: record.type || "",
      title: record.documentTitle || record.title || "",
      subject_or_context: record.subjectLine || record.title || "",
      priority_or_status: record.releaseStatus || "",
      score: "",
      page_count_or_range: record.pageCount || 0,
      source_collection: record.source?.name || "",
      source_series: exportSourceLabel(record),
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
    const countries = exportCountries(candidate);
    rows.push({
      sort_date: normalizedDate(candidate.documentDate),
      display_date: candidate.documentDate || "",
      volume_date_scope: volumeDateScope(candidate.documentDate),
      countries,
      primary_chapter_country: exportPrimaryCountry(countries),
      record_class: "Print-candidate lead",
      document_type: candidate.documentType || "",
      title: candidate.documentTitle || "",
      subject_or_context: candidate.reviewReason || candidate.ocrSnippet || "",
      priority_or_status: candidate.priority || "",
      score: candidate.score || "",
      page_count_or_range: [candidate.pageStart, candidate.pageEnd].filter(Boolean).join("-"),
      source_collection: "George H.W. Bush Library",
      source_series: exportCandidateSource(candidate),
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

  for (const reference of window.DAILY_DIARY_REFERENCES || []) {
    const countries = exportCountries(reference);
    rows.push({
      sort_date: normalizedDate(reference.date),
      display_date: reference.catalogDate || reference.date || "",
      volume_date_scope: volumeDateScope(reference.date),
      countries,
      primary_chapter_country: exportPrimaryCountry(countries),
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

  for (const statement of window.PUBLIC_STATEMENTS || []) {
    const countries = exportCountries(statement);
    rows.push({
      sort_date: normalizedDate(statement.sortDate || statement.documentDate),
      display_date: statement.documentDate || statement.sortDate || "",
      volume_date_scope: volumeDateScope(statement.sortDate || statement.documentDate),
      countries,
      primary_chapter_country: exportPrimaryCountry(countries),
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
      exportCountryRank(a.primary_chapter_country) - exportCountryRank(b.primary_chapter_country) ||
      String(a.record_class || "").localeCompare(String(b.record_class || "")) ||
      String(a.title || "").localeCompare(String(b.title || ""))
  );
}

function citationWorkbenchExportRows() {
  const rows = [];
  const printCandidates = [
    ...(window.CHRONOLOGICAL_PRINT_CANDIDATES || []),
    ...(window.SUBJECT_PRINT_CANDIDATES || []),
    ...(window.DEAL_PRINT_CANDIDATES || [])
  ];

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

  for (const record of window.MEMCONS || []) {
    const source = record.source || {};
    const provenance = source.provenanceSheet || {};
    const countries = exportCountries(record);
    const recordClass = "Declassified memcon/telcon";
    const date = recordDateValue(record);
    const primaryCountry = record.chapter?.name || exportPrimaryCountry(countries);

    pushRow({
      recordClass,
      countries,
      primaryCountry,
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
    const countries = exportCountries(candidate);
    const recordClass = "Print-candidate lead";
    const date = candidate.documentDate || "";
    const primaryCountry = exportPrimaryCountry(countries);
    const pageRange = [candidate.pageStart, candidate.pageEnd].filter(Boolean).join("-");

    pushRow({
      recordClass,
      countries,
      primaryCountry,
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
      series: exportCandidateSource(candidate),
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

  for (const reference of window.DAILY_DIARY_REFERENCES || []) {
    const countries = exportCountries(reference);
    const recordClass = "Daily diary/backup reference";
    const date = reference.date || "";
    const primaryCountry = exportPrimaryCountry(countries);

    pushRow({
      recordClass,
      countries,
      primaryCountry,
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

  for (const statement of window.PUBLIC_STATEMENTS || []) {
    const countries = exportCountries(statement);
    const recordClass = "Public statement";
    const date = statement.sortDate || statement.documentDate || "";
    const primaryCountry = exportPrimaryCountry(countries);

    pushRow({
      recordClass,
      countries,
      primaryCountry,
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
      exportCountryRank(a.primary_chapter_country) - exportCountryRank(b.primary_chapter_country) ||
      timelineSortValue(a.sort_date).localeCompare(timelineSortValue(b.sort_date)) ||
      String(a.record_class || "").localeCompare(String(b.record_class || "")) ||
      String(a.title || "").localeCompare(String(b.title || ""))
  );
}

function selectionMatrixExportRows() {
  const memcons = window.MEMCONS || [];
  const printCandidates = [
    ...(window.CHRONOLOGICAL_PRINT_CANDIDATES || []),
    ...(window.SUBJECT_PRINT_CANDIDATES || []),
    ...(window.DEAL_PRINT_CANDIDATES || [])
  ];
  const publicStatements = window.PUBLIC_STATEMENTS || [];
  const riskMap = riskByCountry();
  const rows = [];

  for (const record of memcons) {
    const countries = exportCountries(record);
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
      primaryCountry: record.chapter?.name || exportPrimaryCountry(countries),
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
      source_series: exportSourceLabel(record),
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
    const countries = exportCountries(candidate);
    const risk = bestCountryRisk(candidate.countries || [], riskMap);
    const privateNeighbors = nearbyPrivateRecords(candidate, memcons, 14);
    const citationFields = {
      recordClass: "Print-candidate lead",
      date: candidate.documentDate || "",
      title: candidate.documentTitle || "",
      pdfUrl: candidate.pdfUrl || "",
      catalogUrl: candidate.catalogUrl || "",
      volumeScope: volumeDateScope(candidate.documentDate),
      primaryCountry: exportPrimaryCountry(countries),
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
      source_series: exportCandidateSource(candidate),
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
        exportCountryRank(a.primary_chapter_country) - exportCountryRank(b.primary_chapter_country) ||
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

function coverageMatrixExportRows() {
  const years = ["1989", "1990", "1991", "1992"];
  const memcons = window.MEMCONS || [];
  const printCandidates = [
    ...(window.CHRONOLOGICAL_PRINT_CANDIDATES || []),
    ...(window.SUBJECT_PRINT_CANDIDATES || []),
    ...(window.DEAL_PRINT_CANDIDATES || [])
  ];
  const publicStatements = window.PUBLIC_STATEMENTS || [];
  const diaryReferences = window.DAILY_DIARY_REFERENCES || [];
  const riskMap = riskByCountry();

  return EXPORT_CHAPTER_ORDER.flatMap((country, countryIndex) => {
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
      const countryDiary = diaryReferences.filter(
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
        private_source_mix: countSummary(countryRecords.map(exportSourceLabel)),
        private_record_titles: countryRecords
          .sort((a, b) => recordDateValue(a).localeCompare(recordDateValue(b)) || (a.title || "").localeCompare(b.title || ""))
          .map((record) => [record.date, record.type, record.subjectLine || record.title || record.documentTitle].filter(Boolean).join(" - ")),
        print_candidate_count: countryPrint.length,
        high_priority_print_candidates: highPrint.length,
        medium_priority_print_candidates: mediumPrint.length,
        undated_or_out_of_scope_country_print_candidates: outOfGridPrint.length,
        undated_or_out_of_scope_high_priority_print_candidates: outOfGridHighPrint.length,
        print_source_mix: countSummary(countryPrint.map(exportCandidateSource)),
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

function sourceLedgerExportRows() {
  const ledger = new Map();
  const riskMap = riskByCountry();
  const memcons = window.MEMCONS || [];
  const printCandidates = [
    ...(window.CHRONOLOGICAL_PRINT_CANDIDATES || []),
    ...(window.SUBJECT_PRINT_CANDIDATES || []),
    ...(window.DEAL_PRINT_CANDIDATES || [])
  ];
  const diaryReferences = window.DAILY_DIARY_REFERENCES || [];

  for (const record of memcons) {
    addSourceLedgerEvidence(ledger, privateLedgerSourceFields(record), {
      evidenceClass: "Verified private record",
      countries: exportCountries(record),
      date: recordDateValue(record),
      title: record.subjectLine || record.title || record.documentTitle,
      accessStatus: record.releaseStatus || "",
      foiaNumber: foiaNumberFromText(record.sourceNote, record.provenanceNote, record.source?.foiaNumber),
      sourceNoteStatus: citationStatus("Declassified memcon/telcon", record.sourceNote || ""),
      sourceNote: record.sourceNote || "",
      pageCount: record.pageCount || 0
    });

    for (const duplicate of record.source?.duplicateSources || []) {
      addSourceLedgerEvidence(ledger, duplicateLedgerSourceFields(record, duplicate), {
        evidenceClass: "Duplicate private source",
        countries: exportCountries(record),
        date: recordDateValue(record),
        title: `${record.subjectLine || record.title || record.documentTitle || "Memcon/telcon"} (${duplicate.sourcePages || "source pages"})`,
        accessStatus: record.releaseStatus || "",
        foiaNumber: foiaNumberFromText(duplicate.sourceNote, duplicate.provenanceSheet?.foiaNumber),
        sourceNoteStatus: citationStatus("Declassified memcon/telcon", duplicate.sourceNote || ""),
        sourceNote: duplicate.sourceNote || "",
        pageCount: duplicate.pageCount || 0
      });
    }
  }

  for (const candidate of printCandidates) {
    addSourceLedgerEvidence(ledger, printLedgerSourceFields(candidate), {
      evidenceClass: "Print-candidate lead",
      countries: exportCountries(candidate),
      date: candidate.documentDate || "",
      title: candidate.documentTitle || "",
      accessStatus: candidate.accessRestriction || "",
      foiaNumber: foiaNumberFromText(candidate.sourceNote),
      sourceNoteStatus: citationStatus("Print-candidate lead", candidate.sourceNote || ""),
      sourceNote: candidate.sourceNote || "",
      pageStart: candidate.pageStart || "",
      priority: candidate.priority || ""
    });
  }

  for (const reference of diaryReferences) {
    addSourceLedgerEvidence(ledger, diaryLedgerSourceFields(reference), {
      evidenceClass: "Daily diary/backup reference",
      countries: exportCountries(reference),
      date: reference.date || "",
      title: reference.title || "",
      accessStatus: reference.accessRestriction || "",
      foiaNumber: foiaNumberFromText(reference.sourceNote),
      sourceNoteStatus: citationStatus("Daily diary/backup reference", reference.sourceNote || ""),
      sourceNote: reference.sourceNote || ""
    });
  }

  return [...ledger.values()]
    .map((entry) => {
      const countries = sortedUnique([...entry.countries]);
      const risk = bestCountryRisk(countries, riskMap);
      const priority = ledgerPriority(entry, risk);
      return {
        review_priority: priority,
        country_risk_level: risk?.riskLevel || "",
        country_risk_score: risk?.riskScore || "",
        source_family: entry.sourceFamily,
        repository: entry.repository,
        record_group_or_collection: entry.recordGroupOrCollection,
        series: entry.series,
        subseries_or_file_group: entry.subseriesOrFileGroup,
        folder_title: entry.folderTitle,
        folder_or_file_id: entry.folderOrFileId,
        folder_naid: entry.folderNaid,
        parent_collection_naid: entry.parentCollectionNaid,
        evidence_classes: sortedUnique([...entry.evidenceClasses]),
        countries,
        years: sortedUnique([...entry.years]),
        date_span: ledgerDateSpan(entry.dates),
        verified_private_record_count: entry.verifiedPrivateRecordCount,
        duplicate_private_source_count: entry.duplicatePrivateRecordCount,
        print_candidate_count: entry.printCandidateCount,
        high_priority_print_candidate_count: entry.highPriorityPrintCandidateCount,
        daily_diary_backup_reference_count: entry.dailyDiaryBackupReferenceCount,
        total_evidence_rows:
          entry.verifiedPrivateRecordCount +
          entry.duplicatePrivateRecordCount +
          entry.printCandidateCount +
          entry.dailyDiaryBackupReferenceCount,
        verified_private_page_total: entry.verifiedPrivatePageTotal,
        duplicate_source_page_total: entry.duplicateSourcePageTotal,
        print_candidate_page_starts: sortedUnique([...entry.candidatePageStarts]).join("; "),
        access_or_release_statuses: sortedUnique([...entry.accessStatuses]),
        foia_numbers: sortedUnique([...entry.foiaNumbers]),
        source_note_statuses: sortedUnique([...entry.sourceNoteStatuses]),
        sample_private_records: entry.privateTitles.slice(0, 12),
        sample_duplicate_private_sources: entry.duplicatePrivateTitles.slice(0, 12),
        sample_print_candidates: entry.printTitles.slice(0, 12),
        sample_diary_backup_references: entry.diaryTitles.slice(0, 12),
        recommended_compiler_use: ledgerRecommendedUse(entry, risk),
        catalog_url: entry.catalogUrl,
        pdf_url: entry.pdfUrl,
        parent_collection_url: entry.parentCollectionUrl,
        source_notes: sortedUnique([...entry.sourceNotes]).slice(0, 4),
        provenance_trail: sortedUnique([...entry.provenanceTrail])
      };
    })
    .sort(
      (a, b) =>
        riskRank(a.review_priority) - riskRank(b.review_priority) ||
        (Number(b.high_priority_print_candidate_count) || 0) - (Number(a.high_priority_print_candidate_count) || 0) ||
        (Number(b.print_candidate_count) || 0) - (Number(a.print_candidate_count) || 0) ||
        (Number(b.verified_private_record_count) || 0) - (Number(a.verified_private_record_count) || 0) ||
        String(a.source_family || "").localeCompare(String(b.source_family || "")) ||
        String(a.folder_title || "").localeCompare(String(b.folder_title || ""))
    )
    .map((row, index) => ({ ledger_rank: index + 1, ...row }));
}

function issueDossierExportRows() {
  const dossiers = new Map();
  const riskMap = riskByCountry();
  const memcons = window.MEMCONS || [];
  const printCandidates = [
    ...(window.CHRONOLOGICAL_PRINT_CANDIDATES || []),
    ...(window.SUBJECT_PRINT_CANDIDATES || []),
    ...(window.DEAL_PRINT_CANDIDATES || [])
  ];
  const publicStatements = window.PUBLIC_STATEMENTS || [];
  const diaryReferences = window.DAILY_DIARY_REFERENCES || [];

  for (const record of memcons) {
    const issues = evidenceIssues({
      themes: [...(record.topics || []), ...(record.frusTopics || [])],
      textValues: [record.title, record.documentTitle, record.subjectLine, record.participants || [], record.notes || []],
      forcePresidential: true
    });
    for (const issue of issues) {
      for (const country of issueCountries(record)) {
        addIssueDossierEvidence(dossiers, issue, country, {
          recordClass: "Verified private record",
          date: recordDateValue(record),
          title: record.subjectLine || record.title || record.documentTitle,
          source: exportSourceLabel(record),
          sourceFolder: record.sourceTitle || record.source?.fileUnitTitle || record.localIdentifier || "",
          recordId: record.id || "",
          link: record.pdfUrl || record.catalogUrl || ""
        });
      }
    }
  }

  for (const candidate of printCandidates) {
    const issues = evidenceIssues({
      themes: candidate.themes || [],
      textValues: [candidate.documentTitle, candidate.documentType, candidate.reviewReason, candidate.ocrSnippet],
      forcePresidential: /memcon|telcon|telephone|conversation/i.test([candidate.documentType, candidate.documentTitle].join(" "))
    });
    for (const issue of issues) {
      for (const country of issueCountries(candidate)) {
        addIssueDossierEvidence(dossiers, issue, country, {
          recordClass: "Print-candidate lead",
          date: candidate.documentDate || "",
          title: candidate.documentTitle || "",
          priority: candidate.priority || "",
          source: exportCandidateSource(candidate),
          sourceFolder: candidate.folderTitle || candidate.localIdentifier || "",
          recordId: candidate.id || "",
          link: candidate.pageLink || candidate.pdfUrl || candidate.catalogUrl || ""
        });
      }
    }
  }

  for (const statement of publicStatements) {
    const issues = evidenceIssues({
      textValues: [statement.title, statement.documentType, statement.snippet]
    });
    for (const issue of issues) {
      for (const country of issueCountries(statement)) {
        addIssueDossierEvidence(dossiers, issue, country, {
          recordClass: "Public statement",
          date: statement.sortDate || statement.documentDate || "",
          title: statement.title || "",
          source: "Public Papers of the Presidents",
          sourceFolder: statement.bookLabel || statement.packageId || "",
          recordId: statement.id || "",
          link: statement.pageLink || statement.pdfUrl || statement.detailsUrl || ""
        });
      }
    }
  }

  for (const reference of diaryReferences) {
    const issues = evidenceIssues({
      themes: reference.matchedTerms || [],
      textValues: [reference.title, reference.sourceType, reference.reviewReason, reference.linkedRecordTitles || []],
      forcePresidential: (reference.linkedRecordTitles || []).some((title) => /conversation|telephone|memcon|telcon/i.test(title))
    });
    for (const issue of issues) {
      for (const country of issueCountries(reference)) {
        addIssueDossierEvidence(dossiers, issue, country, {
          recordClass: "Daily diary/backup reference",
          date: reference.date || "",
          title: reference.title || "",
          source: reference.sourceType || "Daily Diary/Backup",
          sourceFolder: reference.localIdentifier || reference.title || "",
          recordId: reference.id || "",
          link: reference.pdfUrl || reference.catalogUrl || ""
        });
      }
    }
  }

  return [...dossiers.values()]
    .map((entry) => {
      const risk = riskMap.get(entry.country);
      const priority = issuePriority(entry, risk);
      const score = issueScore(entry, risk);
      const sortedPrivate = sortedUnique(entry.privateRecords);
      const sortedPrint = sortedUnique(entry.printLeads).sort(
        (a, b) => Number(b.includes("High")) - Number(a.includes("High")) || a.localeCompare(b)
      );
      const sortedStatements = sortedUnique(entry.publicStatements);
      const sortedDiary = sortedUnique(entry.diaryReferences);
      return {
        issue_rank: "",
        review_priority: priority,
        issue_score: score,
        issue: entry.issue.label,
        issue_id: entry.issue.id,
        primary_chapter_country: entry.country,
        country_risk_level: risk?.riskLevel || "",
        country_risk_score: risk?.riskScore || "",
        date_span: issueDateSpan(entry.dates),
        years: sortedUnique([...entry.years]),
        evidence_total: entry.evidenceTotal,
        verified_private_record_count: entry.verifiedPrivateRecordCount,
        print_candidate_count: entry.printCandidateCount,
        high_priority_print_candidate_count: entry.highPriorityPrintCandidateCount,
        public_statement_count: entry.publicStatementCount,
        daily_diary_backup_reference_count: entry.dailyDiaryBackupReferenceCount,
        no_private_anchor: entry.verifiedPrivateRecordCount ? "no" : "yes",
        public_private_mismatch_signal: entry.publicStatementCount && !entry.verifiedPrivateRecordCount ? "yes" : "no",
        source_mix: sortedUnique([...entry.sourceMix]),
        source_folders: sortedUnique([...entry.sourceFolders]).slice(0, 18),
        top_private_records: sortedPrivate.slice(0, 12),
        top_print_leads: sortedPrint.slice(0, 14),
        public_statement_examples: sortedStatements.slice(0, 10),
        daily_diary_backup_examples: sortedDiary.slice(0, 10),
        recommended_compiler_use: issueRecommendedUse(entry, risk),
        issue_search_terms: sortedUnique([...(entry.issue.themes || []), ...(entry.issue.keywords || [])]).slice(0, 18),
        links: sortedUnique([...entry.links]).slice(0, 14),
        record_ids: sortedUnique([...entry.recordIds]).slice(0, 30)
      };
    })
    .sort(
      (a, b) =>
        riskRank(a.review_priority) - riskRank(b.review_priority) ||
        (b.issue_score || 0) - (a.issue_score || 0) ||
        exportCountryRank(a.primary_chapter_country) - exportCountryRank(b.primary_chapter_country) ||
        String(a.issue || "").localeCompare(String(b.issue || ""))
    )
    .map((row, index) => ({ ...row, issue_rank: index + 1 }));
}

function compilerWorkplanExportRows() {
  const audit = window.COMPILER_GAPS || {};
  const riskMap = riskByCountry();
  const issueRows = issueDossierExportRows();
  const sourceRows = sourceLedgerExportRows();
  const selectionRows = selectionMatrixExportRows();
  const rows = [];

  for (const gap of audit.structuralGaps || []) {
    rows.push(
      workplanRow({
        sortKey: 1000 + workplanPriorityRank(gap.riskLevel) * 100,
        priority: gap.riskLevel || "Review",
        workstream: "Structural audit",
        titleOrScope: gap.title || "",
        evidenceCount: audit.summary?.highPriorityPrintCandidateCount || "",
        relatedExport: "compiler-review-queue.csv",
        relatedRankOrId: gap.title || "",
        recommendedAction: gap.recommendedAction || "",
        whyItMatters: gap.evidence || ""
      })
    );
  }

  for (const gap of audit.countryRisks || []) {
    rows.push(
      workplanRow({
        sortKey: 2000 + workplanPriorityRank(gap.riskLevel) * 100 - (gap.riskScore || 0),
        priority: gap.riskLevel || "Monitor",
        workstream: "Country coverage",
        country: gap.country || "",
        titleOrScope: `${gap.country || "Country"} chapter coverage`,
        evidenceCount: gap.riskSignals?.length || "",
        privateRecordCount: gap.privateRecordCount || 0,
        highPriorityPrintLeads: gap.highPriorityCandidateCount || 0,
        relatedExport: "coverage-matrix.csv; country-dossiers.csv; compiler-review-queue.csv",
        relatedRankOrId: gap.country || "",
        recommendedAction: workplanList(gap.recommendedActions).join(" "),
        whyItMatters: workplanList(gap.riskSignals).join(" ")
      })
    );
  }

  for (const issue of issueRows.filter((row) => ["Critical", "High"].includes(row.review_priority)).slice(0, 35)) {
    rows.push(
      workplanRow({
        sortKey: 3000 + workplanPriorityRank(issue.review_priority) * 100 + Number(issue.issue_rank || 0),
        priority: issue.review_priority,
        workstream: "Issue dossier",
        country: issue.primary_chapter_country || "",
        issue: issue.issue || "",
        dateOrSpan: issue.date_span || "",
        titleOrScope: `${issue.issue || "Issue"} - ${issue.primary_chapter_country || ""}`,
        evidenceCount: issue.evidence_total || "",
        privateRecordCount: issue.verified_private_record_count || 0,
        highPriorityPrintLeads: issue.high_priority_print_candidate_count || 0,
        publicStatementCount: issue.public_statement_count || 0,
        sourceOrFolder: workplanList(issue.source_folders).slice(0, 3),
        relatedExport: "issue-dossiers.csv; selection-matrix.csv; evidence-timeline.csv",
        relatedRankOrId: issue.issue_rank || "",
        recommendedAction: issue.recommended_compiler_use || "",
        whyItMatters: [
          `${issue.high_priority_print_candidate_count || 0} high-priority print leads`,
          `${issue.verified_private_record_count || 0} verified private records`,
          issue.no_private_anchor === "yes" ? "no private anchor" : ""
        ].filter(Boolean),
        links: issue.links || []
      })
    );
  }

  for (const source of sourceRows.filter((row) => ["Critical", "High"].includes(row.review_priority)).slice(0, 30)) {
    rows.push(
      workplanRow({
        sortKey: 4000 + workplanPriorityRank(source.review_priority) * 100 + Number(source.ledger_rank || 0),
        priority: source.review_priority,
        workstream: "Source-folder follow-up",
        country: source.countries || "",
        dateOrSpan: source.date_span || "",
        titleOrScope: source.folder_title || source.source_family || "",
        evidenceCount: source.total_evidence_rows || "",
        privateRecordCount: source.verified_private_record_count || 0,
        highPriorityPrintLeads: source.high_priority_print_candidate_count || 0,
        sourceOrFolder: [source.source_family, source.folder_title || source.folder_or_file_id].filter(Boolean).join(" - "),
        relatedExport: "archival-source-ledger.csv; print-candidates.csv",
        relatedRankOrId: source.ledger_rank || "",
        recommendedAction: source.recommended_compiler_use || "",
        whyItMatters: source.provenance_trail || "",
        links: [source.catalog_url, source.pdf_url, source.parent_collection_url].filter(Boolean)
      })
    );
  }

  for (const record of window.MEMCONS || []) {
    if (record.releaseStatus !== "Partial") continue;
    const countries = exportCountries(record);
    const risk = bestCountryRisk(countries, riskMap);
    rows.push(
      workplanRow({
        sortKey: 5000 + workplanPriorityRank(risk?.riskLevel || "Medium") * 100 - (risk?.riskScore || 0),
        priority: risk?.riskLevel || "Medium",
        workstream: "Partial release check",
        country: countries,
        dateOrSpan: record.date || "",
        titleOrScope: record.documentTitle || record.title || "",
        privateRecordCount: 1,
        sourceOrFolder: record.sourceTitle || "",
        relatedExport: "compiler-chronology.csv; citation-workbench.csv",
        relatedRankOrId: record.id || "",
        recommendedAction: "Check for less-redacted copies in Scowcroft files, backup material, or later releases before deciding print status.",
        whyItMatters: "Verified private record is marked Partial.",
        links: [record.pdfUrl, record.catalogUrl].filter(Boolean)
      })
    );
  }

  for (const item of selectionRows.filter((row) => row.record_class === "Print-candidate lead" && row.selection_band === "Top print lead").slice(0, 45)) {
    rows.push(
      workplanRow({
        sortKey: 6000 + Number(item.selection_rank || 0),
        priority: item.country_risk_level || "Review",
        workstream: "Top print lead",
        country: item.primary_chapter_country || item.countries || "",
        dateOrSpan: item.display_date || item.sort_date || "",
        titleOrScope: item.title || "",
        evidenceCount: item.selection_score || "",
        highPriorityPrintLeads: item.nearby_high_priority_print_lead_count || "",
        sourceOrFolder: item.source_folder_or_title || item.source_series || "",
        relatedExport: "selection-matrix.csv; print-candidates.csv",
        relatedRankOrId: item.selection_rank || item.record_id || "",
        recommendedAction: item.compiler_action || "",
        whyItMatters: item.selection_flags || item.subject_or_context || "",
        links: [item.page_link, item.pdf_url, item.catalog_or_details_url].filter(Boolean)
      })
    );
  }

  return rows
    .sort(
      (a, b) =>
        workplanPriorityRank(a.priority) - workplanPriorityRank(b.priority) ||
        (a._sort_key || 99999) - (b._sort_key || 99999) ||
        String(a.country || "").localeCompare(String(b.country || "")) ||
        String(a.title_or_scope || "").localeCompare(String(b.title_or_scope || ""))
    )
    .map((row, index) => {
      const { _sort_key, ...exportRow } = row;
      return { work_order: index + 1, ...exportRow };
    });
}

function personIndexExportRows() {
  const persons = window.PERSONS_DATA?.persons || [];
  const memcons = window.MEMCONS || [];
  const printCandidates = [
    ...(window.CHRONOLOGICAL_PRINT_CANDIDATES || []),
    ...(window.SUBJECT_PRINT_CANDIDATES || []),
    ...(window.DEAL_PRINT_CANDIDATES || [])
  ];
  const publicStatements = window.PUBLIC_STATEMENTS || [];
  const diaryReferences = window.DAILY_DIARY_REFERENCES || [];

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
    const diaryMentions = diaryReferences.filter((reference) =>
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
      ...verifiedRecords.flatMap(exportCountries),
      ...printMentions.flatMap(exportCountries),
      ...statementMentions.flatMap(exportCountries),
      ...diaryMentions.flatMap(exportCountries)
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
  attachExport('[data-export="workplan"]', "compiler-workplan.csv", compilerWorkplanExportRows());
  attachExport('[data-export="chronology"]', "compiler-chronology.csv", chronologyExportRows());
  attachExport('[data-export="documentContext"]', "document-context.csv", documentContextExportRows());
  attachExport('[data-export="annotationRegister"]', "annotation-register.csv", annotationRegisterExportRows());
  attachExport('[data-export="evidenceTimeline"]', "evidence-timeline.csv", evidenceTimelineExportRows());
  attachExport('[data-export="citationWorkbench"]', "citation-workbench.csv", citationWorkbenchExportRows());
  attachExport('[data-export="sourceLedger"]', "archival-source-ledger.csv", sourceLedgerExportRows());
  attachExport('[data-export="issueDossiers"]', "issue-dossiers.csv", issueDossierExportRows());
  attachExport('[data-export="selectionMatrix"]', "selection-matrix.csv", selectionMatrixExportRows());
  attachExport('[data-export="coverageMatrix"]', "coverage-matrix.csv", coverageMatrixExportRows());
  attachExport('[data-export="personIndex"]', "person-index.csv", personIndexExportRows());
  attachExport('[data-export="reviewQueue"]', "compiler-review-queue.csv", reviewQueueExportRows());
  attachExport('[data-export="countryDossiers"]', "country-dossiers.csv", countryDossierExportRows());
  attachExport('[data-export="printCandidates"]', "print-candidates.csv", printCandidateExportRows());
  attachExport('[data-export="dailyDiary"]', "daily-diary-references.csv", dailyDiaryExportRows());
  attachExport('[data-export="publicStatements"]', "public-statements.csv", publicStatementExportRows());
}

function workplanPreviewText(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join("; ");
  return String(value || "").trim();
}

function createWorkplanPreviewMeta(label, value) {
  const text = workplanPreviewText(value);
  if (!text) return null;
  const item = document.createElement("span");
  item.textContent = `${label}: ${text}`;
  return item;
}

function createWorkplanPreviewRow(row) {
  const article = document.createElement("article");
  article.className = "workplan-preview-row";

  const rank = document.createElement("div");
  rank.className = "workplan-preview-rank";
  const order = document.createElement("span");
  order.className = "workplan-preview-order";
  order.textContent = `#${row.work_order}`;
  const priority = document.createElement("span");
  priority.className = `workplan-preview-priority ${String(row.priority || "review").toLowerCase()}`;
  priority.textContent = row.priority || "Review";
  rank.append(order, priority);

  const body = document.createElement("div");
  body.className = "workplan-preview-body";
  const title = document.createElement("h4");
  title.textContent = row.title_or_scope || row.workstream || "Compiler workplan action";

  const meta = document.createElement("p");
  meta.className = "workplan-preview-meta";
  meta.append(
    ...[
      createWorkplanPreviewMeta("Stream", row.workstream),
      createWorkplanPreviewMeta("Country", row.country),
      createWorkplanPreviewMeta("Date", row.date_or_span),
      createWorkplanPreviewMeta("Export", row.related_export)
    ].filter(Boolean)
  );

  const action = document.createElement("p");
  action.className = "workplan-preview-action";
  action.textContent = row.recommended_action || "Review this row against the chronology and supporting exports.";

  const why = document.createElement("p");
  why.className = "workplan-preview-why";
  why.textContent = row.why_it_matters || "";

  body.append(title);
  if (meta.childNodes.length) body.append(meta);
  body.append(action);
  if (why.textContent) body.append(why);

  const link = workplanPreviewText(row.first_link);
  if (link) {
    const source = document.createElement("a");
    source.className = "workplan-preview-link";
    source.href = link;
    source.rel = "noreferrer";
    source.textContent = "Open source";
    body.append(source);
  }

  article.append(rank, body);
  return article;
}

function renderCompilerWorkplanPreview() {
  const root = document.querySelector("#workplan-preview-root");
  if (!root) return;

  const rows = compilerWorkplanExportRows();
  const topRows = rows.slice(0, 8);
  const criticalCount = rows.filter((row) => row.priority === "Critical").length;
  const highCount = rows.filter((row) => row.priority === "High").length;
  const summary = document.querySelector("#workplan-preview-summary");
  if (summary) {
    summary.textContent = `${rows.length} ranked actions; ${criticalCount} critical and ${highCount} high-priority rows in the full workplan.`;
  }

  root.replaceChildren();
  if (!topRows.length) {
    const empty = document.createElement("p");
    empty.className = "empty-chapter";
    empty.textContent = "No compiler workplan rows are available.";
    root.append(empty);
    return;
  }

  for (const row of topRows) {
    root.append(createWorkplanPreviewRow(row));
  }
}

function countryDossierPreviewList(value, limit = 2) {
  return workplanList(value).slice(0, limit);
}

function createCountryDossierMetric(label, value) {
  const text = workplanPreviewText(value);
  if (!text) return null;
  const item = document.createElement("span");
  item.textContent = `${label}: ${text}`;
  return item;
}

function createCountryDossierBullets(label, values) {
  const items = countryDossierPreviewList(values, 2);
  if (!items.length) return null;

  const block = document.createElement("div");
  block.className = "chapter-dossier-list";
  const heading = document.createElement("p");
  heading.textContent = label;
  const list = document.createElement("ul");
  for (const value of items) {
    const item = document.createElement("li");
    item.textContent = value;
    list.append(item);
  }
  block.append(heading, list);
  return block;
}

function createCountryDossierRow(row) {
  const article = document.createElement("article");
  article.className = "chapter-dossier-row";

  const rank = document.createElement("div");
  rank.className = "chapter-dossier-rank";
  const chapter = document.createElement("span");
  chapter.className = "chapter-dossier-number";
  chapter.textContent = `Chapter ${row.chapter_number}`;
  const risk = document.createElement("span");
  risk.className = `chapter-dossier-risk ${String(row.risk_level || "monitor").toLowerCase()}`;
  risk.textContent = row.risk_level || "Monitor";
  rank.append(chapter, risk);

  const body = document.createElement("div");
  body.className = "chapter-dossier-body";
  const title = document.createElement("h4");
  title.textContent = row.country || "Country";

  const metrics = document.createElement("p");
  metrics.className = "chapter-dossier-metrics";
  metrics.append(
    ...[
      createCountryDossierMetric("Private records", row.private_record_count),
      createCountryDossierMetric("Pages", row.private_page_count),
      createCountryDossierMetric("Missing years", row.private_years_missing),
      createCountryDossierMetric("High print leads", row.high_priority_print_candidates),
      createCountryDossierMetric("Public statements", row.public_statement_count),
      createCountryDossierMetric("Diary/backup", row.daily_diary_reference_count)
    ].filter(Boolean)
  );

  const dateSpan = createCountryDossierMetric("Private span", row.private_date_span);
  const sourceMix = createCountryDossierMetric("Private sources", countryDossierPreviewList(row.private_source_mix, 3));
  const secondary = document.createElement("p");
  secondary.className = "chapter-dossier-secondary";
  secondary.append(...[dateSpan, sourceMix].filter(Boolean));

  body.append(title);
  if (metrics.childNodes.length) body.append(metrics);
  if (secondary.childNodes.length) body.append(secondary);

  const riskSignals = createCountryDossierBullets("Risk signals", row.risk_signals);
  const actions = createCountryDossierBullets("Compiler actions", row.recommended_actions);
  if (riskSignals || actions) {
    const lists = document.createElement("div");
    lists.className = "chapter-dossier-lists";
    if (riskSignals) lists.append(riskSignals);
    if (actions) lists.append(actions);
    body.append(lists);
  }

  const link = document.createElement("a");
  link.className = "chapter-dossier-link";
  link.href = `#chapter-${String(row.country || "").toLowerCase().replace(/\s+/g, "-")}`;
  link.textContent = "Open chronology";
  body.append(link);

  article.append(rank, body);
  return article;
}

function renderCountryDossierPreview() {
  const root = document.querySelector("#chapter-dossier-root");
  if (!root) return;

  const rows = countryDossierExportRows();
  const criticalCount = rows.filter((row) => row.risk_level === "Critical").length;
  const highCount = rows.filter((row) => row.risk_level === "High").length;
  const highLeadCount = rows.reduce((total, row) => total + (Number(row.high_priority_print_candidates) || 0), 0);
  const summary = document.querySelector("#chapter-dossier-summary");
  if (summary) {
    summary.textContent = `${rows.length} chapter dossiers; ${criticalCount} critical, ${highCount} high-risk, and ${highLeadCount} high-priority print leads across the country rollups.`;
  }

  root.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "empty-chapter";
    empty.textContent = "No country dossier rows are available.";
    root.append(empty);
    return;
  }

  for (const row of rows) {
    root.append(createCountryDossierRow(row));
  }
}

function selectionShortlistKey(row) {
  return [
    row.primary_chapter_country,
    row.sort_date,
    row.title,
    row.source_folder_or_title
  ]
    .map((value) =>
      String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
    )
    .join("|");
}

function selectionShortlistRows(rows, limit = 12) {
  const seen = new Set();
  const shortlist = [];
  for (const row of rows) {
    if (row.record_class !== "Print-candidate lead" || row.selection_band !== "Top print lead") continue;
    const key = selectionShortlistKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    shortlist.push(row);
    if (shortlist.length >= limit) break;
  }
  return shortlist;
}

function createSelectionShortlistMeta(label, value) {
  const text = workplanPreviewText(value);
  if (!text) return null;
  const item = document.createElement("span");
  item.textContent = `${label}: ${text}`;
  return item;
}

function createSelectionShortlistRow(row) {
  const article = document.createElement("article");
  article.className = "selection-shortlist-row";

  const rank = document.createElement("div");
  rank.className = "selection-shortlist-rank";
  const selectionRank = document.createElement("span");
  selectionRank.className = "selection-shortlist-order";
  selectionRank.textContent = `#${row.selection_rank}`;
  const score = document.createElement("span");
  score.className = "selection-shortlist-score";
  score.textContent = `Score ${row.selection_score}`;
  const risk = document.createElement("span");
  risk.className = `selection-shortlist-risk ${String(row.country_risk_level || "review").toLowerCase()}`;
  risk.textContent = row.country_risk_level || "Review";
  rank.append(selectionRank, score, risk);

  const body = document.createElement("div");
  body.className = "selection-shortlist-body";
  const title = document.createElement("h4");
  title.textContent = row.title || "Untitled print lead";

  const meta = document.createElement("p");
  meta.className = "selection-shortlist-meta";
  meta.append(
    ...[
      createSelectionShortlistMeta("Country", row.primary_chapter_country),
      createSelectionShortlistMeta("Date", row.display_date || row.sort_date),
      createSelectionShortlistMeta("Type", row.document_type),
      createSelectionShortlistMeta("Source", row.source_series),
      createSelectionShortlistMeta("Folder", row.source_folder_or_title),
      createSelectionShortlistMeta("Page", row.page_count_or_range)
    ].filter(Boolean)
  );

  const flags = createSelectionShortlistMeta("Flags", workplanList(row.selection_flags).slice(0, 3).map((flag) => flag.replace(/_/g, " ")));
  const context = createSelectionShortlistMeta("Nearby private records", workplanList(row.nearby_private_records_14_days).slice(0, 2));
  const contextLine = document.createElement("p");
  contextLine.className = "selection-shortlist-context";
  contextLine.append(...[flags, context].filter(Boolean));

  const action = document.createElement("p");
  action.className = "selection-shortlist-action";
  action.textContent = row.compiler_action || "Verify page image/OCR and compare against the private chronology before print selection.";

  body.append(title);
  if (meta.childNodes.length) body.append(meta);
  if (contextLine.childNodes.length) body.append(contextLine);
  body.append(action);

  const link = row.page_link || row.pdf_url || row.catalog_or_details_url;
  if (link) {
    const source = document.createElement("a");
    source.className = "selection-shortlist-link";
    source.href = link;
    source.rel = "noreferrer";
    source.textContent = "Open source";
    body.append(source);
  }

  article.append(rank, body);
  return article;
}

function renderSelectionShortlistPreview() {
  const root = document.querySelector("#selection-shortlist-root");
  if (!root) return;

  const rows = selectionMatrixExportRows();
  const topLeads = rows.filter((row) => row.record_class === "Print-candidate lead" && row.selection_band === "Top print lead");
  const shortlist = selectionShortlistRows(rows, 12);
  const topCountries = new Set(topLeads.map((row) => row.primary_chapter_country).filter(Boolean));
  const summary = document.querySelector("#selection-shortlist-summary");
  if (summary) {
    summary.textContent = `${shortlist.length} distinct leads previewed from ${topLeads.length} top print-lead rows across ${topCountries.size} countries.`;
  }

  root.replaceChildren();
  if (!shortlist.length) {
    const empty = document.createElement("p");
    empty.className = "empty-chapter";
    empty.textContent = "No top print-lead rows are available.";
    root.append(empty);
    return;
  }

  for (const row of shortlist) {
    root.append(createSelectionShortlistRow(row));
  }
}

attachCompilerExports();
renderCompilerWorkplanPreview();
renderCountryDossierPreview();
renderSelectionShortlistPreview();
