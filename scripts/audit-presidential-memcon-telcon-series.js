const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const dataPath = path.join(repoRoot, "data", "memcons.json");
const reportPath = path.join(repoRoot, "reports", "presidential-memcon-telcon-series-audit.json");

const TARGETS = [
  {
    naid: "321498039",
    name: "Presidential Memcon Files",
    type: "Memcon",
    url: "https://catalog.archives.gov/id/321498039"
  },
  {
    naid: "322361434",
    name: "[Memorandum of Telephone Conversations (Telcons) - January 1989-July 1989]: January 1989",
    type: "Telcon",
    url: "https://catalog.archives.gov/id/322361434"
  }
];

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
  Ecuador: ["Borja", "Duran Ballen", "Ecuadoran", "Ecuadorian"],
  Guyana: ["Hoyte", "Guyanese"],
  Paraguay: ["Rodriguez", "Stroessner", "Paraguayan"],
  Peru: ["Garcia", "Fujimori", "Peruvian"],
  Suriname: ["Bouterse", "Surinamese"],
  Uruguay: ["Lacalle", "Sanguinetti", "Uruguayan"],
  Venezuela: ["Carlos Andres Perez", "Venezuelan"]
};

const EXCLUDED_TITLE_PATTERNS = [/uruguay\s+round/i, /perez\s+de\s+cuellar/i];

function normalize(value) {
  return (value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAncestor(record, naid) {
  return String(record.naId) === naid || (record.ancestors || []).some((ancestor) => String(ancestor.naId) === naid);
}

function countriesFor(record) {
  if (EXCLUDED_TITLE_PATTERNS.some((pattern) => pattern.test(record.title || ""))) return [];

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

function titleDuplicateExists(record, countries, existingRecords) {
  const title = normalize(record.title);
  if (!title) return false;

  return existingRecords.some((existing) => {
    const existingCountries = existing.countries || [];
    if (!countries.some((country) => existingCountries.includes(country))) return false;

    const existingTitle = normalize(`${existing.title || ""} ${existing.subjectLine || ""}`);
    if (!existingTitle) return false;
    return existingTitle.includes(title) || title.includes(existingTitle);
  });
}

function digitalObject(record) {
  return (record.digitalObjects || []).find((object) => object.objectUrl) || null;
}

async function fetchCatalogPage(naid, page) {
  const url = new URL("https://catalog.archives.gov/proxy/records/search");
  url.searchParams.set("q", naid);
  url.searchParams.set("limit", "100");
  url.searchParams.set("page", String(page));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Catalog search failed ${response.status}: ${url}`);
  return response.json();
}

async function auditTarget(target, existingRecords, existingNaids) {
  const relevantRecords = new Map();
  let scannedRecords = 0;

  for (let page = 1; ; page += 1) {
    const json = await fetchCatalogPage(target.naid, page);
    const hits = json.body?.hits?.hits || [];
    if (!hits.length) break;

    for (const hit of hits) {
      const record = hit._source?.record;
      if (!record || !hasAncestor(record, target.naid)) continue;
      scannedRecords += 1;
      if (record.levelOfDescription !== "item") continue;

      const countries = countriesFor(record);
      if (!countries.length) continue;
      const object = digitalObject(record);
      const presentInSite = existingNaids.has(String(record.naId)) || titleDuplicateExists(record, countries, existingRecords);
      relevantRecords.set(String(record.naId), {
        naid: String(record.naId),
        title: record.title,
        levelOfDescription: record.levelOfDescription,
        countries,
        catalogUrl: `https://catalog.archives.gov/id/${record.naId}`,
        pdfUrl: object?.objectUrl || "",
        objectFilename: object?.objectFilename || "",
        localIdentifier: record.localIdentifier || "",
        accessRestriction: record.accessRestriction?.status || "",
        seriesOrFileUnit: {
          naid: target.naid,
          name: target.name,
          type: target.type,
          url: target.url
        },
        presentInSite
      });
    }

    if (hits.length < 100) break;
  }

  const records = [...relevantRecords.values()].sort((a, b) => {
    return a.countries.join(",").localeCompare(b.countries.join(",")) || a.title.localeCompare(b.title);
  });

  return {
    ...target,
    scannedRecords,
    relevantSouthAmericaItems: records.length,
    onlinePdfItems: records.filter((record) => record.pdfUrl).length,
    missingFromSite: records.filter((record) => !record.presentInSite),
    records
  };
}

async function main() {
  const existing = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const existingNaids = new Set(existing.map((record) => String(record.naid)));
  const targetReports = [];

  for (const target of TARGETS) {
    targetReports.push(await auditTarget(target, existing, existingNaids));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    existingMemconTelconRecords: existing.length,
    targets: targetReports
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  for (const target of targetReports) {
    console.log(
      `${target.name}: ${target.relevantSouthAmericaItems} South America items; ${target.missingFromSite.length} missing from site.`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
