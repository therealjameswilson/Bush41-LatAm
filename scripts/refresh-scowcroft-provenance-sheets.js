const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const dataPath = path.join(repoRoot, "data", "memcons.json");
const dataScriptPath = path.join(repoRoot, "data", "memcons.js");
const sourceRoot = path.join(repoRoot, ".cache", "scowcroft-source");
const ocrRoot = path.join(repoRoot, ".cache", "scowcroft-ocr");
const reportPath = path.join(repoRoot, "reports", "scowcroft-provenance-sheet-refresh.json");

function run(command, args, options = {}) {
  childProcess.execFileSync(command, args, { stdio: "inherit", ...options });
}

function pageCount(pdfPath) {
  const output = childProcess.execFileSync("pdfinfo", [pdfPath], { encoding: "utf8" });
  const match = output.match(/^Pages:\s+(\d+)/m);
  if (!match) throw new Error(`Could not count pages for ${pdfPath}`);
  return Number(match[1]);
}

function normalizeSpaces(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function sourcePathForNaid(naid) {
  const fileName = fs.readdirSync(sourceRoot).find((file) => file.startsWith(`${naid}-`) && file.endsWith(".pdf"));
  if (!fileName) throw new Error(`Missing cached source PDF for NAID ${naid}`);
  return path.join(sourceRoot, fileName);
}

function fieldFromMarker(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`${escaped}:\\s*\\|?\\s*([^\\n\\r]+)`, "i"));
  return normalizeSpaces(match ? match[1] : "");
}

function paragraphAfterLabel(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`${escaped}:\\s*\\n\\s*([\\s\\S]+?)(?:\\n\\s*(?:Section|Stack|Row|Position):|\\n\\s*\\f|$)`, "i"));
  return normalizeSpaces(match ? match[1] : "");
}

function parseProvenanceSheet(naid) {
  const sidecarPath = path.join(ocrRoot, `${naid}.txt`);
  if (!fs.existsSync(sidecarPath)) throw new Error(`Missing OCR sidecar for NAID ${naid}`);
  const firstSheet = fs.readFileSync(sidecarPath, "utf8").split("\f")[0] || "";
  const foiaNumber = firstSheet.match(/\b\d{4}-\d{4}-[A-Z]\b/)?.[0] || "";

  return {
    foiaNumber,
    recordGroupCollection: fieldFromMarker(firstSheet, "Record Group/Collection"),
    collectionOfficeOfOrigin: fieldFromMarker(firstSheet, "Collection/Office of Origin"),
    series: fieldFromMarker(firstSheet, "Series"),
    subseries: fieldFromMarker(firstSheet, "Subseries"),
    oaIdNumber: fieldFromMarker(firstSheet, "OA/ID Number"),
    folderIdNumber: fieldFromMarker(firstSheet, "Folder ID Number"),
    folderTitle: paragraphAfterLabel(firstSheet, "Folder Title")
  };
}

function isBadMarkerValue(value) {
  return !value || /^(Collection\/Office of Origin|Series|Subseries|Folder ID Number|Folder Title):?$/i.test(value);
}

function cleanProvenanceSheet(provenance, fallbackIdentifier, typeText) {
  const isTelcon = /telcon|telephone/i.test(typeText || "");
  const inferredFolderId =
    (provenance.folderTitle || "").match(/\b\d{5}-\d{3}\b/)?.[0] ||
    (fallbackIdentifier || "").match(/\b\d{5}-\d{3}\b/)?.[0] ||
    provenance.folderIdNumber;
  const folderTitle = normalizeSpaces((provenance.folderTitle || "").replace(/^\d{5}\s+\d{5}-\d{3}\s+/, ""));

  return {
    foiaNumber: provenance.foiaNumber || "2009-0275-S",
    recordGroupCollection: isBadMarkerValue(provenance.recordGroupCollection)
      ? "George H.W. Bush Presidential Records"
      : provenance.recordGroupCollection,
    collectionOfficeOfOrigin: isBadMarkerValue(provenance.collectionOfficeOfOrigin)
      ? "Scowcroft, Brent, Collection"
      : provenance.collectionOfficeOfOrigin,
    series: isBadMarkerValue(provenance.series) ? "Presidential Correspondence Files" : provenance.series,
    subseries:
      isBadMarkerValue(provenance.subseries) || /George H\.?W\.?\s*Bush Presidential Records/i.test(provenance.subseries)
        ? isTelcon
          ? "Presidential Telcon Files"
          : "Presidential Memcons Files"
        : provenance.subseries,
    oaIdNumber: /^\d{5}$/.test(provenance.oaIdNumber || "")
      ? provenance.oaIdNumber
      : (inferredFolderId || "").split("-")[0],
    folderIdNumber: /^\d{5}-\d{3}$/.test(inferredFolderId || "") ? inferredFolderId : fallbackIdentifier,
    folderTitle
  };
}

function normalizeCollection(value) {
  if (/Scowcroft,\s*Brent,\s*Collection/i.test(value || "")) return "Brent Scowcroft Collection";
  return normalizeSpaces(value);
}

function normalizeRecordGroup(value) {
  if (/Bush Presidential Records|George H\.?\s*W\.?\s*Bush Presidential Records/i.test(value || "")) {
    return "Bush Presidential Records";
  }
  return normalizeSpaces(value);
}

function scowcroftSourcePath(provenance, fallbackTitle, fallbackIdentifier) {
  return [
    "Source: George H.W. Bush Library",
    normalizeRecordGroup(provenance.recordGroupCollection),
    normalizeCollection(provenance.collectionOfficeOfOrigin),
    provenance.series,
    provenance.subseries,
    `OA/ID ${provenance.folderIdNumber || fallbackIdentifier || provenance.oaIdNumber}`,
    provenance.folderTitle || fallbackTitle
  ]
    .filter(Boolean)
    .join(", ");
}

function sourceNoteForRecord(record, provenance) {
  const sentences = [
    `${scowcroftSourcePath(provenance, record.sourceTitle, record.localIdentifier)}.`,
    "Declassified."
  ];
  return sentences.filter(Boolean).join(" ");
}

function sourceNoteForDuplicate(duplicate, provenance) {
  const sentences = [
    `${scowcroftSourcePath(provenance, duplicate.sourceFile, duplicate.localIdentifier)}.`,
    "Declassified."
  ];
  return sentences.filter(Boolean).join(" ");
}

function extractPdfPages(inputPath, firstPage, lastPage, tempDir, prefix) {
  const outputPattern = path.join(tempDir, `${prefix}-%04d.pdf`);
  run("pdfseparate", ["-f", String(firstPage), "-l", String(lastPage), inputPath, outputPattern]);
  const pages = [];
  for (let page = firstPage; page <= lastPage; page += 1) {
    pages.push(path.join(tempDir, `${prefix}-${String(page).padStart(4, "0")}.pdf`));
  }
  return pages;
}

function bodyPdfWithoutExistingProvenance(record, pdfPath, tempDir) {
  const totalPages = pageCount(pdfPath);
  const existingProvenancePages = record.provenancePages || 0;
  if (existingProvenancePages <= 0) return { path: pdfPath, bodyPages: totalPages };

  const firstBodyPage = existingProvenancePages + 1;
  if (firstBodyPage > totalPages) {
    throw new Error(`PDF ${record.pdfUrl} has no body pages after provenance pages`);
  }

  const bodyPages = extractPdfPages(pdfPath, firstBodyPage, totalPages, tempDir, "body");
  const bodyPath = path.join(tempDir, "body.pdf");
  run("pdfunite", [...bodyPages, bodyPath]);
  return { path: bodyPath, bodyPages: bodyPages.length };
}

function prependProvenancePage(record, sourcePath) {
  const pdfPath = path.join(repoRoot, record.pdfUrl);
  if (!fs.existsSync(pdfPath)) throw new Error(`Missing local record PDF ${record.pdfUrl}`);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "latam-scowcroft-provenance-"));
  try {
    const [provenancePage] = extractPdfPages(sourcePath, 1, 1, tempDir, "provenance");
    const body = bodyPdfWithoutExistingProvenance(record, pdfPath, tempDir);
    const refreshedPath = path.join(tempDir, "refreshed.pdf");
    run("pdfunite", [provenancePage, body.path, refreshedPath]);
    fs.copyFileSync(refreshedPath, pdfPath);
    return body.bodyPages;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function scowcroftRecords(records) {
  return records.filter(
    (record) =>
      record.source?.name === "Brent Scowcroft Papers" &&
      record.pdfUrl &&
      !/^https?:\/\//i.test(record.pdfUrl)
  );
}

function main() {
  const records = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const provenanceByNaid = new Map();
  const refreshed = [];
  const duplicateUpdates = [];

  for (const record of scowcroftRecords(records)) {
    const sourcePath = sourcePathForNaid(record.naid);
    const provenance =
      provenanceByNaid.get(record.naid) ||
      cleanProvenanceSheet(parseProvenanceSheet(record.naid), record.localIdentifier, `${record.type} ${record.title}`);
    provenanceByNaid.set(record.naid, provenance);

    const bodyPages = prependProvenancePage(record, sourcePath);
    record.provenancePages = 1;
    record.pageCount = bodyPages;
    record.sourceTitle = [
      provenance.folderTitle || record.sourceTitle,
      record.source?.objectFilename,
      record.source?.sourcePages ? `source pages ${record.source.sourcePages}` : ""
    ]
      .filter(Boolean)
      .join("; ");
    record.notes = `Extracted from the Brent Scowcroft Papers source folder PDF. The generated PDF begins with page 1 of ${record.source?.objectFilename} as a provenance sheet, followed by source pages ${record.source?.sourcePages}; pageCount counts only the ${bodyPages} ${bodyPages === 1 ? "page" : "pages"} of conversation text.`;
    record.source = {
      ...record.source,
      foiaNumber: provenance.foiaNumber,
      provenanceSheetPage: 1,
      provenanceSheet: provenance
    };
    record.sourceNote = sourceNoteForRecord(record, provenance);

    refreshed.push({
      id: record.id,
      naid: record.naid,
      pdfUrl: record.pdfUrl,
      pageCount: record.pageCount,
      provenancePages: record.provenancePages,
      sourceNote: record.sourceNote
    });
  }

  for (const record of records) {
    for (const duplicate of record.source?.duplicateSources || []) {
      if (duplicate.sourceName !== "Brent Scowcroft Papers" || !duplicate.naid) continue;
      const provenance =
        provenanceByNaid.get(duplicate.naid) ||
        cleanProvenanceSheet(
          parseProvenanceSheet(duplicate.naid),
          duplicate.localIdentifier,
          `${duplicate.id || ""} ${duplicate.sourcePages || ""}`
        );
      provenanceByNaid.set(duplicate.naid, provenance);
      duplicate.provenanceSheet = provenance;
      duplicate.sourceNote = sourceNoteForDuplicate(duplicate, provenance);
      if (duplicate.pdfUrl && !fs.existsSync(path.join(repoRoot, duplicate.pdfUrl))) {
        delete duplicate.pdfUrl;
      }
      duplicateUpdates.push({
        parentId: record.id,
        duplicateId: duplicate.id,
        naid: duplicate.naid,
        sourcePages: duplicate.sourcePages
      });
    }
  }

  const json = JSON.stringify(records, null, 2);
  fs.writeFileSync(dataPath, `${json}\n`);
  fs.writeFileSync(dataScriptPath, `window.MEMCONS = ${json};\n`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        refreshedRecords: refreshed.length,
        duplicateSourceUpdates: duplicateUpdates.length,
        refreshed,
        duplicateUpdates
      },
      null,
      2
    )}\n`
  );
  console.log(`Refreshed ${refreshed.length} Scowcroft PDFs and ${duplicateUpdates.length} duplicate provenance entries.`);
}

main();
