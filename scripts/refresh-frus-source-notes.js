const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const DATASETS = [
  {
    json: "data/memcons.json",
    js: "data/memcons.js",
    variable: "MEMCONS",
    update: updateMemconSourceNotes
  },
  {
    json: "data/chronological-print-candidates.json",
    js: "data/chronological-print-candidates.js",
    variable: "CHRONOLOGICAL_PRINT_CANDIDATES",
    update: updateCandidateSourceNotes
  },
  {
    json: "data/subject-print-candidates.json",
    js: "data/subject-print-candidates.js",
    variable: "SUBJECT_PRINT_CANDIDATES",
    update: updateCandidateSourceNotes
  },
  {
    json: "data/deal-print-candidates.json",
    js: "data/deal-print-candidates.js",
    variable: "DEAL_PRINT_CANDIDATES",
    update: updateCandidateSourceNotes
  }
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function writeDataset(dataset, records) {
  const json = `${JSON.stringify(records, null, 2)}\n`;
  fs.writeFileSync(path.join(ROOT, dataset.json), json);
  fs.writeFileSync(path.join(ROOT, dataset.js), `window.${dataset.variable} = ${json.replace(/\n$/, "")};\n`);
}

function normalizeSourceText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

function isMarkerLabel(value) {
  if (!value) return false;
  return /^(Record Group|Collection|Series|OA\/ID Number|Folder ID Number|Folder Title|FOIA Number)$/i.test(
    String(value).trim()
  );
}

function uniqueInOrder(values) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const clean = normalizeSourceText(value);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    output.push(clean);
  }
  return output;
}

function sentence(value) {
  if (!value) return "";
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function releaseSentence(record) {
  const status = record.releaseStatus || "";
  if (/declassified/i.test(status)) return "Declassified.";
  if (/full/i.test(status)) return "Declassified.";
  if (/partial/i.test(status)) return `Declassified; partial release: ${status}.`;
  if (/restricted|withheld|denied|excised/i.test(status)) return `Access restriction: ${status}.`;
  if (/unknown/i.test(status)) return "Release status not determined.";
  return sentence(status);
}

function cleanFolderTitle(record) {
  const rawTitle = record.source?.provenanceSheet?.folderTitle || record.source?.fileUnitTitle || record.localIdentifier || record.sourceTitle || "";
  const pieces = rawTitle
    .split(";")
    .map((part) => normalizeSourceText(part))
    .filter(Boolean);
  return (pieces[0] || normalizeSourceText(rawTitle)).replace(/^\d{5}\s+\d{5}-\d{3}\s+/, "");
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
  if (
    provenance.subseries &&
    !isMarkerLabel(provenance.subseries) &&
    !/George H\.?W\.?\s*Bush Presidential Records/i.test(provenance.subseries)
  ) {
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

function frusMemconSourceNote(record) {
  const source = record.source || {};
  if (source.name === "Brent Scowcroft Papers") {
    return [`Source: ${scowcroftSourcePath(record)}.`, releaseSentence(record)].filter(Boolean).join(" ");
  }

  if (source.name === "Records of the National Security Council (George H. W. Bush Administration)") {
    return [`Source: ${nscSourcePath(record)}.`, releaseSentence(record)].filter(Boolean).join(" ");
  }

  return sentence(record.sourceNote || "Source: Provenance pending.");
}

function updateMemconSourceNotes(records) {
  let changed = 0;
  let preserved = 0;
  for (const record of records) {
    const oldNote = record.sourceNote || "";
    const newNote = frusMemconSourceNote(record);
    if (oldNote && oldNote !== newNote && !record.provenanceNote) {
      record.provenanceNote = oldNote;
      preserved += 1;
    }
    if (record.sourceNote !== newNote) {
      record.sourceNote = newNote;
      changed += 1;
    }
  }
  return { changed, preserved };
}

function candidateSeriesPath(record) {
  const name = record.sourceSeries?.name || "";
  if (/Chronological/i.test(name)) {
    return ["Latin American Affairs Directorate Files", "Chronological Files"];
  }
  if (/Latin American Affairs Directorate Subject/i.test(name)) {
    return ["Latin American Affairs Directorate Files", "Subject File 1989"];
  }
  if (/Timothy E\.?\s*Deal/i.test(name)) {
    return ["Deal, Timothy E., Files", "Subject Files"];
  }
  return [name].filter(Boolean);
}

function foiaNumber(record) {
  return record.sourceNote?.match(/\bFOIA\s+([0-9]{4}-[0-9]{4}-[A-Z])\b/i)?.[1] || "";
}

function candidateSourceNote(record) {
  const localIdentifier = record.localIdentifier || "";
  const oaId = localIdentifier.split("-")[0] || "";
  const sourcePath = uniqueInOrder([
    "George H.W. Bush Library",
    "Bush Presidential Records",
    "National Security Council",
    ...candidateSeriesPath(record),
    oaId ? `OA/ID ${oaId}` : "",
    localIdentifier,
    record.folderTitle
  ]).join(", ");

  return [
    `Source: ${sourcePath}.`,
    record.accessRestriction ? `Access restriction: ${record.accessRestriction}.` : "",
    foiaNumber(record) ? `FOIA ${foiaNumber(record)}.` : ""
  ]
    .filter(Boolean)
    .join(" ");
}

function updateCandidateSourceNotes(records) {
  let changed = 0;
  for (const record of records) {
    const newNote = candidateSourceNote(record);
    if (record.sourceNote !== newNote) {
      record.sourceNote = newNote;
      changed += 1;
    }
  }
  return { changed, preserved: 0 };
}

function sourceNoteConforms(record) {
  const note = record.sourceNote || "";
  return (
    /^Source: /.test(note) &&
    !/https?:\/\//i.test(note) &&
    !/\bNAID\b/i.test(note) &&
    !/Digital object|Digital Research Room|National Archives Catalog|Folder ID Number|Catalog:|Project PDF/i.test(note)
  );
}

function main() {
  const generatedAt = new Date().toISOString();
  const report = {
    generatedAt,
    model: {
      volume: "Foreign Relations of the United States, 1989-1992, Volume XXXI, START I, 1989-1991",
      url: "https://history.state.gov/historicaldocuments/frus1989-92v31"
    },
    rule: "Visible Source notes use repository, record group, office/collection, series or file, OA/ID or folder identifier when available, folder title, then release/access facts. Catalog URLs, NAIDs, table rows, and digital-object fields remain in structured metadata or provenanceNote.",
    datasets: []
  };

  for (const dataset of DATASETS) {
    const records = readJson(dataset.json);
    const result = dataset.update(records);
    writeDataset(dataset, records);
    report.datasets.push({
      dataset: dataset.json,
      records: records.length,
      sourceNotesChangedThisRun: result.changed,
      provenanceNotesPreservedThisRun: result.preserved,
      conformingSourceNotes: records.filter(sourceNoteConforms).length,
      provenanceNotesPresent: records.filter((record) => record.provenanceNote).length
    });
  }

  fs.writeFileSync(
    path.join(ROOT, "reports", "source-note-audit.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );
  console.log(JSON.stringify(report, null, 2));
}

main();
