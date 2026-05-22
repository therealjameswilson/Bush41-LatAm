const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const dataPath = path.join(repoRoot, "data", "deal-subject-files.json");
const dataScriptPath = path.join(repoRoot, "data", "deal-subject-files.js");
const reportPath = path.join(repoRoot, "reports", "deal-subject-files-harvest.json");

const SERIES_NAID = "2554810";
const SERIES_NAME = "Timothy E. Deal Subject Files";
const SERIES_URL = `https://catalog.archives.gov/id/${SERIES_NAID}`;

function logicalDate(date) {
  return date?.logicalDate || "";
}

function ancestor(record, level) {
  return (record.ancestors || []).find((item) => item.levelOfDescription === level);
}

function variants(record) {
  return (record.variantControlNumbers || []).map((item) => `${item.type}: ${item.number}`);
}

function digitalObject(record) {
  return (record.digitalObjects || []).find((object) => object.objectUrl) || null;
}

function toCollectionRecord(record) {
  const object = digitalObject(record);
  const collection = ancestor(record, "collection");
  const physical = record.physicalOccurrences?.[0] || {};
  const media = physical.mediaOccurrences?.[0] || {};

  return {
    id: `deal-subject-files-${record.naId}`,
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
      naid: SERIES_NAID,
      title: SERIES_NAME,
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

async function fetchCatalogPage(from) {
  const url = new URL("https://catalog.archives.gov/proxy/records/search");
  url.searchParams.set("q", "*");
  url.searchParams.set("ancestorNaId", SERIES_NAID);
  url.searchParams.set("rows", "100");
  url.searchParams.set("from", String(from));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Catalog search failed ${response.status}: ${url}`);
  return response.json();
}

async function harvestRecords() {
  const recordsByNaid = new Map();

  for (let from = 0; ; from += 100) {
    const json = await fetchCatalogPage(from);
    const hits = json.body?.hits?.hits || [];
    if (!hits.length) break;

    for (const hit of hits) {
      const record = hit._source?.record;
      if (!record || record.levelOfDescription !== "fileUnit") continue;
      recordsByNaid.set(String(record.naId), toCollectionRecord(record));
    }

    if (hits.length < 100) break;
  }

  return [...recordsByNaid.values()].sort((a, b) => {
    return (
      a.localIdentifier.localeCompare(b.localIdentifier) ||
      a.title.localeCompare(b.title)
    );
  });
}

async function main() {
  const records = await harvestRecords();
  const json = JSON.stringify(records, null, 2);

  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(dataPath, `${json}\n`);
  fs.writeFileSync(dataScriptPath, `window.DEAL_SUBJECT_FILES = ${json};\n`);
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        series: {
          name: SERIES_NAME,
          naid: SERIES_NAID,
          url: SERIES_URL
        },
        harvestedRecords: records.length,
        onlinePdfRecords: records.filter((record) => record.pdfUrl).length,
        records
      },
      null,
      2
    )}\n`
  );

  console.log(`Harvested ${records.length} Timothy E. Deal subject-file records.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
