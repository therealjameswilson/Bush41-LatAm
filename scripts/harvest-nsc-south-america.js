const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const dataPath = path.join(repoRoot, "data", "nsc-south-america.json");
const dataScriptPath = path.join(repoRoot, "data", "nsc-south-america.js");
const reportPath = path.join(repoRoot, "reports", "nsc-south-america-harvest.json");

const COLLECTION_NAID = "2163580";
const COLLECTION_URL = `https://catalog.archives.gov/id/${COLLECTION_NAID}`;
const COLLECTION_NAME = "Records of the National Security Council (George H. W. Bush Administration)";

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
  Argentina: ["Alfonsin", "Menem", "Di Tella"],
  Bolivia: ["Paz Zamora", "Bolivian"],
  Brazil: ["Sarney", "Collor", "Brazilian", "Brasilia"],
  Chile: ["Aylwin", "Pinochet", "Chilean"],
  Colombia: ["Barco", "Gaviria", "Samper", "Colombian"],
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
  "debt"
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

function hasCollectionAncestor(record) {
  return String(record.naId) === COLLECTION_NAID || (record.ancestors || []).some((item) => String(item.naId) === COLLECTION_NAID);
}

function digitalObject(record) {
  return (record.digitalObjects || []).find((object) => object.objectUrl) || null;
}

function variants(record) {
  return (record.variantControlNumbers || []).map((item) => `${item.type}: ${item.number}`);
}

function countriesFor(record) {
  const haystack = normalize(
    [
      record.title,
      record.scopeAndContentNote,
      record.localIdentifier,
      record.generalNotes?.join(" "),
      record.digitalObjects?.map((object) => object.objectFilename).join(" ")
    ].join(" ")
  );
  return COUNTRIES.filter((country) => {
    const terms = [country, ...(COUNTRY_ALIASES[country] || [])].map(normalize);
    return terms.some((term) => term && haystack.includes(term));
  });
}

function topicsFor(record) {
  const haystack = normalize([record.title, record.scopeAndContentNote, record.localIdentifier].join(" "));
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

function toRecord(record, matchedQueries) {
  const object = digitalObject(record);
  const series = ancestor(record, "series");
  const physical = record.physicalOccurrences?.[0] || {};
  const media = physical.mediaOccurrences?.[0] || {};
  const countries = countriesFor(record);

  return {
    id: `nsc-${record.naId}`,
    naid: String(record.naId),
    title: record.title,
    levelOfDescription: record.levelOfDescription,
    localIdentifier: record.localIdentifier || "",
    countries,
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
      naid: String(series?.naId || ""),
      title: series?.title || "",
      url: series?.naId ? `https://catalog.archives.gov/id/${series.naId}` : ""
    },
    collection: {
      naid: COLLECTION_NAID,
      title: COLLECTION_NAME,
      url: COLLECTION_URL
    },
    referenceUnit: physical.referenceUnits?.[0]?.name || "George Bush Library",
    matchedQueries: [...matchedQueries].sort()
  };
}

function queryList() {
  const queries = new Set();
  for (const country of COUNTRIES) {
    queries.add(`${country} ${COLLECTION_NAID}`);
    for (const alias of COUNTRY_ALIASES[country] || []) {
      queries.add(`${alias} ${COLLECTION_NAID}`);
    }
  }
  for (const term of REGIONAL_TERMS) {
    queries.add(`${term} ${COLLECTION_NAID}`);
  }
  return [...queries];
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
  const queryStats = [];

  for (const query of queryList()) {
    let hitsSeen = 0;
    let matches = 0;

    for (let from = 0; from <= 300; from += 100) {
      const json = await fetchCatalogPage(query, from);
      const hits = json.body?.hits?.hits || [];
      hitsSeen += hits.length;
      if (!hits.length) break;

      for (const hit of hits) {
        const record = hit._source?.record;
        if (!record || !hasCollectionAncestor(record)) continue;
        const countries = countriesFor(record);
        const topics = topicsFor(record);
        if (!countries.length && !topics.length) continue;

        const key = String(record.naId);
        const existing = recordsByNaid.get(key);
        if (existing) {
          existing.matchedQueries.add(query);
        } else {
          recordsByNaid.set(key, { record, matchedQueries: new Set([query]) });
        }
        matches += 1;
      }
    }

    queryStats.push({ query, hitsSeen, matches });
  }

  return {
    records: [...recordsByNaid.values()]
      .map(({ record, matchedQueries }) => toRecord(record, matchedQueries))
      .sort((a, b) => {
        return (
          a.countries.join(",").localeCompare(b.countries.join(",")) ||
          a.sortDate.localeCompare(b.sortDate) ||
          a.title.localeCompare(b.title)
        );
      }),
    queryStats
  };
}

async function main() {
  const { records, queryStats } = await harvestRecords();
  const json = JSON.stringify(records, null, 2);

  fs.writeFileSync(dataPath, `${json}\n`);
  fs.writeFileSync(dataScriptPath, `window.NSC_SOUTH_AMERICA = ${json};\n`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        collection: {
          name: COLLECTION_NAME,
          naid: COLLECTION_NAID,
          url: COLLECTION_URL
        },
        harvestedRecords: records.length,
        onlinePdfRecords: records.filter((record) => record.pdfUrl).length,
        countryCounts: Object.fromEntries(
          COUNTRIES.map((country) => [country, records.filter((record) => record.countries.includes(country)).length])
        ),
        queryStats,
        records
      },
      null,
      2
    )}\n`
  );

  console.log(`Harvested ${records.length} South America records from collection ${COLLECTION_NAID}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
