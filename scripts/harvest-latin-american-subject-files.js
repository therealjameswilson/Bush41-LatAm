const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const dataPath = path.join(repoRoot, "data", "subject-files.json");
const dataScriptPath = path.join(repoRoot, "data", "subject-files.js");
const reportPath = path.join(repoRoot, "reports", "latin-american-subject-files-harvest.json");

const COLLECTION_NAID = "2163580";
const SERIES_NAID = "376217847";
const COLLECTION_NAME = "Records of the National Security Council (George H. W. Bush Administration)";
const SERIES_NAME = "Latin American Affairs Directorate Subject Files";

const COUNTRIES = [
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

const COUNTRY_ALIASES = {
  Argentina: ["Alfonsin", "Menem", "Di Tella", "Argentine"],
  Bolivia: ["Paz Zamora", "Bolivian"],
  Brazil: ["Sarney", "Collor", "Brazilian", "Brasilia"],
  Chile: ["Aylwin", "Pinochet", "Chilean"],
  Colombia: ["Barco", "Gaviria", "Colombian"],
  Ecuador: ["Borja", "Ecuadoran", "Ecuadorian"],
  Guyana: ["Hoyte", "Guyanese"],
  Paraguay: ["Rodriguez", "Stroessner", "Paraguayan"],
  Peru: ["Garcia", "Fujimori", "Peruvian"],
  Suriname: ["Bouterse", "Surinamese"],
  Uruguay: ["Lacalle", "Sanguinetti", "Uruguayan"],
  Venezuela: ["Carlos Andres Perez", "Perez", "Venezuelan"]
};

const REGIONAL_TERMS = [
  "South America",
  "Latin America",
  "Andean",
  "Rio Group",
  "Organization of American States",
  "OAS",
  "hemispheric",
  "narcotics",
  "drug",
  "debt",
  "business groups",
  "Columbus Group"
];

function normalize(value) {
  return (value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function logicalDate(date) {
  return date?.logicalDate || "";
}

function ancestor(record, level) {
  return (record.ancestors || []).find((item) => item.levelOfDescription === level);
}

function hasSeriesAncestor(record) {
  return String(record.naId) === SERIES_NAID || (record.ancestors || []).some((item) => String(item.naId) === SERIES_NAID);
}

function digitalObject(record) {
  return (record.digitalObjects || []).find((object) => object.objectUrl) || null;
}

function variants(record) {
  return (record.variantControlNumbers || []).map((item) => `${item.type}: ${item.number}`);
}

function recordText(record) {
  return normalize(
    [
      record.title,
      record.scopeAndContentNote,
      record.localIdentifier,
      record.generalNotes?.join(" "),
      record.digitalObjects?.map((object) => object.objectFilename).join(" ")
    ].join(" ")
  );
}

function countriesFor(record) {
  const haystack = recordText(record);
  return COUNTRIES.filter((country) => {
    const terms = [country, ...(COUNTRY_ALIASES[country] || [])].map(normalize);
    return terms.some((term) => term && haystack.includes(term));
  });
}

function topicsFor(record) {
  const haystack = recordText(record);
  return REGIONAL_TERMS.filter((term) => haystack.includes(normalize(term)));
}

function dateFor(record) {
  return (
    logicalDate(record.coverageStartDate) ||
    logicalDate(record.inclusiveStartDate) ||
    logicalDate(record.productionDateArray?.[0]) ||
    ""
  );
}

function toRecord(record) {
  const object = digitalObject(record);
  const series = ancestor(record, "series");
  const physical = record.physicalOccurrences?.[0] || {};
  const media = physical.mediaOccurrences?.[0] || {};

  return {
    id: `subject-files-${record.naId}`,
    naid: String(record.naId),
    title: record.title,
    levelOfDescription: record.levelOfDescription,
    localIdentifier: record.localIdentifier || "",
    countries: countriesFor(record),
    sortDate: dateFor(record),
    startDate: dateFor(record),
    endDate: logicalDate(record.coverageEndDate || record.inclusiveEndDate),
    topics: topicsFor(record),
    catalogUrl: `https://catalog.archives.gov/id/${record.naId}`,
    pdfUrl: object?.objectUrl || "",
    objectFilename: object?.objectFilename || "",
    objectId: object?.objectId || "",
    objectFileSize: object?.objectFileSize || null,
    accessRestriction: record.accessRestriction?.status || "",
    useRestriction: record.useRestriction?.status || "",
    containerId: media.containerId || "",
    variantControlNumbers: variants(record),
    series: {
      naid: String(series?.naId || SERIES_NAID),
      title: series?.title || SERIES_NAME,
      url: `https://catalog.archives.gov/id/${series?.naId || SERIES_NAID}`
    },
    collection: {
      naid: COLLECTION_NAID,
      title: COLLECTION_NAME,
      url: `https://catalog.archives.gov/id/${COLLECTION_NAID}`
    },
    referenceUnit: physical.referenceUnits?.[0]?.name || "George Bush Library"
  };
}

async function fetchCatalogPage(page) {
  const url = new URL("https://catalog.archives.gov/proxy/records/search");
  url.searchParams.set("q", SERIES_NAID);
  url.searchParams.set("limit", "100");
  url.searchParams.set("page", String(page));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Catalog search failed ${response.status}: ${url}`);
  return response.json();
}

async function harvestRecords() {
  const records = [];
  const scanned = [];

  for (let page = 1; ; page += 1) {
    const json = await fetchCatalogPage(page);
    const hits = json.body?.hits?.hits || [];
    if (!hits.length) break;

    for (const hit of hits) {
      const record = hit._source?.record;
      if (!record || record.levelOfDescription !== "fileUnit" || !hasSeriesAncestor(record)) continue;
      scanned.push(String(record.naId));
      const countries = countriesFor(record);
      const topics = topicsFor(record);
      if (!countries.length && !topics.length) continue;
      records.push(toRecord(record));
    }

    if (hits.length < 100) break;
  }

  return {
    scannedFileUnits: scanned.length,
    records: records.sort((a, b) => {
      return (
        (a.countries[0] || "Regional").localeCompare(b.countries[0] || "Regional") ||
        (a.startDate || "").localeCompare(b.startDate || "") ||
        a.title.localeCompare(b.title)
      );
    })
  };
}

async function main() {
  const { records, scannedFileUnits } = await harvestRecords();
  const json = JSON.stringify(records, null, 2);

  fs.writeFileSync(dataPath, `${json}\n`);
  fs.writeFileSync(dataScriptPath, `window.SUBJECT_FILES = ${json};\n`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceSeries: {
          name: SERIES_NAME,
          naid: SERIES_NAID,
          url: `https://catalog.archives.gov/search-within/${SERIES_NAID}`
        },
        scannedFileUnits,
        harvestedRecords: records.length,
        onlinePdfRecords: records.filter((record) => record.pdfUrl).length,
        countryCounts: Object.fromEntries(
          COUNTRIES.map((country) => [country, records.filter((record) => record.countries.includes(country)).length])
        ),
        records
      },
      null,
      2
    )}\n`
  );

  console.log(`Harvested ${records.length} South America subject-file records from series ${SERIES_NAID}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
