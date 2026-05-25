const childProcess = require("child_process");
const fs = require("fs");
const https = require("https");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const dealFilesPath = path.join(repoRoot, "data", "deal-subject-files.json");
const outputPath = path.join(repoRoot, "data", "deal-print-candidates.json");
const outputScriptPath = path.join(repoRoot, "data", "deal-print-candidates.js");
const reportPath = path.join(repoRoot, "reports", "deal-print-candidates-harvest.json");
const pdfCacheRoot = path.join(repoRoot, ".cache", "deal-subject-files");
const ocrCacheRoot = path.join(repoRoot, ".cache", "deal-subject-files-ocr");

const SERIES_NAID = "2554810";
const SERIES_NAME = "Timothy E. Deal Subject Files";
const SERIES_URL = `https://catalog.archives.gov/id/${SERIES_NAID}`;

const HIGH_VALUE_TERMS = [
  ["enterprise for the americas", /enterprise for the americas|\bEAI\b/i],
  ["debt and economy", /debt|brady|imf|world bank|economic|trade|investment|finance/i],
  ["summit diplomacy", /summit|sherpa|houston|munich|g-?7|economic summit/i],
  ["presidential diplomacy", /president|potus|bush|scowcroft|baker|brady|mulford/i],
  ["regional policy", /latin america|south america|oas|rio group|hemispher/i],
  ["trade policy", /uruguay round|gatt|fast track|market access|exports?/i],
  ["environment", /environment|biodiversity|conservation|global change|climate/i]
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
  Peru: /peru(?!,\s*indiana)|peruvian|garcia|fujimori/i,
  Suriname: /suriname|surinamese|bouterse/i,
  Uruguay: /uruguay(?!\s+round)|uruguayan|sanguinetti|lacalle/i,
  Venezuela: /venezuela|venezuelan|carlos andres perez|perez/i
};

const REGIONAL_TERMS = /latin america|south america|western hemisphere|enterprise for the americas|\bEAI\b|hemispher/i;

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
    foiaNumber: firstPage.match(/\b\d{4}-\d{4}-[A-Z]\b/)?.[0] || "2023-1227-S",
    recordGroupCollection: "George H.W. Bush Presidential Records",
    collectionOfficeOfOrigin: "National Security Council",
    series: "Deal, Timothy E., Files",
    subseries: "Subject Files",
    oaIdNumber: folder.containerId || folder.localIdentifier?.split("-")[0] || "",
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
    provenance.folderIdNumber,
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
  return /^\s*[0O][0-9][a-z]?[.,]?\s+(?:Memorandum|Memo|Letter|Cable|Report|Telcon|Memcon|Paper|Briefing|Talking Points)\b/i.test(line);
}

function parseWithdrawalEntry(raw) {
  const entry = cleanOcr(raw);
  const match = entry.match(/^\s*([0O][0-9][a-z]?[.,]?)\s+(Memorandum|Memo|Letter|Cable|Report|Telcon|Memcon|Paper|Briefing|Talking Points)\s+(.+)$/i);
  if (!match) return null;

  const documentDate = normalizeDate(match[3].match(/(?:\d{1,2}\/\d{1,2}\/\d{2,4})|n\.d\./i)?.[0] || "");
  const reSubject = cleanOcr(entry.match(/\bRe:\s*([\s\S]+?)(?:\s+\(\d+\s*pp?\.\)|\s+\d{1,2}\/\d{1,2}\/\d{2,4}|$)/i)?.[1] || "");
  const titleBase = cleanOcr(
    match[3]
      .replace(/(?:\d{1,2}\/\d{1,2}\/\d{2,4})|n\.d\./gi, " ")
      .replace(/\(\d+\s*pp?\.\)/gi, " ")
      .replace(/\bRe:\s*[\s\S]+$/i, " ")
      .replace(/\s+\(?b\)?(?:\(\d+\))?\b[\s\S]*$/i, " ")
      .replace(/\s+\b[SCU]\b\s*$/i, " ")
  );
  const title = reSubject && !new RegExp(escapeRegExp(reSubject), "i").test(titleBase)
    ? `${titleBase} Re: ${reSubject}`
    : titleBase;

  return {
    documentNo: match[1].replace(/^O/, "0").replace(/,$/, "."),
    documentType: match[2].replace(/^Memo$/i, "Memorandum"),
    documentTitle: title,
    documentDate
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseWithdrawalCandidates(pageText, pageNumber, folder, provenance) {
  if (!/Withdrawal\/Redaction Sheet/i.test(pageText)) return [];
  const entries = [];
  const pageLines = lines(pageText);

  for (let i = 0; i < pageLines.length; i += 1) {
    const line = pageLines[i];
    if (!isWithdrawalStart(line)) continue;
    const chunks = [line];
    for (let j = i + 1; j < pageLines.length && j < i + 5; j += 1) {
      if (isWithdrawalStart(pageLines[j]) || /^(Collection|Record Group|Office|Series|Subseries|WHORM|File Location|Pinksheet|OA\/ID|Date Closed|FOIA)/i.test(pageLines[j])) {
        break;
      }
      chunks.push(pageLines[j]);
    }
    const raw = chunks.join(" ");
    const parsed = parseWithdrawalEntry(raw);
    if (!parsed) continue;
    if (!isPotentialPrintType(parsed.documentType, parsed.documentTitle)) continue;
    entries.push(buildCandidate({
      folder,
      provenance,
      pageNumber,
      extraction: "withdrawal-sheet",
      documentNo: parsed.documentNo,
      documentType: parsed.documentType,
      documentTitle: parsed.documentTitle,
      documentDate: parsed.documentDate,
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
      /(?:^|\b)(?:TALKING POINTS|SUGGESTED APPROACH|BRIEFING PAPER|BACKGROUND PAPER|CONGRATULATORY CALL)(?:\b|$)/i.test(line)
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
  if (/\bBRIEFING PAPER\b|\bBACKGROUND PAPER\b/i.test(pageText)) return "Briefing Paper";
  if (/\bACTION\b[\s\S]{0,500}\bSUBJECT:/i.test(pageText)) return "Action Memo";
  if (/\bINFORMATION\b[\s\S]{0,500}\bSUBJECT:/i.test(pageText)) return "Information Memo";
  if (/\bNSC\/S PROFILE\b/i.test(pageText)) return "NSC/S Profile";
  if (/\bWHITE HOUSE STAFFING MEMORANDUM\b/i.test(pageText)) return "Staffing Memorandum";
  return "";
}

function isBodyCandidatePage(pageText) {
  if (/FOIA\s+MARKER|Withdrawal\/Redaction Sheet|NSC\/S PROFILE/i.test(pageText)) return false;
  return /MEMORANDUM FOR|MEMORANDUM OF (?:TELEPHONE )?CONVERSATION|\bACTION\b[\s\S]{0,500}\bSUBJECT:|\bINFORMATION\b[\s\S]{0,500}\bSUBJECT:|\bTALKING POINTS\b|\bBRIEFING PAPER\b|\bBACKGROUND PAPER\b|\bWHITE HOUSE STAFFING MEMORANDUM\b/i.test(pageText);
}

function parseBodyCandidate(pageText, pageNumber, folder, provenance) {
  if (!isBodyCandidatePage(pageText)) return null;
  const documentType = pageDocumentType(pageText);
  const subject = subjectFromPage(pageText);
  const title = documentType === "Talking Points" || documentType === "Briefing Paper"
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
  if (/NSC\/S Profile|Staffing Memorandum/i.test(type)) return false;
  if (!hasUsableTitle(title)) return false;
  return /Memorandum|Memo|Action Memo|Information Memo|Talking Points|Letter|Cable|Report|Paper|Briefing|Memcon|Telcon|Meeting/i.test(text);
}

function hasUsableTitle(title) {
  const clean = cleanOcr(title);
  if (clean.length < 10) return false;
  if (/^(To|From|Date|Subject|Action|Information|Date, Time|S\/S|Received|Attachment|Tab)\b[:;]?$/i.test(clean)) return false;
  if (/\bReceived:/i.test(clean)) return false;
  if (/Subject\/Title of Document/i.test(clean)) return false;
  if (/^(To|From):\s*(President|Scowcroft)?$/i.test(clean)) return false;
  if (/^(CONFIDENTIAL|SECRET|UNCLASSIFIED|LIMITED OFFICIAL USE)\b/i.test(clean)) return false;
  if (/^[^a-zA-Z]*(?:\d+|[A-Z])[^a-zA-Z]*$/.test(clean)) return false;
  return true;
}

function isCentralAmericaOrCaribbeanOnly(candidate) {
  if ((candidate.countries || []).length) return false;
  const text = `${candidate.folderTitle} ${candidate.documentTitle} ${candidate.ocrSnippet}`;
  if (!/central america|caribbean|jamaica|manley|mexico|nicaragua|honduras|el salvador|guatemala|costa rica|panama/i.test(text)) {
    return false;
  }
  return !/enterprise for the americas|\bEAI\b|south america|latin america debt|latin american debt|official debt relief|economic initiative for latin america|latin america speech/i.test(text);
}

function isSouthAmericaCandidate(candidate) {
  if (/Uruguay Round/i.test(candidate.folderTitle) && (candidate.countries || []).length === 1 && candidate.countries[0] === "Uruguay") {
    return false;
  }
  if (isCentralAmericaOrCaribbeanOnly(candidate)) return false;
  return (candidate.countries || []).length > 0 || REGIONAL_TERMS.test(`${candidate.folderTitle} ${candidate.documentTitle} ${candidate.ocrSnippet}`);
}

function stripUruguayRoundReferences(text) {
  return (text || "")
    .replace(/\buruguay\b[\s\S]{0,180}\bround\b/gi, " ")
    .replace(/\bround\b[\s\S]{0,180}\buruguay\b/gi, " ");
}

function countryMatches(folder, title, snippet) {
  const text = `${folder.title} ${(folder.countries || []).join(" ")} ${title} ${snippet}`;
  const countries = new Set(folder.countries || []);
  for (const [country, pattern] of Object.entries(COUNTRY_TERMS)) {
    const countryText = country === "Uruguay" ? stripUruguayRoundReferences(text) : text;
    if (pattern.test(countryText)) countries.add(country);
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
  if (/Memorandum|Action Memo|Information Memo|Talking Points|Briefing Paper|Memcon|Telcon/i.test(type)) score += 35;
  if (/President|Bush|POTUS|Scowcroft|Baker|Brady|Mulford/i.test(text)) score += 20;
  if (/enterprise for the americas|\bEAI\b|debt|imf|world bank|brady|trade|investment|latin america|south america|hemisphere/i.test(text)) score += 20;
  if (/Meeting|Visit|Summit|Briefing|Recommendation|Decision|Options|Legislative|Strategy/i.test(text)) score += 12;
  if (/Letter|Cable|Report|Paper/i.test(type)) score += 8;
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
    id: `deal-print-${folder.naid}-${pageNumber}-${documentNo || documentType}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
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

  const folders = JSON.parse(fs.readFileSync(dealFilesPath, "utf8"));
  const allCandidates = [];
  const folderReports = [];

  for (const [index, folder] of folders.entries()) {
    if (!folder.pdfUrl) continue;
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
  fs.writeFileSync(outputScriptPath, `window.DEAL_PRINT_CANDIDATES = ${json};\n`);
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
        scannedFolders: folders.filter((folder) => folder.pdfUrl).length,
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
        regionalOnlyCount: candidates.filter((candidate) => !(candidate.countries || []).length).length,
        folderReports
      },
      null,
      2
    )}\n`
  );

  console.log(`Wrote ${candidates.length} Timothy E. Deal print candidates.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
