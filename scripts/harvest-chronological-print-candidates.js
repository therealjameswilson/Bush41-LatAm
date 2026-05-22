const childProcess = require("child_process");
const fs = require("fs");
const https = require("https");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const chronologicalFilesPath = path.join(repoRoot, "data", "priority-collection.json");
const outputPath = path.join(repoRoot, "data", "chronological-print-candidates.json");
const outputScriptPath = path.join(repoRoot, "data", "chronological-print-candidates.js");
const reportPath = path.join(repoRoot, "reports", "chronological-print-candidates-harvest.json");
const pdfCacheRoot = path.join(repoRoot, ".cache", "chronological-files");
const ocrCacheRoot = path.join(repoRoot, ".cache", "chronological-files-ocr");

const SERIES_NAID = "2197972";
const SERIES_NAME = "Latin American Directorate Chronological Files";
const SERIES_URL = `https://catalog.archives.gov/id/${SERIES_NAID}`;

const HIGH_VALUE_TERMS = [
  ["narcotics", /narcotics|drug|cocaine|cartel|extradition|andean|medellin/i],
  ["democracy", /democracy|democratic|election|transition|coup|military|human rights/i],
  ["debt and economy", /debt|brady|imf|world bank|economic|trade|investment/i],
  ["presidential diplomacy", /president|potus|bush|scowcroft|eagleburger|baker|cheney/i],
  ["regional policy", /latin america|south america|oas|rio group|hemispher/i],
  ["panama spillover", /panama|noriega|endara/i],
  ["ussr/cuba", /soviet|ussr|gorbachev|cuba|castro/i]
];

const COUNTRY_TERMS = {
  Argentina: /argentina|argentine|alfonsin|menem|di tella/i,
  Bolivia: /bolivia|bolivian|paz zamora|paz estenssoro/i,
  Brazil: /brazil|brazilian|sarney|collor|baena soares/i,
  Chile: /chile|chilean|aylwin|pinochet/i,
  Colombia: /colombia|colombian|barco|gaviria/i,
  Ecuador: /ecuador|ecuadoran|ecuadorian|borja/i,
  Guyana: /guyana|guyanese|hoyte/i,
  Paraguay: /paraguay|paraguayan|rodriguez|stroessner/i,
  Peru: /peru|peruvian|garcia|fujimori/i,
  Suriname: /suriname|surinamese|bouterse/i,
  Uruguay: /uruguay|uruguayan|sanguinetti|lacalle/i,
  Venezuela: /venezuela|venezuelan|carlos andres perez|perez/i
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function normalizeSpaces(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function cleanOcr(value) {
  return normalizeSpaces(value)
    .replace(/\bCFO0/g, "CF00")
    .replace(/\bCFO/g, "CF0")
    .replace(/\s+([,.;:])/g, "$1");
}

function download(url, targetPath) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 0) {
      resolve();
      return;
    }

    const file = fs.createWriteStream(targetPath);
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          file.close();
          fs.rmSync(targetPath, { force: true });
          reject(new Error(`HTTP ${response.statusCode} for ${url}`));
          return;
        }
        response.pipe(file);
        file.on("finish", () => file.close(resolve));
      })
      .on("error", (error) => {
        file.close();
        fs.rmSync(targetPath, { force: true });
        reject(error);
      });
  });
}

async function downloadWithRetries(url, targetPath, attempts = 4) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await download(url, targetPath);
      return;
    } catch (error) {
      lastError = error;
      fs.rmSync(targetPath, { force: true });
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
  }
  throw lastError;
}

function pageCount(pdfPath) {
  const output = childProcess.execFileSync("pdfinfo", [pdfPath], { encoding: "utf8" });
  return Number(output.match(/^Pages:\s+(\d+)/m)?.[1] || 0);
}

function runOcr(pdfPath, sidecarPath, ocrPdfPath) {
  if (fs.existsSync(sidecarPath) && fs.statSync(sidecarPath).size > 0) return;
  childProcess.execFileSync(
    "ocrmypdf",
    ["--jobs", "4", "--sidecar", sidecarPath, "--skip-text", pdfPath, ocrPdfPath],
    { stdio: "ignore" }
  );
}

function parseProvenance(firstPage, folder) {
  return {
    foiaNumber: firstPage.match(/\b\d{4}-\d{4}-[A-Z]\b/)?.[0] || "2015-0017-S",
    recordGroupCollection: "George H.W. Bush Presidential Records",
    collectionOfficeOfOrigin: "National Security Council",
    series: "Latin American Affairs Directorate Files",
    subseries: "Chronological Files",
    oaIdNumber: folder.containerId || "",
    folderIdNumber: folder.localIdentifier || "",
    folderTitle: folder.title
  };
}

function sourceNote(folder, provenance) {
  return [
    "Source: George H.W. Bush Library",
    "Bush Presidential Records",
    "National Security Council",
    provenance.series,
    provenance.subseries,
    provenance.oaIdNumber ? `OA/ID ${provenance.oaIdNumber}` : "",
    provenance.folderIdNumber ? `Folder ID Number ${provenance.folderIdNumber}` : "",
    provenance.folderTitle
  ]
    .filter(Boolean)
    .join(", ")
    .concat(`. Access restriction: ${folder.accessRestriction || "not recorded"}. FOIA ${provenance.foiaNumber}.`);
}

function sourceSeries() {
  return {
    name: SERIES_NAME,
    naid: SERIES_NAID,
    url: SERIES_URL
  };
}

function lines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => cleanOcr(line))
    .filter(Boolean);
}

function isWithdrawalStart(line) {
  return /^\s*[0O][0-9][a-z]?[.,]?\s+(?:Memorandum|Memo|Letter|Cable|Report|Telcon|Memcon)\b/i.test(line);
}

function parseWithdrawalCandidates(pageText, pageNumber, folder, provenance) {
  if (!/Withdrawal\/Redaction Sheet/i.test(pageText)) return [];
  const entries = [];
  const pageLines = lines(pageText);

  for (let i = 0; i < pageLines.length; i += 1) {
    const line = pageLines[i];
    if (!isWithdrawalStart(line)) continue;
    const chunks = [line];
    for (let j = i + 1; j < pageLines.length && j < i + 4; j += 1) {
      if (isWithdrawalStart(pageLines[j]) || /^(Collection|Record Group|Office|Series|Subseries|WHORM|File Location|Pinksheet|OA\/ID|Date Closed|FOIA)/i.test(pageLines[j])) {
        break;
      }
      chunks.push(pageLines[j]);
    }
    const raw = chunks.join(" ");
    const match = raw.match(/^\s*([0O][0-9][a-z]?[.,]?)\s+(Memorandum|Memo|Letter|Cable|Report|Telcon|Memcon)\s+(.+?)\s+((?:\d{1,2}\/\d{1,2}\/\d{2,4})|n\.d\.)?\s*(?:\(?b\)?|\(b\)|$)/i);
    if (!match) continue;
    const type = match[2].replace(/^Memo$/i, "Memorandum");
    const title = cleanOcr(match[3].replace(/\(\d+\s*pp?\.\)/i, ""));
    if (!isPotentialPrintType(type, title)) continue;
    entries.push(buildCandidate({
      folder,
      provenance,
      pageNumber,
      extraction: "withdrawal-sheet",
      documentNo: match[1].replace(/^O/, "0").replace(/,$/, "."),
      documentType: type,
      documentTitle: title,
      documentDate: normalizeDate(match[4] || ""),
      ocrSnippet: raw
    }));
  }

  return entries;
}

function normalizeDate(value) {
  return cleanOcr(value).replace(/^n\.d\.$/i, "n.d.");
}

function subjectFromPage(pageText) {
  const compact = pageText.replace(/\r/g, "");
  const subject = compact.match(/SUBJECT:\s*([^\n\f]+(?:\n\s{2,}[^\n\f]+){0,3})/i)?.[1] || "";
  return cleanOcr(subject.replace(/\n/g, " "));
}

function toFromSummary(pageText) {
  const to = cleanOcr(pageText.match(/\bTO:\s*([^\n\f]+)/i)?.[1] || pageText.match(/MEMORANDUM FOR\s+([^\n\f]+)/i)?.[1] || "");
  const from = cleanOcr(pageText.match(/\bFROM:\s*([^\n\f]+)/i)?.[1] || "");
  return [to ? `To: ${to}` : "", from ? `From: ${from}` : ""].filter(Boolean).join("; ");
}

function talkingPointsTitle(pageText) {
  const pageLines = lines(pageText);
  const start = pageLines.findIndex(
    (line, index) =>
      index < 12 &&
      /(?:^|\b)(?:TALKING POINTS|SUGGESTED APPROACH|CONGRATULATORY CALL)(?:\b|$)/i.test(line)
  );
  if (start === -1) return "";
  return cleanOcr(pageLines.slice(start, start + 3).join(" "));
}

function dateFromPage(pageText) {
  return plausibleDocumentDate(cleanOcr(
    pageText.match(/\bDOC DATE:\s*([^\n\f]+)/i)?.[1] ||
      pageText.match(/\bDATE:\s*([^\n\f]+)/i)?.[1] ||
      pageText.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/i)?.[0] ||
      ""
  ));
}

function plausibleDocumentDate(value) {
  const clean = cleanOcr(value);
  const fourDigitYear = clean.match(/\b(19|20)\d{2}\b/)?.[0];
  if (fourDigitYear && (Number(fourDigitYear) < 1989 || Number(fourDigitYear) > 1993)) return "";
  return clean;
}

function pageDocumentType(pageText) {
  if (/MEMORANDUM OF TELEPHONE CONVERSATION/i.test(pageText)) return "Memorandum of Telephone Conversation";
  if (/MEMORANDUM OF CONVERSATION/i.test(pageText)) return "Memorandum of Conversation";
  if (/MEMORANDUM FOR/i.test(pageText)) return "Memorandum";
  if (/\bTALKING POINTS\b/i.test(pageText)) return "Talking Points";
  if (/\bACTION\b[\s\S]{0,500}\bSUBJECT:/i.test(pageText)) return "Action Memo";
  if (/\bINFORMATION\b[\s\S]{0,500}\bSUBJECT:/i.test(pageText)) return "Information Memo";
  if (/\bNSC\/S PROFILE\b/i.test(pageText)) return "NSC/S Profile";
  return "";
}

function isBodyCandidatePage(pageText) {
  if (/FOIA\s+MARKER|Withdrawal\/Redaction Sheet|NSC\/S PROFILE/i.test(pageText)) return false;
  return /MEMORANDUM FOR|MEMORANDUM OF (?:TELEPHONE )?CONVERSATION|\bACTION\b[\s\S]{0,500}\bSUBJECT:|\bINFORMATION\b[\s\S]{0,500}\bSUBJECT:|\bTALKING POINTS\b/i.test(pageText);
}

function parseBodyCandidate(pageText, pageNumber, folder, provenance) {
  if (!isBodyCandidatePage(pageText)) return null;
  const documentType = pageDocumentType(pageText);
  const subject = subjectFromPage(pageText);
  const title = documentType === "Talking Points"
    ? talkingPointsTitle(pageText)
    : subject || toFromSummary(pageText) || cleanOcr(pageText.slice(0, 160));
  if (!isPotentialPrintType(documentType, title)) return null;
  return buildCandidate({
    folder,
    provenance,
    pageNumber,
    extraction: "ocr-document-start",
    documentType,
    documentTitle: title,
    documentDate: dateFromPage(pageText),
    ocrSnippet: cleanOcr(pageText.slice(0, 700))
  });
}

function isPotentialPrintType(type, title) {
  const text = `${type} ${title}`;
  if (/Withdrawal\/Redaction Sheet|FOIA Marker/i.test(text)) return false;
  if (/NSC\/S Profile/i.test(type)) return false;
  if (!hasUsableTitle(title)) return false;
  return /Memorandum|Memo|Action Memo|Information Memo|Talking Points|Letter|Cable|Report|Memcon|Telcon|Meeting|Briefing/i.test(text);
}

function hasUsableTitle(title) {
  const clean = cleanOcr(title);
  if (clean.length < 10) return false;
  if (/^(To|From|Date|Subject|Action|Information|Date, Time|S\/S|Received|Attachment|Tab)\b[:;]?$/i.test(clean)) return false;
  if (/\bReceived:/i.test(clean)) return false;
  if (/^(To|From):\s*(President|Scowcroft)?$/i.test(clean)) return false;
  if (/^(CONFIDENTIAL|SECRET|UNCLASSIFIED|LIMITED OFFICIAL USE)\b/i.test(clean)) return false;
  if (/^[^a-zA-Z]*(?:\d+|[A-Z])[^a-zA-Z]*$/.test(clean)) return false;
  return true;
}

function isSouthAmericaCandidate(candidate) {
  return (candidate.countries || []).length > 0;
}

function countryMatches(folder, title, snippet) {
  const text = `${folder.title} ${(folder.countries || []).join(" ")} ${title} ${snippet}`;
  const countries = new Set(folder.countries || []);
  for (const [country, pattern] of Object.entries(COUNTRY_TERMS)) {
    if (pattern.test(text)) countries.add(country);
  }
  return [...countries].sort((a, b) => a.localeCompare(b));
}

function themes(title, snippet, folder) {
  const text = `${folder.title} ${(folder.topics || []).join(" ")} ${title} ${snippet}`;
  const matches = HIGH_VALUE_TERMS.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
  return [...new Set([...(folder.topics || []), ...matches])];
}

function scoreCandidate(type, title, snippet, folder) {
  const text = `${type} ${title} ${snippet} ${folder.title}`;
  let score = 0;
  if (/Memorandum|Action Memo|Information Memo|Talking Points|Memcon|Telcon/i.test(type)) score += 35;
  if (/President|Bush|POTUS|Scowcroft|Baker|Eagleburger|Cheney/i.test(text)) score += 20;
  if (/narcotics|drug|cocaine|cartel|extradition|andean|debt|imf|democracy|election|human rights|coup|panama/i.test(text)) score += 18;
  if (/Meeting|Visit|Summit|Briefing|Recommendation|Decision|Options/i.test(text)) score += 12;
  if (/Letter|Cable|Report|Profile/i.test(type)) score += 8;
  if (/Restricted - Possibly|Partial|withheld|\(b\)/i.test(`${folder.accessRestriction} ${snippet}`)) score += 5;
  return score;
}

function priorityFor(score) {
  if (score >= 65) return "High";
  if (score >= 45) return "Medium";
  return "Reference";
}

function reasonFor(candidate) {
  const reasons = [];
  if (/Memorandum|Action Memo|Information Memo|Memcon|Telcon/i.test(candidate.documentType)) {
    reasons.push("memorandum form");
  }
  if (/President|Bush|POTUS|Scowcroft/i.test(`${candidate.documentTitle} ${candidate.ocrSnippet}`)) {
    reasons.push("Presidential or NSC principals");
  }
  if (candidate.themes.length) reasons.push(candidate.themes.slice(0, 3).join(", "));
  if (/withdrawal-sheet/.test(candidate.extraction)) reasons.push("identified on withdrawal sheet");
  if (/ocr-document-start/.test(candidate.extraction)) reasons.push("document text visible in OCR");
  return reasons.join("; ");
}

function buildCandidate({ folder, provenance, pageNumber, extraction, documentNo = "", documentType, documentTitle, documentDate = "", ocrSnippet }) {
  const cleanTitle = cleanOcr(documentTitle);
  const cleanSnippet = cleanOcr(ocrSnippet);
  const candidateThemes = themes(cleanTitle, cleanSnippet, folder);
  const score = scoreCandidate(documentType, cleanTitle, cleanSnippet, folder);
  const candidate = {
    id: `chronological-print-${folder.naid}-${pageNumber}-${documentNo || documentType}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    folderNaid: folder.naid,
    folderTitle: folder.title,
    localIdentifier: folder.localIdentifier,
    documentNo,
    documentType,
    documentTitle: cleanTitle,
    documentDate,
    countries: countryMatches(folder, cleanTitle, cleanSnippet),
    themes: candidateThemes,
    priority: priorityFor(score),
    score,
    pageStart: pageNumber,
    pageLink: `${folder.pdfUrl}#page=${pageNumber}`,
    catalogUrl: folder.catalogUrl,
    pdfUrl: folder.pdfUrl,
    accessRestriction: folder.accessRestriction,
    extraction,
    sourceSeries: sourceSeries(),
    ocrSnippet: cleanSnippet.slice(0, 420),
    sourceNote: sourceNote(folder, provenance)
  };
  candidate.reviewReason = reasonFor(candidate);
  return candidate;
}

function dedupeCandidates(candidates) {
  const byKey = new Map();
  for (const candidate of candidates) {
    const key = [
      candidate.folderNaid,
      candidate.documentNo || "",
      candidate.documentType,
      candidate.documentTitle.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
      candidate.documentDate
    ].join("|");
    const existing = byKey.get(key);
    if (!existing || candidate.score > existing.score || candidate.extraction === "ocr-document-start") {
      byKey.set(key, candidate);
    }
  }
  return [...byKey.values()];
}

async function processFolder(folder) {
  const pdfPath = path.join(pdfCacheRoot, `${folder.naid}.pdf`);
  const sidecarPath = path.join(ocrCacheRoot, `${folder.naid}.txt`);
  const ocrPdfPath = path.join(ocrCacheRoot, `${folder.naid}-ocr.pdf`);

  await downloadWithRetries(folder.pdfUrl, pdfPath);
  runOcr(pdfPath, sidecarPath, ocrPdfPath);

  const text = fs.readFileSync(sidecarPath, "utf8");
  const pages = text.split("\f");
  const provenance = parseProvenance(pages[0] || "", folder);
  const candidates = [];

  pages.forEach((pageText, index) => {
    const pageNumber = index + 1;
    candidates.push(...parseWithdrawalCandidates(pageText, pageNumber, folder, provenance));
    const bodyCandidate = parseBodyCandidate(pageText, pageNumber, folder, provenance);
    if (bodyCandidate) candidates.push(bodyCandidate);
  });

  return {
    folder: {
      naid: folder.naid,
      title: folder.title,
      localIdentifier: folder.localIdentifier,
      pageCount: pageCount(pdfPath),
      provenance,
      catalogUrl: folder.catalogUrl,
      pdfUrl: folder.pdfUrl
    },
    candidates: dedupeCandidates(candidates)
      .filter((candidate) => candidate.score >= 35)
      .filter(isSouthAmericaCandidate)
  };
}

async function main() {
  ensureDir(pdfCacheRoot);
  ensureDir(ocrCacheRoot);
  ensureDir(path.dirname(outputPath));
  ensureDir(path.dirname(reportPath));

  const folders = JSON.parse(fs.readFileSync(chronologicalFilesPath, "utf8"));
  const allCandidates = [];
  const folderReports = [];

  for (const [index, folder] of folders.entries()) {
    console.log(`${String(index + 1).padStart(2, "0")}/${folders.length} ${folder.naid} ${folder.title}`);
    const result = await processFolder(folder);
    allCandidates.push(...result.candidates);
    folderReports.push({
      ...result.folder,
      candidateCount: result.candidates.length,
      highPriorityCount: result.candidates.filter((candidate) => candidate.priority === "High").length
    });
  }

  const candidates = dedupeCandidates(allCandidates).sort(
    (a, b) =>
      b.score - a.score ||
      (a.countries[0] || "Regional").localeCompare(b.countries[0] || "Regional") ||
      a.folderTitle.localeCompare(b.folderTitle) ||
      a.pageStart - b.pageStart
  );
  const json = JSON.stringify(candidates, null, 2);
  fs.writeFileSync(outputPath, `${json}\n`);
  fs.writeFileSync(outputScriptPath, `window.CHRONOLOGICAL_PRINT_CANDIDATES = ${json};\n`);
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceSeries: {
          name: SERIES_NAME,
          naid: SERIES_NAID,
          url: SERIES_URL
        },
        scannedFolders: folders.length,
        candidateCount: candidates.length,
        highPriorityCount: candidates.filter((candidate) => candidate.priority === "High").length,
        mediumPriorityCount: candidates.filter((candidate) => candidate.priority === "Medium").length,
        referencePriorityCount: candidates.filter((candidate) => candidate.priority === "Reference").length,
        countryCounts: Object.fromEntries(
          Object.keys(COUNTRY_TERMS).map((country) => [
            country,
            candidates.filter((candidate) => candidate.countries.includes(country)).length
          ])
        ),
        folderReports
      },
      null,
      2
    )}\n`
  );

  console.log(`Wrote ${candidates.length} chronological-file print candidates.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
