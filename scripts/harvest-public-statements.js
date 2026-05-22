const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const outputPath = path.join(repoRoot, "data", "public-statements.json");
const outputScriptPath = path.join(repoRoot, "data", "public-statements.js");
const reportPath = path.join(repoRoot, "reports", "public-statements-harvest.json");
const cacheRoot = path.join(repoRoot, ".cache", "govinfo-ppp");
const htmlCacheRoot = path.join(cacheRoot, "html");
const modsCacheRoot = path.join(cacheRoot, "mods");

const GOVINFO_COLLECTION_URL = "https://www.govinfo.gov/app/collection/ppp/president-41_Bush,%20George%20H.%20W.";
const COLLECTION_TITLE = "Public Papers of the Presidents of the United States: George H. W. Bush";

const GRANULE_PACKAGES = [
  { id: "PPP-1991-book1", year: 1991, book: "Book I" },
  { id: "PPP-1992-book1", year: 1992, book: "Book I" },
  { id: "PPP-1992-book2", year: 1992, book: "Book II" }
];

const PDF_TEXT_PACKAGES = [
  { id: "PPP-1989-book1", year: 1989, book: "Book I" },
  { id: "PPP-1989-book2", year: 1989, book: "Book II" },
  { id: "PPP-1990-book1", year: 1990, book: "Book I" },
  { id: "PPP-1990-book2", year: 1990, book: "Book II" },
  { id: "PPP-1991-book2", year: 1991, book: "Book II" }
];

const COUNTRY_TERMS = {
  Argentina: {
    search: ["Argentina", "Argentine", "Alfonsin", "Menem", "Di Tella"],
    detect: /\b(?:Argentina|Argentine|Alfonsin|Menem|Di Tella)\b/i
  },
  Bolivia: {
    search: ["Bolivia", "Bolivian", "Paz Zamora", "Paz Estenssoro"],
    detect: /\b(?:Bolivia|Bolivian|Paz Zamora|Paz Estenssoro)\b/i
  },
  Brazil: {
    search: ["Brazil", "Brazilian", "Sarney", "Collor"],
    detect: /\b(?:Brazil|Brazilian|Sarney|Collor)\b/i
  },
  Chile: {
    search: ["Chile", "Chilean", "Aylwin", "Pinochet"],
    detect: /\b(?:Chile|Chilean|Aylwin|Pinochet)\b/i
  },
  Colombia: {
    search: ["Colombia", "Colombian", "Barco", "Gaviria"],
    detect: /\b(?:Colombia|Colombian|Barco|Gaviria)\b/i
  },
  Ecuador: {
    search: ["Ecuador", "Ecuadoran", "Ecuadorian", "Borja"],
    detect: /\b(?:Ecuador|Ecuadoran|Ecuadorian|Borja)\b/i
  },
  Guyana: {
    search: ["Guyana", "Guyanese", "Hoyte"],
    detect: /\b(?:Guyana|Guyanese|Hoyte)\b/i
  },
  Paraguay: {
    search: ["Paraguay", "Paraguayan", "Stroessner", "Andres Rodriguez"],
    detect: /\b(?:Paraguay|Paraguayan|Stroessner|Andres Rodriguez)\b/i
  },
  Peru: {
    search: ["Peru", "Peruvian", "Fujimori", "Alan Garcia"],
    detect: /\b(?:Peru(?!,\s*Indiana)|Peruvian|Fujimori|Alan Garcia)\b/i
  },
  Suriname: {
    search: ["Suriname", "Surinamese", "Bouterse"],
    detect: /\b(?:Suriname|Surinamese|Bouterse)\b/i
  },
  Uruguay: {
    search: ["Uruguay", "Uruguayan", "Sanguinetti", "Lacalle"],
    detect: /\b(?:Uruguay|Uruguayan|Sanguinetti|Lacalle)\b/i
  },
  Venezuela: {
    search: ["Venezuela", "Venezuelan", "Carlos Andres Perez"],
    detect: /\b(?:Venezuela|Venezuelan|Carlos Andres Perez)\b/i
  }
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];
const MONTH_RE = MONTHS.join("|");
const DATE_LINE_RE = new RegExp(`^(${MONTH_RE})\\s+\\d{1,2}'?,\\s+(1989|1990|1991|1992|1993)$`, "i");
const DATE_IN_TEXT_RE = new RegExp(`\\b(${MONTH_RE})\\s+\\d{1,2}'?,\\s+(1989|1990|1991|1992|1993)\\b`, "i");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function normalizeSpaces(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function cleanText(value) {
  return normalizeSpaces(
    (value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\u00ad/g, "")
      .replace(/[‐-‒–—]/g, "-")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
  );
}

function decodeEntities(value) {
  return (value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8211;|&#8212;/g, "-")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8216;|&#8217;/g, "'")
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)));
}

function stripHtml(html) {
  return cleanText(
    decodeEntities(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
    )
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function dateToIso(value) {
  const clean = cleanText(value).replace(/\.$/, "").replace(/(\d{1,2})'+,/g, "$1,");
  const parsed = Date.parse(`${clean} UTC`);
  if (Number.isNaN(parsed)) return "";
  return new Date(parsed).toISOString().slice(0, 10);
}

function displayDate(value) {
  if (!value) return "Undated";
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed)) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(parsed);
}

function bookLabel(pkg) {
  return `${pkg.year}, ${pkg.book}`;
}

function pdfUrl(packageId, granuleId = "") {
  if (granuleId) return `https://www.govinfo.gov/content/pkg/${packageId}/pdf/${granuleId}.pdf`;
  return `https://www.govinfo.gov/content/pkg/${packageId}/pdf/${packageId}.pdf`;
}

function htmlUrl(packageId, granuleId) {
  return `https://www.govinfo.gov/content/pkg/${packageId}/html/${granuleId}.htm`;
}

function detailsUrl(packageId, granuleId = "") {
  return granuleId
    ? `https://www.govinfo.gov/app/details/${packageId}/${granuleId}`
    : `https://www.govinfo.gov/app/details/${packageId}`;
}

function sourceCitation(statement) {
  const pages = statement.pageStart
    ? statement.pageEnd && statement.pageEnd !== statement.pageStart
      ? `, pp. ${statement.pageStart}-${statement.pageEnd}`
      : `, p. ${statement.pageStart}`
    : "";
  return `Source: ${COLLECTION_TITLE}, ${statement.bookLabel}, ${displayDate(statement.documentDate)}, "${statement.title}"${pages}. GovInfo, Government Publishing Office.`;
}

function documentType(title) {
  const clean = cleanText(title);
  if (/news conference/i.test(clean)) return "News Conference";
  if (/question-and-answer|exchange with reporters|exchange of remarks/i.test(clean)) return "Exchange";
  if (/interview/i.test(clean)) return "Interview";
  if (/^remarks\b/i.test(clean)) return "Remarks";
  if (/^statement\b/i.test(clean)) return "Statement";
  if (/^message\b/i.test(clean)) return "Message";
  if (/^letter\b/i.test(clean)) return "Letter";
  if (/^memorandum\b|presidential determination/i.test(clean)) return "Memorandum";
  if (/^proclamation\b/i.test(clean)) return "Proclamation";
  if (/^executive order\b/i.test(clean)) return "Executive Order";
  if (/^nomination\b/i.test(clean)) return "Nomination";
  if (/^(appointment|continuation)\b/i.test(clean)) return "Appointment";
  return "Public Paper";
}

function countriesInText(text) {
  const matches = [];
  for (const [country, config] of Object.entries(COUNTRY_TERMS)) {
    const countryText = country === "Uruguay" ? stripUruguayRoundReferences(text) : text;
    if (config.detect.test(countryText)) matches.push(country);
  }
  return matches;
}

function countriesForStatement(title, text) {
  const countries = countriesInText(text);
  const type = documentType(title);
  if (type === "Nomination" || type === "Appointment") {
    return countriesInText(title);
  }
  return countries;
}

function stripUruguayRoundReferences(text) {
  return (text || "")
    .replace(/\bStatement on the\s+Uruguay\s+Round\s+Multilateral\s+Trade\s+Negotiations\b/gi, " ")
    .replace(/\b(?:Uruguay|U\s+ruguay)\b[\s\S]{0,320}\bround\b/gi, " ")
    .replace(/\bround\b[\s\S]{0,320}\b(?:Uruguay|U\s+ruguay)\b/gi, " ");
}

function contextSnippet(text, countries) {
  const patterns = countries
    .flatMap((country) => COUNTRY_TERMS[country].search)
    .filter((term) => term !== "Perez" && term !== "Rodriguez")
    .map(escapeRegExp);
  const pattern = patterns.length ? new RegExp(patterns.join("|"), "i") : null;
  const index = pattern ? text.search(pattern) : -1;
  const start = index === -1 ? 0 : Math.max(0, index - 180);
  const end = index === -1 ? 360 : Math.min(text.length, index + 360);
  return cleanText(text.slice(start, end));
}

function searchQuery(terms) {
  const quoted = terms.map((term) => (/\s/.test(term) ? `"${term}"` : term));
  return `collection:ppp president:"George H. W. Bush" (${quoted.join(" OR ")})`;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

async function searchCountry(country, terms) {
  const query = searchQuery(terms);
  const resultSet = [];
  let total = 0;

  for (let offset = 0; ; offset += 100) {
    const json = await fetchJson("https://www.govinfo.gov/wssearch/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, offset, pageSize: 100, sortBy: 2, historical: false })
    });
    const page = json.resultSet || [];
    total = json.iTotalCount || page.length;
    resultSet.push(...page);
    if (!page.length || resultSet.length >= total || page.length < 100) break;
  }

  return { country, query, total, resultSet };
}

function readOrFetchText(url, targetPath) {
  if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 0) {
    return fs.readFileSync(targetPath, "utf8");
  }
  const output = childProcess.execFileSync("curl", ["-L", "--fail", "--retry", "5", "--retry-delay", "1", "--retry-all-errors", url], {
    encoding: "utf8",
    maxBuffer: 60 * 1024 * 1024
  });
  fs.writeFileSync(targetPath, output);
  return output;
}

function fetchPackageMods(packageId) {
  ensureDir(modsCacheRoot);
  const targetPath = path.join(modsCacheRoot, `${packageId}.xml`);
  return readOrFetchText(`https://www.govinfo.gov/metadata/pkg/${packageId}/mods.xml`, targetPath);
}

function tagValue(block, tag) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? cleanText(decodeEntities(match[1].replace(/<[^>]+>/g, " "))) : "";
}

function parsePackageMods(packageId) {
  const xml = fetchPackageMods(packageId);
  const metadata = new Map();
  const blocks = xml.match(/<relatedItem type="constituent"[\s\S]*?<\/relatedItem>/g) || [];

  for (const block of blocks) {
    const accessId = tagValue(block, "accessId");
    if (!accessId) continue;
    const granuleClass = tagValue(block, "granuleClass");
    const title = tagValue(block, "title");
    const eventDate = tagValue(block, "eventDate");
    const pageStart = tagValue(block, "start");
    const pageEnd = tagValue(block, "end");
    const preferredCitation = tagValue(block, "identifier type=\"preferred citation\"") || "";
    metadata.set(accessId, {
      packageId,
      granuleId: accessId,
      granuleClass,
      title,
      eventDate,
      pageStart: /^\d+$/.test(pageStart) ? Number(pageStart) : null,
      pageEnd: /^\d+$/.test(pageEnd) ? Number(pageEnd) : null,
      preferredCitation,
      notes: tagValue(block, "notes")
    });
  }

  return metadata;
}

function parseLineDate(line2) {
  const match = cleanText(line2).match(/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+([^.]*)\./i);
  if (match) return dateToIso(match[1]);
  const date = cleanText(line2).match(DATE_IN_TEXT_RE)?.[0] || "";
  return dateToIso(date);
}

function granuleStatementFromResult(result, packageInfo, mods) {
  const fieldMap = result.fieldMap || {};
  const packageId = fieldMap.packageid;
  const granuleId = fieldMap.granuleid;
  if (!packageId || !granuleId || !/-doc-/.test(granuleId)) return null;

  const metadata = mods.get(granuleId) || {};
  if (metadata.granuleClass && metadata.granuleClass !== "PRESDOCU") return null;

  const title = cleanText(metadata.title || fieldMap.title || result.line1?.replace(/^\d{4}\s+Public Papers\s+\d+\s+-\s+/, ""));
  const targetPath = path.join(htmlCacheRoot, `${granuleId}.htm`);
  const rawHtml = readOrFetchText(fieldMap.url || htmlUrl(packageId, granuleId), targetPath);
  const text = stripHtml(rawHtml);
  const countries = countriesForStatement(title, text);
  if (!countries.length) return null;

  const documentDate = metadata.eventDate || parseLineDate(result.line2) || dateToIso(text.match(DATE_IN_TEXT_RE)?.[0] || "");
  const pageStart = metadata.pageStart || Number(result.line1?.match(/\bPublic Papers\s+(\d+)\b/)?.[1] || 0) || null;
  const pageEnd = metadata.pageEnd || pageStart;
  const statement = {
    id: `govinfo-${granuleId}`,
    title,
    documentDate,
    sortDate: documentDate || "",
    documentType: documentType(title),
    countries,
    bookLabel: bookLabel(packageInfo),
    packageId,
    granuleId,
    pageStart,
    pageEnd,
    htmlUrl: htmlUrl(packageId, granuleId),
    pdfUrl: pdfUrl(packageId, granuleId),
    detailsUrl: detailsUrl(packageId, granuleId),
    pageLink: pdfUrl(packageId, granuleId),
    extraction: "govinfo-granule-html",
    snippet: contextSnippet(text, countries),
    sourceCollection: {
      name: COLLECTION_TITLE,
      url: GOVINFO_COLLECTION_URL
    }
  };
  statement.sourceNote = sourceCitation(statement);
  return statement;
}

function downloadPdf(packageId) {
  const pdfPath = path.join(cacheRoot, `${packageId}.pdf`);
  if (fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 0) return pdfPath;
  const url = pdfUrl(packageId);
  childProcess.execFileSync(
    "curl",
    ["-L", "--fail", "--retry", "8", "--retry-delay", "2", "--retry-all-errors", "--http1.1", "-C", "-", "-o", pdfPath, url],
    { stdio: "inherit" }
  );
  return pdfPath;
}

function extractPdfText(packageId) {
  const textPath = path.join(cacheRoot, `${packageId}.txt`);
  if (fs.existsSync(textPath) && fs.statSync(textPath).size > 0) return textPath;
  const pdfPath = downloadPdf(packageId);
  childProcess.execFileSync("pdftotext", ["-layout", "-enc", "UTF-8", pdfPath, textPath], { stdio: "inherit" });
  return textPath;
}

function isPageHeader(line) {
  return /Administration of George Bush|Public Papers of the Presidents|^\s*George Bush\s*$/i.test(line);
}

function isAppendixMarker(line) {
  return /^(Appendix [A-F]|Document Categories List|Subject Index|Name Index)\b/i.test(cleanText(line));
}

function isPlausibleTitle(title) {
  const clean = cleanText(title);
  if (clean.length < 12 || clean.length > 220) return false;
  if (/[.!?]$/.test(clean)) return false;
  return /^(The President|Remarks|Statement|Message|Letter|Memorandum|Exchange|Interview|Nomination|Appointment|Continuation|Proclamation|Executive Order|Toast|Address|Written Responses|Remarks and|Question-and-Answer|Remarks at|Remarks to|Remarks on|Remarks Following|Remarks Prior|Radio Address|Videotaped Remarks|Telephone Remarks|Remarks With|News Conference)\b/i.test(clean);
}

function printedPageNumber(pageText) {
  const lines = pageText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const candidates = lines.filter((line) => /^\d{1,4}$/.test(line)).map(Number);
  return candidates.length ? candidates[candidates.length - 1] : null;
}

function flattenPages(pages) {
  const rows = [];
  pages.forEach((pageText, pageIndex) => {
    const pageNumber = pageIndex + 1;
    const printedPage = printedPageNumber(pageText);
    pageText.split(/\r?\n/).forEach((line, lineIndex) => {
      rows.push({
        text: line,
        clean: cleanText(line),
        blank: !cleanText(line),
        pageNumber,
        printedPage,
        lineIndex
      });
    });
  });
  return rows;
}

function findTitleStart(rows, dateIndex) {
  const titleLines = [];
  let start = dateIndex - 1;

  for (let index = dateIndex - 1; index >= 0 && titleLines.length < 5; index -= 1) {
    const row = rows[index];
    if (!row || row.blank) break;
    if (isPageHeader(row.clean) || /^\d{1,4}$/.test(row.clean)) break;
    titleLines.unshift(row.clean);
    start = index;
  }

  const title = cleanText(titleLines.join(" "));
  return isPlausibleTitle(title) ? { start, title } : null;
}

function splitVolumeDocuments(packageInfo) {
  const textPath = extractPdfText(packageInfo.id);
  const text = fs.readFileSync(textPath, "utf8");
  const pages = text.split("\f");
  const rows = flattenPages(pages);
  const starts = [];

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (!DATE_LINE_RE.test(row.clean)) continue;
    const title = findTitleStart(rows, index);
    if (!title) continue;
    starts.push({
      rowIndex: title.start,
      dateIndex: index,
      title: title.title,
      documentDate: dateToIso(row.clean),
      pdfPageStart: rows[title.start].pageNumber,
      pageStart: rows[title.start].printedPage || rows[index].printedPage
    });
  }

  const firstDocumentIndex = starts[0]?.rowIndex || 0;
  const appendixIndex = rows.findIndex((row, index) => index > firstDocumentIndex && isAppendixMarker(row.clean));
  const maxIndex = appendixIndex === -1 ? rows.length : appendixIndex;
  const documentStarts = starts.filter((start) => start.rowIndex < maxIndex);

  return documentStarts.map((start, index) => {
    const next = documentStarts[index + 1];
    const endIndex = next ? next.rowIndex : maxIndex;
    const docRows = rows.slice(start.rowIndex, endIndex);
    const text = cleanText(docRows.map((row) => row.clean).join(" "));
    const lastPage = docRows.map((row) => row.printedPage).filter(Boolean).pop() || start.pageStart;
    return {
      ...start,
      pageEnd: lastPage,
      text
    };
  });
}

function volumeStatementFromDoc(doc, packageInfo) {
  const countries = countriesForStatement(doc.title, doc.text);
  if (!countries.length) return null;
  const statement = {
    id: `govinfo-${packageInfo.id}-${doc.pdfPageStart}-${doc.title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    title: doc.title,
    documentDate: doc.documentDate,
    sortDate: doc.documentDate || "",
    documentType: documentType(doc.title),
    countries,
    bookLabel: bookLabel(packageInfo),
    packageId: packageInfo.id,
    granuleId: "",
    pageStart: doc.pageStart,
    pageEnd: doc.pageEnd,
    htmlUrl: "",
    pdfUrl: pdfUrl(packageInfo.id),
    detailsUrl: detailsUrl(packageInfo.id),
    pageLink: `${pdfUrl(packageInfo.id)}#page=${doc.pdfPageStart}`,
    extraction: "govinfo-volume-pdf-text",
    snippet: contextSnippet(doc.text, countries),
    sourceCollection: {
      name: COLLECTION_TITLE,
      url: GOVINFO_COLLECTION_URL
    }
  };
  statement.sourceNote = sourceCitation(statement);
  return statement;
}

function dedupeStatements(statements) {
  const byKey = new Map();
  for (const statement of statements) {
    const key = statement.granuleId || [
      statement.packageId,
      statement.documentDate,
      statement.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    ].join("|");
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, statement);
      continue;
    }
    existing.countries = [...new Set([...existing.countries, ...statement.countries])].sort((a, b) => a.localeCompare(b));
  }
  return [...byKey.values()].sort(
    (a, b) =>
      (a.sortDate || "").localeCompare(b.sortDate || "") ||
      (a.pageStart || 0) - (b.pageStart || 0) ||
      a.title.localeCompare(b.title)
  );
}

async function harvestGranuleStatements() {
  ensureDir(htmlCacheRoot);
  const searches = [];
  const resultsByGranule = new Map();

  for (const [country, config] of Object.entries(COUNTRY_TERMS)) {
    console.log(`Searching GovInfo PPP for ${country}`);
    const search = await searchCountry(country, config.search);
    searches.push({
      country,
      query: search.query,
      total: search.total,
      returned: search.resultSet.length
    });
    for (const result of search.resultSet) {
      const fieldMap = result.fieldMap || {};
      if (!fieldMap.granuleid) continue;
      resultsByGranule.set(fieldMap.granuleid, result);
    }
  }

  const modsByPackage = new Map(GRANULE_PACKAGES.map((pkg) => [pkg.id, parsePackageMods(pkg.id)]));
  const packageById = new Map(GRANULE_PACKAGES.map((pkg) => [pkg.id, pkg]));
  const statements = [];

  for (const result of resultsByGranule.values()) {
    const packageId = result.fieldMap?.packageid;
    const packageInfo = packageById.get(packageId);
    if (!packageInfo) continue;
    const statement = granuleStatementFromResult(result, packageInfo, modsByPackage.get(packageId));
    if (statement) statements.push(statement);
  }

  return { statements, searches, searchedGranules: resultsByGranule.size };
}

function harvestVolumeStatements() {
  const statements = [];
  const packages = [];

  for (const packageInfo of PDF_TEXT_PACKAGES) {
    console.log(`Extracting volume text for ${packageInfo.id}`);
    const docs = splitVolumeDocuments(packageInfo);
    const packageStatements = docs.map((doc) => volumeStatementFromDoc(doc, packageInfo)).filter(Boolean);
    statements.push(...packageStatements);
    packages.push({
      packageId: packageInfo.id,
      bookLabel: bookLabel(packageInfo),
      parsedDocuments: docs.length,
      matchingStatements: packageStatements.length
    });
  }

  return { statements, packages };
}

async function main() {
  ensureDir(cacheRoot);
  ensureDir(path.dirname(outputPath));
  ensureDir(path.dirname(reportPath));

  const granule = await harvestGranuleStatements();
  const volume = harvestVolumeStatements();
  const statements = dedupeStatements([...granule.statements, ...volume.statements]);
  const json = JSON.stringify(statements, null, 2);

  fs.writeFileSync(outputPath, `${json}\n`);
  fs.writeFileSync(outputScriptPath, `window.PUBLIC_STATEMENTS = ${json};\n`);
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceCollection: {
          name: COLLECTION_TITLE,
          url: GOVINFO_COLLECTION_URL
        },
        statementCount: statements.length,
        granuleHtmlStatements: granule.statements.length,
        volumePdfStatements: volume.statements.length,
        countryCounts: Object.fromEntries(
          Object.keys(COUNTRY_TERMS).map((country) => [
            country,
            statements.filter((statement) => statement.countries.includes(country)).length
          ])
        ),
        typeCounts: statements.reduce((counts, statement) => {
          counts[statement.documentType] = (counts[statement.documentType] || 0) + 1;
          return counts;
        }, {}),
        searches: granule.searches,
        searchedGranules: granule.searchedGranules,
        volumePackages: volume.packages
      },
      null,
      2
    )}\n`
  );

  console.log(`Wrote ${statements.length} public statement references.`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  countriesInText,
  splitVolumeDocuments,
  stripUruguayRoundReferences,
  volumeStatementFromDoc
};
