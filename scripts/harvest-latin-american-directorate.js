const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const dataPath = path.join(repoRoot, "data", "priority-collection.json");
const dataScriptPath = path.join(repoRoot, "data", "priority-collection.js");
const reportPath = path.join(repoRoot, "reports", "latin-american-directorate-harvest.json");

const SERIES_NAID = "2197972";
const SERIES_URL = `https://catalog.archives.gov/id/${SERIES_NAID}`;
const SEARCH_QUERY = SERIES_NAID;
const SEARCH_QUERIES = [
  SEARCH_QUERY,
  ...Array.from({ length: 30 }, (_, index) => `CF${String(300 + index).padStart(5, "0")}`)
];

function logicalDate(date) {
  return date?.logicalDate || "";
}

function ancestor(record, level) {
  return (record.ancestors || []).find((item) => item.levelOfDescription === level);
}

function hasSeriesAncestor(record) {
  return record.levelOfDescription === "fileUnit" && (record.ancestors || []).some((item) => String(item.naId) === SERIES_NAID);
}

function variants(record) {
  return (record.variantControlNumbers || []).map((item) => `${item.type}: ${item.number}`);
}

function digitalObject(record) {
  return (record.digitalObjects || []).find((object) => object.objectUrl) || null;
}

function toCollectionRecord(record) {
  const object = digitalObject(record);
  const series = ancestor(record, "series");
  const collection = ancestor(record, "collection");
  const physical = record.physicalOccurrences?.[0] || {};
  const media = physical.mediaOccurrences?.[0] || {};

  return {
    id: `latin-american-directorate-${record.naId}`,
    naid: String(record.naId),
    title: record.title,
    localIdentifier: record.localIdentifier || "",
    levelOfDescription: record.levelOfDescription,
    startDate: logicalDate(record.coverageStartDate || record.inclusiveStartDate),
    endDate: logicalDate(record.coverageEndDate || record.inclusiveEndDate),
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
      title: series?.title || "Latin American Directorate Chronological Files",
      url: SERIES_URL
    },
    collection: {
      naid: String(collection?.naId || "2163580"),
      title: collection?.title || "Records of the National Security Council (George H. W. Bush Administration)",
      url: `https://catalog.archives.gov/id/${collection?.naId || "2163580"}`
    },
    referenceUnit: physical.referenceUnits?.[0]?.name || "George Bush Library"
  };
}

async function fetchCatalogPage(query, from) {
  const url = new URL("https://catalog.archives.gov/proxy/records/search");
  url.searchParams.set("q", query);
  url.searchParams.set("rows", "100");
  url.searchParams.set("from", String(from));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Catalog search failed ${response.status}: ${url}`);
  return response.json();
}

async function harvestRecords() {
  const recordsByNaid = new Map();

  for (const query of SEARCH_QUERIES) {
    for (let from = 0; from <= 300; from += 100) {
      const json = await fetchCatalogPage(query, from);
      const hits = json.body?.hits?.hits || [];
      if (!hits.length) break;

      for (const hit of hits) {
        const record = hit._source?.record;
        if (!record || !hasSeriesAncestor(record)) continue;
        recordsByNaid.set(String(record.naId), toCollectionRecord(record));
      }

      if (recordsByNaid.size >= 72) break;
    }
    if (recordsByNaid.size >= 72) break;
  }

  return [...recordsByNaid.values()].sort((a, b) => {
    return (
      a.startDate.localeCompare(b.startDate) ||
      a.localIdentifier.localeCompare(b.localIdentifier) ||
      a.title.localeCompare(b.title)
    );
  });
}

async function main() {
  const records = await harvestRecords();
  const json = JSON.stringify(records, null, 2);

  fs.writeFileSync(dataPath, `${json}\n`);
  fs.writeFileSync(dataScriptPath, `window.PRIORITY_COLLECTION = ${json};\n`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        series: {
          name: "Latin American Directorate Chronological Files",
          naid: SERIES_NAID,
          url: SERIES_URL
        },
        searchQueries: SEARCH_QUERIES,
        harvestedRecords: records.length,
        onlinePdfRecords: records.filter((record) => record.pdfUrl).length,
        records
      },
      null,
      2
    )}\n`
  );

  console.log(`Harvested ${records.length} Latin American Directorate chronological file records.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
