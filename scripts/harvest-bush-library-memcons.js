const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const dataPath = path.join(repoRoot, "data", "memcons.json");
const dataScriptPath = path.join(repoRoot, "data", "memcons.js");
const reportPath = path.join(repoRoot, "reports", "bush-library-memcons-harvest.json");

const TABLE_URL = "https://www.bush41library.gov/digital-research-room/about-textual-collections/memcons-and-telcons";
const FINDING_AID_URL =
  "https://www.bush41library.gov/digital-research-room/finding-aid/records-national-security-council-george-h-w-bush-administration";
const SOURCE_COLLECTION = {
  name: "Records of the National Security Council (George H. W. Bush Administration)",
  url: "https://catalog.archives.gov/id/2163580",
  findingAidUrl: FINDING_AID_URL,
  referenceUnit: "George Bush Library"
};
const PRIORITY_COLLECTION = {
  name: "Latin American Directorate Chronological Files",
  naid: "2197972",
  url: "https://catalog.archives.gov/id/2197972",
  localIdentifier: "GB-NSC-267"
};
const SERIES = {
  Memcon: {
    name: "Presidential Memcon Files",
    naid: "321498039",
    url: "https://catalog.archives.gov/id/321498039"
  },
  Telcon: {
    name: "Presidential Telcon Files",
    naid: "321498139",
    url: "https://catalog.archives.gov/id/321498139"
  }
};
const FRUS_VOLUME = "Foreign Relations of the United States, 1989-1992, Volume XXV, Latin America";
const SOUTH_AMERICA_COUNTRIES = new Set([
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
]);
const CHAPTER_BY_COUNTRY = {
  Argentina: { number: 1, name: "Argentina" },
  Bolivia: { number: 2, name: "Bolivia" },
  Brazil: { number: 3, name: "Brazil" },
  Chile: { number: 4, name: "Chile" },
  Colombia: { number: 5, name: "Colombia" },
  Ecuador: { number: 6, name: "Ecuador" },
  Guyana: { number: 7, name: "Guyana" },
  Paraguay: { number: 8, name: "Paraguay" },
  Peru: { number: 9, name: "Peru" },
  Suriname: { number: 10, name: "Suriname" },
  Uruguay: { number: 11, name: "Uruguay" },
  Venezuela: { number: 12, name: "Venezuela" }
};
const PARTICIPANT_OVERRIDES = {
  "Alfonsin, Raul": "Raul Alfonsin",
  "Collor de Mello, Fernando": "Fernando Collor de Mello",
  "Fujimori, Alberto": "Alberto Fujimori",
  "Gaviria, Cesar": "Cesar Gaviria",
  "Menem, Carlos Saul": "Carlos Saul Menem",
  "Perez, Carlos Andres": "Carlos Andres Perez"
};

function decodeHtml(value) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function rowsFromHtml(html) {
  return [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
    .map((row) => [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => decodeHtml(cell[1])))
    .filter((cells) => cells.length === 6)
    .map(([date, type, participants, country, status, naid]) => ({ date, type, participants, country, status, naid }));
}

function parseTableDate(value) {
  const [month, day, year] = value.split("/").map((part) => Number(part));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function displayDate(isoDate) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

function normalize(value) {
  return (value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function participantDisplay(tableName) {
  if (PARTICIPANT_OVERRIDES[tableName]) return PARTICIPANT_OVERRIDES[tableName];
  const parts = tableName.split(",").map((part) => part.trim());
  return parts.length > 1 ? `${parts.slice(1).join(" ")} ${parts[0]}`.replace(/\s+/g, " ") : tableName;
}

function participantTokens(displayName) {
  return normalize(displayName)
    .split(" ")
    .filter((token) => token.length > 2 && !["prime", "minister", "president", "king"].includes(token));
}

function dateDistanceDays(a, b) {
  const left = new Date(`${a}T00:00:00Z`).getTime();
  const right = new Date(`${b}T00:00:00Z`).getTime();
  return Math.abs(left - right) / 86400000;
}

function isDuplicate(existing, incoming) {
  const incomingType = incoming.type || incoming.row?.type;
  if (!["Memcon", "Telcon"].includes(existing.type)) return false;
  if (existing.chapter?.name !== incoming.chapter.name) return false;
  if (existing.type !== incomingType) return false;

  const existingHaystack = normalize(`${existing.title} ${(existing.participants || []).join(" ")} ${existing.subjectLine || ""}`);
  const existingTitleHaystack = normalize(`${existing.title} ${existing.subjectLine || ""}`);
  const incomingTokens = participantTokens(incoming.counterpart);
  const participantMatch = incomingTokens.some((token) => existingHaystack.includes(token));
  if (!participantMatch) return false;

  if (existing.sortDate === incoming.date) return true;
  if (dateDistanceDays(existing.sortDate, incoming.date) <= 2 && incomingTokens.some((token) => existingTitleHaystack.includes(token))) {
    return true;
  }
  return false;
}

function ancestor(record, level) {
  return (record.ancestors || []).find((item) => item.levelOfDescription === level);
}

function variantNumbers(record, type) {
  return (record.variantControlNumbers || [])
    .filter((item) => item.type === type)
    .map((item) => item.number);
}

function sourceNoteFor(row, catalogRecord, digitalObject, duplicateSources) {
  const series = ancestor(catalogRecord, "series");
  const fileUnit = ancestor(catalogRecord, "fileUnit");
  const foiaNumbers = variantNumbers(catalogRecord, "FOIA Tracking Number");
  const pieces = [
    `Source: George H.W. Bush Presidential Library and Museum, Digital Research Room, "Memcons and Telcons" table (${TABLE_URL}), row: Date ${row.date}; Type ${row.type}; Participants ${row.participants}; Country ${row.country}; Release Status ${row.status || "blank"}; NAID ${row.naid}.`,
    `Priority collection for volume compilation: ${PRIORITY_COLLECTION.name}, NAID ${PRIORITY_COLLECTION.naid}, ${PRIORITY_COLLECTION.url}.`,
    `National Archives Catalog item: ${catalogRecord.title}, NAID ${catalogRecord.naId}.`,
    `Collection: ${SOURCE_COLLECTION.name}, NAID 2163580.`,
    series ? `Series: ${series.title}, NAID ${series.naId}.` : `Series: ${SERIES[row.type].name}, NAID ${SERIES[row.type].naid}.`,
    fileUnit ? `File unit: ${fileUnit.title}, NAID ${fileUnit.naId}.` : "",
    digitalObject ? `Digital object: ${digitalObject.objectFilename}, object ID ${digitalObject.objectId}, URL ${digitalObject.objectUrl}.` : "Digital object: none listed in Catalog.",
    foiaNumbers.length ? `FOIA tracking: ${foiaNumbers.join(", ")}.` : "",
    `Access restriction: ${catalogRecord.accessRestriction?.status || row.status || "not stated"}.`,
    duplicateSources.length
      ? `Deduped local provenance: ${duplicateSources
          .map((source) => `${source.sourceName || "Prior local record"}${source.series ? `, ${source.series}` : ""}${source.naid ? `, NAID ${source.naid}` : ""}${source.localIdentifier ? `, ${source.localIdentifier}` : ""}${source.sourcePages ? `, source pages ${source.sourcePages}` : ""}`)
          .join("; ")}.`
      : ""
  ];
  return pieces.filter(Boolean).join(" ");
}

function duplicateSourceFor(record) {
  return {
    id: record.id,
    sourceName: record.source?.name,
    series: record.source?.series,
    naid: record.naid,
    localIdentifier: record.localIdentifier,
    sourcePages: record.source?.sourcePages,
    catalogUrl: record.catalogUrl,
    pdfUrl: record.pdfUrl,
    sourceNote: record.sourceNote
  };
}

function countriesFor(row, counterpart) {
  const countries = new Set(["United States", row.country]);
  if (counterpart && !countries.has(counterpart)) countries.add(counterpart);
  return [...countries];
}

function toRecord(row, catalogRecord, duplicateSources) {
  const date = parseTableDate(row.date);
  const counterpart = participantDisplay(row.participants);
  const chapter = CHAPTER_BY_COUNTRY[row.country];
  const digitalObject = (catalogRecord.digitalObjects || []).find((object) => object.objectUrl);
  const series = ancestor(catalogRecord, "series") || SERIES[row.type];
  const fileUnit = ancestor(catalogRecord, "fileUnit");
  const sourceNote = sourceNoteFor(row, catalogRecord, digitalObject, duplicateSources);

  return {
    id: `bush-library-${row.naid}`,
    date,
    sortDate: date,
    type: row.type,
    title: catalogRecord.title || `${row.type}: President Bush and ${counterpart}`,
    sourceTitle: `${series.title || series.name}; ${fileUnit?.title || "file unit pending"}`,
    participants: ["George H. W. Bush", counterpart],
    countries: countriesFor(row, row.country),
    chapter,
    releaseStatus: row.status || catalogRecord.accessRestriction?.status || "Not stated",
    naid: row.naid,
    localIdentifier: fileUnit?.title || "",
    pdfUrl: digitalObject?.objectUrl || "",
    catalogUrl: `https://catalog.archives.gov/id/${row.naid}`,
    source: {
      ...SOURCE_COLLECTION,
      priorityCollection: PRIORITY_COLLECTION,
      tableUrl: TABLE_URL,
      tableRow: row,
      series: series.title || series.name,
      seriesNaid: String(series.naId || series.naid),
      seriesUrl: `https://catalog.archives.gov/id/${series.naId || series.naid}`,
      fileUnitTitle: fileUnit?.title || "",
      fileUnitNaid: fileUnit?.naId ? String(fileUnit.naId) : "",
      objectUrl: digitalObject?.objectUrl || "",
      objectFilename: digitalObject?.objectFilename || "",
      objectId: digitalObject?.objectId || "",
      duplicateSources
    },
    frusVolume: FRUS_VOLUME,
    frusTopics: ["Latin America", "South America", row.country, "Bush Library Memcons and Telcons", row.type],
    topics: ["Latin America", "South America", row.country, row.type, "Head of state"],
    pageCount: duplicateSources[0]?.pageCount || 0,
    notes: duplicateSources.length
      ? "Integrated from the Bush Library Memcons and Telcons table and deduped against an existing local record."
      : "Integrated from the Bush Library Memcons and Telcons table, enriched from the National Archives Catalog item record, and cross-referenced to the Latin American Directorate Chronological Files collection.",
    documentTitle: row.type === "Telcon" ? "Memorandum of Telephone Conversation" : "Memorandum of Conversation",
    subjectLine: catalogRecord.title || `${row.type}: President Bush and ${counterpart}`,
    dateLine: displayDate(date),
    sourceNote
  };
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Fetch failed ${response.status}: ${url}`);
  return response.text();
}

async function fetchCatalogRecord(naid) {
  const url = new URL("https://catalog.archives.gov/proxy/records/search");
  url.searchParams.set("naId", naid);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Catalog fetch failed ${response.status}: ${url}`);
  const json = await response.json();
  const record = json.body?.hits?.hits?.[0]?._source?.record;
  if (!record) throw new Error(`No Catalog record found for NAID ${naid}`);
  return record;
}

async function harvestTableRows() {
  const rows = [];
  for (let page = 0; page <= 68; page += 1) {
    const url = page === 0 ? TABLE_URL : `${TABLE_URL}?page=${page}`;
    rows.push(...rowsFromHtml(await fetchText(url)));
  }
  return rows;
}

function mergeRecords(existing, additions) {
  const incomingIds = new Set(additions.map((addition) => `bush-library-${addition.row.naid}`));
  const remaining = existing.filter((record) => !incomingIds.has(record.id));
  const merged = [];
  const dedupeLog = [];

  for (const addition of additions) {
    const duplicateSources = [];
    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      if (!isDuplicate(remaining[index], addition)) continue;
      duplicateSources.push({ ...duplicateSourceFor(remaining[index]), pageCount: remaining[index].pageCount || 0 });
      remaining.splice(index, 1);
    }
    const record = toRecord(addition.row, addition.catalogRecord, duplicateSources.reverse());
    merged.push(record);
    if (duplicateSources.length) {
      dedupeLog.push({
        naid: addition.row.naid,
        title: record.title,
        replaced: duplicateSources.map((source) => ({ id: source.id, naid: source.naid, sourceName: source.sourceName }))
      });
    }
  }

  return {
    records: [...remaining, ...merged].sort(
      (a, b) => a.chapter.number - b.chapter.number || a.sortDate.localeCompare(b.sortDate) || a.title.localeCompare(b.title)
    ),
    dedupeLog
  };
}

async function main() {
  const existing = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const tableRows = await harvestTableRows();
  const relevantRows = tableRows.filter(
    (row) => ["Memcon", "Telcon"].includes(row.type) && SOUTH_AMERICA_COUNTRIES.has(row.country)
  );
  const additions = [];

  for (const row of relevantRows) {
    additions.push({ row, catalogRecord: await fetchCatalogRecord(row.naid), chapter: CHAPTER_BY_COUNTRY[row.country], counterpart: participantDisplay(row.participants), date: parseTableDate(row.date) });
  }

  const { records, dedupeLog } = mergeRecords(existing, additions);
  const json = JSON.stringify(records, null, 2);
  fs.writeFileSync(dataPath, `${json}\n`);
  fs.writeFileSync(dataScriptPath, `window.MEMCONS = ${json};\n`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        tableUrl: TABLE_URL,
        sourceCollection: SOURCE_COLLECTION,
        priorityCollection: PRIORITY_COLLECTION,
        rowsScanned: tableRows.length,
        relevantRowCount: relevantRows.length,
        addedOrReplacedRecords: additions.length,
        dedupedRecords: dedupeLog.length,
        dedupeLog,
        relevantRows
      },
      null,
      2
    )}\n`
  );
  console.log(`Integrated ${additions.length} Bush Library memcon/telcon records; deduped ${dedupeLog.length}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
