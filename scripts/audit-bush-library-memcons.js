const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const dataPath = path.join(repoRoot, "data", "memcons.json");
const reportPath = path.join(repoRoot, "reports", "bush-library-memcons-audit.json");
const TABLE_URL = "https://www.bush41library.gov/digital-research-room/about-textual-collections/memcons-and-telcons";

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

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Fetch failed ${response.status}: ${url}`);
  return response.text();
}

async function harvestTableRows() {
  const rows = [];
  for (let page = 0; page <= 68; page += 1) {
    const url = page === 0 ? TABLE_URL : `${TABLE_URL}?page=${page}`;
    rows.push(...rowsFromHtml(await fetchText(url)));
  }
  return rows;
}

async function main() {
  const existing = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const rows = await harvestTableRows();
  const relevantRows = rows.filter(
    (row) => ["Memcon", "Telcon"].includes(row.type) && SOUTH_AMERICA_COUNTRIES.has(row.country)
  );
  const existingBushNaids = new Set(
    existing
      .filter((record) => String(record.id).startsWith("bush-library-"))
      .map((record) => String(record.naid))
  );
  const missingRows = relevantRows.filter((row) => !existingBushNaids.has(String(row.naid)));

  const report = {
    generatedAt: new Date().toISOString(),
    tableUrl: TABLE_URL,
    rowsScanned: rows.length,
    relevantRowCount: relevantRows.length,
    existingBushLibraryRecords: existingBushNaids.size,
    missingRowCount: missingRows.length,
    missingRows,
    relevantRows
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Audited Bush Library table: ${relevantRows.length} relevant South America rows; ${missingRows.length} missing.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
