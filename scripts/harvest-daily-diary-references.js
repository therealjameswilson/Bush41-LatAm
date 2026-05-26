const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const memconsPath = path.join(repoRoot, "data", "memcons.json");
const memconsScriptPath = path.join(repoRoot, "data", "memcons.js");
const referencesPath = path.join(repoRoot, "data", "daily-diary-references.json");
const referencesScriptPath = path.join(repoRoot, "data", "daily-diary-references.js");
const reportPath = path.join(repoRoot, "reports", "daily-diary-references-harvest.json");

const CATALOG_PROXY = "https://catalog.archives.gov/proxy/records/search";
const SERIES = {
  name: "Presidential Daily Diary and Presidential Daily Backup Materials",
  naid: "186322",
  url: "https://catalog.archives.gov/id/186322",
  localIdentifier: "GB-WHASF-001",
  collection: "White House Office of Appointments and Scheduling Files",
  collectionNaid: "1081",
  collectionUrl: "https://catalog.archives.gov/id/1081",
  repository: "George H.W. Bush Library",
  recordGroup: "Bush Presidential Records"
};

const COUNTRY_TERMS = {
  Argentina: ["Argentina", "Argentine", "Alfonsin", "Menem"],
  Bolivia: ["Bolivia", "Bolivian", "Paz Zamora"],
  Brazil: ["Brazil", "Brazilian", "Sarney", "Collor", "Itamar Franco"],
  Chile: ["Chile", "Chilean", "Aylwin", "Pinochet"],
  Colombia: ["Colombia", "Colombian", "Barco", "Gaviria"],
  Ecuador: ["Ecuador", "Ecuadorian", "Borja", "Duran Ballen"],
  Guyana: ["Guyana", "Guyanese", "Hoyte", "Jagan"],
  Paraguay: ["Paraguay", "Paraguayan", "Andres Rodriguez"],
  Peru: ["Peru", "Peruvian", "Fujimori", "Alan Garcia"],
  Suriname: ["Suriname", "Surinamese", "Shankar", "Bouterse"],
  Uruguay: ["Uruguay", "Uruguayan", "Sanguinetti", "Lacalle"],
  Venezuela: ["Venezuela", "Venezuelan", "Carlos Andres Perez", "Caldera"]
};

const SEARCH_TERMS = [...new Set(Object.values(COUNTRY_TERMS).flat())];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function queryUrl(params) {
  return `${CATALOG_PROXY}?${new URLSearchParams(params).toString()}`;
}

async function fetchJson(url, tries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const attemptUrl = new URL(url);
      if (attempt > 1) attemptUrl.searchParams.set("_retry", `${Date.now()}-${attempt}`);
      const response = await fetch(attemptUrl, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Bush41-LatAm FRUS compiler reference harvester"
        },
        signal: controller.signal
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 120)}`);
      }
      try {
        return JSON.parse(text);
      } catch (error) {
        throw new Error(`Catalog returned non-JSON for ${attemptUrl}: ${text.slice(0, 80)}`);
      }
    } catch (error) {
      lastError = error;
      if (attempt < tries) {
        await sleep(500 * attempt);
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

function hitsFrom(data) {
  return data?.body?.hits?.hits || [];
}

function totalFrom(data) {
  const total = data?.body?.hits?.total;
  return typeof total === "number" ? total : total?.value || 0;
}

function hasSeriesAncestor(record) {
  return (record.ancestors || []).some((ancestor) => String(ancestor.naId) === SERIES.naid);
}

function catalogDate(isoDate) {
  const [year, month, day] = isoDate.split("-");
  return `${Number(month)}/${Number(day)}/${year}`;
}

function catalogDateVariants(isoDate) {
  const [year, month, day] = isoDate.split("-");
  return [
    `${Number(month)}/${Number(day)}/${year}`,
    `${String(Number(month)).padStart(2, "0")}/${String(Number(day)).padStart(2, "0")}/${year}`
  ].filter((value, index, values) => values.indexOf(value) === index);
}

function isoDateFromTitle(title) {
  const match = String(title || "").match(/\[Presidential Daily (Diary|Backup)\]\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return "";
  return `${match[4]}-${String(Number(match[2])).padStart(2, "0")}-${String(Number(match[3])).padStart(2, "0")}`;
}

function sourceTypeFromTitle(title) {
  const match = String(title || "").match(/\[Presidential Daily (Diary|Backup)\]/);
  return match ? `Presidential Daily ${match[1]}` : "Presidential Daily Diary/Backup";
}

function exactDateTitle(record, dateLabel) {
  const escaped = dateLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^\\[Presidential Daily (Diary|Backup)\\]\\s+${escaped}(?:\\s+\\[EMPTY\\])?\\s*$`);
  return pattern.test(record.title || "");
}

function releaseSentence(accessRestriction) {
  const status = accessRestriction?.status || "";
  if (/restricted/i.test(status)) return `Access restriction: ${status}.`;
  if (status) return `${status}.`;
  return "Access restriction not stated in Catalog metadata.";
}

function countriesForTerm(term) {
  return Object.entries(COUNTRY_TERMS)
    .filter(([, terms]) => terms.includes(term))
    .map(([country]) => country);
}

function objectFor(record) {
  return (record.digitalObjects || []).find((object) => object.objectUrl) || {};
}

function referenceFromRecord(record) {
  const object = objectFor(record);
  const date = isoDateFromTitle(record.title);
  const sourceType = sourceTypeFromTitle(record.title);
  const title = record.title || `${sourceType} ${date}`;
  const accessRestriction = record.accessRestriction?.status || "";
  const sourceNote = [
    `Source: ${SERIES.repository}, ${SERIES.recordGroup}, ${SERIES.collection}, ${SERIES.name}, ${title}.`,
    releaseSentence(record.accessRestriction)
  ]
    .filter(Boolean)
    .join(" ");

  return {
    id: `daily-diary-${record.naId}`,
    date,
    catalogDate: date ? catalogDate(date) : "",
    sourceType,
    title,
    naid: String(record.naId),
    localIdentifier: record.localIdentifier || "",
    catalogUrl: `https://catalog.archives.gov/id/${record.naId}`,
    pdfUrl: object.objectUrl || "",
    objectFilename: object.objectFilename || "",
    objectId: object.objectId ? String(object.objectId) : "",
    accessRestriction,
    empty: /\[EMPTY\]/i.test(title),
    matchedTerms: [],
    countries: [],
    linkedRecordIds: [],
    linkedRecordTitles: [],
    sourceSeries: SERIES,
    sourceNote,
    reviewReason: ""
  };
}

function mergeReferenceDetails(reference, record) {
  const object = objectFor(record);
  if (record.localIdentifier) reference.localIdentifier = record.localIdentifier;
  if (object.objectUrl) reference.pdfUrl = object.objectUrl;
  if (object.objectFilename) reference.objectFilename = object.objectFilename;
  if (object.objectId) reference.objectId = String(object.objectId);
  if (record.accessRestriction?.status) reference.accessRestriction = record.accessRestriction.status;
  reference.sourceNote = [
    `Source: ${SERIES.repository}, ${SERIES.recordGroup}, ${SERIES.collection}, ${SERIES.name}, ${reference.title}.`,
    releaseSentence(record.accessRestriction)
  ]
    .filter(Boolean)
    .join(" ");
}

function upsertReference(map, record) {
  if (!record.naId || !hasSeriesAncestor(record)) return null;
  if (!/\[Presidential Daily (Diary|Backup)\]/.test(record.title || "")) return null;
  const key = String(record.naId);
  if (!map.has(key)) {
    map.set(key, referenceFromRecord(record));
  }
  return map.get(key);
}

function mergeUnique(existing, values) {
  const seen = new Set(existing);
  for (const value of values.filter(Boolean)) {
    if (!seen.has(value)) {
      existing.push(value);
      seen.add(value);
    }
  }
}

function countriesFromRecords(records) {
  return [
    ...new Set(
      records
        .flatMap((record) => record.countries || [])
        .filter((country) => country && country !== "United States")
    )
  ];
}

async function fetchExactDateReferences(date, records, referenceMap, dateReport) {
  const dateLabels = catalogDateVariants(date);
  let totalCatalogHits = 0;
  const exactRecordMap = new Map();
  for (const dateLabel of dateLabels) {
    const data = await fetchJson(queryUrl({ title: dateLabel, limit: "100", abbreviated: "false" }), 5);
    totalCatalogHits += totalFrom(data);
    const hits = hitsFrom(data);
    for (const record of hits.map((hit) => hit?._source?.record).filter(Boolean)) {
      if (hasSeriesAncestor(record) && exactDateTitle(record, dateLabel)) {
        exactRecordMap.set(String(record.naId), record);
      }
    }
    await sleep(80);
  }
  const exactRecords = [...exactRecordMap.values()];

  const linkedCountries = countriesFromRecords(records);
  for (const record of exactRecords) {
    const reference = upsertReference(referenceMap, record);
    if (!reference) continue;
    mergeUnique(reference.linkedRecordIds, records.map((item) => item.id));
    mergeUnique(reference.linkedRecordTitles, records.map((item) => item.documentTitle || item.title));
    mergeUnique(reference.countries, linkedCountries);
  }

  dateReport.push({
    date,
    catalogDate: dateLabels.join(" / "),
    memconTelconCount: records.length,
    totalCatalogHits,
    matchedReferences: exactRecords.map((record) => ({
      naid: String(record.naId),
      title: record.title,
      localIdentifier: record.localIdentifier || ""
    }))
  });

  await sleep(80);
}

async function fetchSearchTermReferences(term, referenceMap, searchReport) {
  const countries = countriesForTerm(term);
  const data = await fetchJson(
    queryUrl({
      ancestorNaId: SERIES.naid,
      q: term,
      limit: "100",
      abbreviated: "true"
    }),
    5
  );
  const hits = hitsFrom(data);
  let matched = 0;

  for (const hit of hits) {
    const record = hit?._source?.record;
    const reference = record ? upsertReference(referenceMap, record) : null;
    if (!reference) continue;
    matched += 1;
    mergeUnique(reference.matchedTerms, [term]);
    mergeUnique(reference.countries, countries);
  }

  searchReport.push({
    term,
    countries,
    totalCatalogHits: totalFrom(data),
    harvestedReferences: matched,
    truncatedAt: totalFrom(data) > 100 ? 100 : null
  });

  await sleep(80);
}

async function hydrateReferenceDetails(referenceMap, hydrationReport) {
  const references = [...referenceMap.values()].filter((reference) => !reference.pdfUrl || !reference.accessRestriction);
  for (const [index, reference] of references.entries()) {
    if (index % 75 === 0) {
      console.log(`Hydrating diary/backup reference ${index + 1}/${references.length}: NAID ${reference.naid}`);
    }
    try {
      const data = await fetchJson(
        queryUrl({
          naId: reference.naid,
          limit: "1",
          abbreviated: "false",
          queriedNaIds: "true"
        }),
        3
      );
      const record = hitsFrom(data)[0]?._source?.record;
      if (record) mergeReferenceDetails(reference, record);
      hydrationReport.push({
        naid: reference.naid,
        title: reference.title,
        hydrated: Boolean(record),
        pdfUrl: reference.pdfUrl || ""
      });
    } catch (error) {
      hydrationReport.push({
        naid: reference.naid,
        title: reference.title,
        hydrated: false,
        error: error.message
      });
    }
    await sleep(50);
  }
}

function finalizeReferences(references) {
  for (const reference of references) {
    const reasons = [];
    if (reference.linkedRecordIds.length) {
      reasons.push(`Same date as ${reference.linkedRecordIds.length} South America memcon/telcon record(s).`);
    }
    if (reference.matchedTerms.length) {
      reasons.push(`Catalog search matched: ${reference.matchedTerms.join(", ")}.`);
    }
    reference.relationship = reference.linkedRecordIds.length ? "Matched memcon/telcon date" : "Catalog search lead";
    reference.reviewReason = reasons.join(" ");
    reference.countries.sort((a, b) => a.localeCompare(b));
    reference.matchedTerms.sort((a, b) => a.localeCompare(b));
    reference.linkedRecordTitles.sort((a, b) => a.localeCompare(b));
  }

  return references.sort(
    (a, b) =>
      (a.date || "").localeCompare(b.date || "") ||
      a.sourceType.localeCompare(b.sourceType) ||
      a.title.localeCompare(b.title)
  );
}

function attachReferencesToMemcons(memcons, references) {
  const byDate = new Map();
  for (const reference of references.filter((item) => item.relationship === "Matched memcon/telcon date")) {
    if (!reference.date) continue;
    if (!byDate.has(reference.date)) byDate.set(reference.date, []);
    byDate.get(reference.date).push({
      type: reference.sourceType,
      title: reference.title,
      naid: reference.naid,
      localIdentifier: reference.localIdentifier,
      catalogUrl: reference.catalogUrl,
      pdfUrl: reference.pdfUrl,
      objectFilename: reference.objectFilename,
      accessRestriction: reference.accessRestriction,
      empty: reference.empty,
      sourceNote: reference.sourceNote
    });
  }

  for (const record of memcons) {
    const refs = byDate.get(record.date) || [];
    if (refs.length) {
      record.dailyDiaryReferences = refs;
      record.source = {
        ...record.source,
        dailyDiarySeries: SERIES
      };
    } else {
      delete record.dailyDiaryReferences;
      if (record.source?.dailyDiarySeries) {
        delete record.source.dailyDiarySeries;
      }
    }
  }
}

async function main() {
  const memcons = JSON.parse(fs.readFileSync(memconsPath, "utf8"));
  const recordsByDate = new Map();
  for (const record of memcons) {
    if (!record.date) continue;
    if (!recordsByDate.has(record.date)) recordsByDate.set(record.date, []);
    recordsByDate.get(record.date).push(record);
  }

  const referenceMap = new Map();
  const dateReport = [];
  const searchReport = [];
  const hydrationReport = [];

  const dateEntries = [...recordsByDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [index, [date, records]] of dateEntries.entries()) {
    if (index % 15 === 0) console.log(`Checking diary/backup date ${index + 1}/${dateEntries.length}: ${date}`);
    try {
      await fetchExactDateReferences(date, records, referenceMap, dateReport);
    } catch (error) {
      dateReport.push({
        date,
        catalogDate: catalogDate(date),
        memconTelconCount: records.length,
        totalCatalogHits: 0,
        matchedReferences: [],
        error: error.message
      });
    }
  }

  for (const [index, term] of SEARCH_TERMS.entries()) {
    if (index % 10 === 0) console.log(`Searching NAID ${SERIES.naid} term ${index + 1}/${SEARCH_TERMS.length}: ${term}`);
    try {
      await fetchSearchTermReferences(term, referenceMap, searchReport);
    } catch (error) {
      searchReport.push({
        term,
        countries: countriesForTerm(term),
        totalCatalogHits: 0,
        harvestedReferences: 0,
        error: error.message
      });
    }
  }

  await hydrateReferenceDetails(referenceMap, hydrationReport);

  const references = finalizeReferences([...referenceMap.values()]);
  attachReferencesToMemcons(memcons, references);

  const report = {
    generatedAt: new Date().toISOString(),
    sourceSeries: SERIES,
    scopeNote:
      "The Presidential Daily Diary and Daily Backup files are date-level references for schedule/call context; the series description says they do not contain telephone-call summaries or meeting minutes.",
    memconTelconDatesChecked: recordsByDate.size,
    memconTelconRecordsUpdated: memcons.filter((record) => (record.dailyDiaryReferences || []).length).length,
    dailyDiaryReferencesHarvested: references.length,
    matchedMemconTelconDateReferences: references.filter((reference) => reference.relationship === "Matched memcon/telcon date").length,
    catalogSearchLeadReferences: references.filter((reference) => reference.relationship === "Catalog search lead").length,
    datesWithoutReferences: dateReport
      .filter((item) => !item.matchedReferences.length)
      .map((item) => ({ date: item.date, memconTelconCount: item.memconTelconCount })),
    searchTerms: SEARCH_TERMS,
    dateReport,
    searchReport,
    hydrationReport
  };

  fs.writeFileSync(memconsPath, `${JSON.stringify(memcons, null, 2)}\n`);
  fs.writeFileSync(memconsScriptPath, `window.MEMCONS = ${JSON.stringify(memcons, null, 2)};\n`);
  fs.writeFileSync(referencesPath, `${JSON.stringify(references, null, 2)}\n`);
  fs.writeFileSync(referencesScriptPath, `window.DAILY_DIARY_REFERENCES = ${JSON.stringify(references, null, 2)};\n`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Checked ${recordsByDate.size} memcon/telcon dates.`);
  console.log(`Updated ${report.memconTelconRecordsUpdated} memcon/telcon records with date-level diary/backup references.`);
  console.log(`Harvested ${references.length} daily diary/backup reference file units.`);
  console.log(`Wrote ${path.relative(repoRoot, referencesPath)} and ${path.relative(repoRoot, reportPath)}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
