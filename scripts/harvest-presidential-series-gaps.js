const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const dataPath = path.join(repoRoot, "data", "memcons.json");
const dataScriptPath = path.join(repoRoot, "data", "memcons.js");
const auditPath = path.join(repoRoot, "reports", "presidential-memcon-telcon-series-audit.json");
const reportPath = path.join(repoRoot, "reports", "presidential-series-gaps-harvest.json");

const FRUS_VOLUME = "Foreign Relations of the United States, 1989-1992, Volume XXV, Latin America";
const SOURCE_COLLECTION = {
  name: "Records of the National Security Council (George H. W. Bush Administration)",
  url: "https://catalog.archives.gov/id/2163580",
  referenceUnit: "George Bush Library"
};
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

const PARTICIPANT_PATTERNS = [
  { pattern: /Fernando\s+Collor\s+de\s+Mello/i, display: "Fernando Collor de Mello" },
  { pattern: /Jose\s+Sarney/i, display: "Jose Sarney" },
  { pattern: /Andres\s+Rodriguez/i, display: "Andres Rodriguez" },
  { pattern: /Carlos\s+Andres\s+Perez/i, display: "Carlos Andres Perez" }
];

function displayDate(isoDate) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

function dateFromTitle(title) {
  const match = title.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/i
  );
  if (!match) return { raw: "", iso: "1989-01-01" };
  const parsed = new Date(`${match[0]} UTC`);
  return { raw: match[0], iso: parsed.toISOString().slice(0, 10) };
}

function participantFor(title) {
  return PARTICIPANT_PATTERNS.find((entry) => entry.pattern.test(title))?.display || "South America counterpart";
}

function toRecord(item) {
  const country = item.countries[0];
  const chapter = CHAPTER_BY_COUNTRY[country];
  const date = dateFromTitle(item.title);
  const counterpart = participantFor(item.title);
  const series = item.seriesOrFileUnit;

  return {
    id: `presidential-series-${item.naid}`,
    date: date.iso,
    sortDate: date.iso,
    type: series.type,
    title: item.title,
    sourceTitle: series.name,
    participants: ["George H. W. Bush", counterpart],
    countries: ["United States", country],
    chapter,
    releaseStatus: item.accessRestriction || "Declassified",
    naid: item.naid,
    localIdentifier: item.localIdentifier || "",
    pdfUrl: item.pdfUrl || "",
    catalogUrl: item.catalogUrl,
    source: {
      ...SOURCE_COLLECTION,
      series: series.name,
      seriesNaid: series.naid,
      seriesUrl: series.url,
      objectUrl: item.pdfUrl || "",
      objectFilename: item.objectFilename || ""
    },
    frusVolume: FRUS_VOLUME,
    frusTopics: ["Latin America", "South America", country, "Presidential Memcon Files", series.type],
    topics: ["Latin America", "South America", country, series.type, "Head of state"],
    pageCount: 0,
    notes: "Integrated from a focused National Archives Catalog audit of Presidential Memcon/Telcon series records.",
    documentTitle: series.type === "Telcon" ? "Memorandum of Telephone Conversation" : "Memorandum of Conversation",
    subjectLine: item.title,
    dateLine: date.raw ? displayDate(date.iso) : "Date pending",
    sourceNote: `Source: George H.W. Bush Library, ${SOURCE_COLLECTION.name}, ${series.name}, NAID ${series.naid}; item ${item.title}, NAID ${item.naid}. Digital object: ${item.objectFilename || "none listed"}.`
  };
}

function mergeRecords(existing, additions) {
  const additionIds = new Set(additions.map((record) => record.id));
  return [...existing.filter((record) => !additionIds.has(record.id)), ...additions].sort(
    (a, b) => a.chapter.number - b.chapter.number || a.sortDate.localeCompare(b.sortDate) || a.title.localeCompare(b.title)
  );
}

function main() {
  const existing = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));
  const missingItems = audit.targets.flatMap((target) => target.missingFromSite || []);
  const additions = missingItems.map(toRecord);
  const records = mergeRecords(existing, additions);
  const json = JSON.stringify(records, null, 2);

  fs.writeFileSync(dataPath, `${json}\n`);
  fs.writeFileSync(dataScriptPath, `window.MEMCONS = ${json};\n`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceAudit: path.relative(repoRoot, auditPath),
        addedRecords: additions.length,
        additions
      },
      null,
      2
    )}\n`
  );
  console.log(`Integrated ${additions.length} Presidential series gap records.`);
}

main();
