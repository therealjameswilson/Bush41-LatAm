const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const outputPath = path.join(repoRoot, "data", "compiler-gaps.json");
const outputScriptPath = path.join(repoRoot, "data", "compiler-gaps.js");
const reportPath = path.join(repoRoot, "reports", "compiler-gap-audit.json");

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

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function sourceBucket(record) {
  if (record.source?.name === "Brent Scowcroft Papers") return "Scowcroft extracts";
  if (record.source?.series === "Presidential Memcon Files") return "Presidential Memcon Files";
  if (record.source?.series === "Presidential Telcon Files") return "Presidential Telcon Files";
  return record.source?.series || record.source?.name || "Other";
}

function yearCounts(records) {
  return Object.fromEntries(
    ["1989", "1990", "1991", "1992"].map((year) => [
      year,
      records.filter((record) => (record.sortDate || record.date || "").startsWith(year)).length
    ])
  );
}

function countByCountry(rows, country, getter) {
  return rows.filter((row) => (getter(row) || []).includes(country)).length;
}

function riskLabel(score) {
  if (score >= 80) return "Critical";
  if (score >= 55) return "High";
  if (score >= 30) return "Medium";
  return "Monitor";
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function isPartialOrRestrictedStatus(value) {
  return /\bpartial\b|\bwithheld\b|\bexcised\b|^restricted\b/i.test(value || "");
}

function countryRisk({ country, privateRecords, candidates, highCandidates, statements }) {
  const partialPrivate = privateRecords.filter((record) => isPartialOrRestrictedStatus(record.releaseStatus));
  const sourceMix = privateRecords.reduce((counts, record) => {
    const source = sourceBucket(record);
    counts[source] = (counts[source] || 0) + 1;
    return counts;
  }, {});
  const signals = [];
  const actions = [];
  let score = 0;

  if (!privateRecords.length) {
    score += 90;
    signals.push("No released private memcon/telcon record is currently in the country chapter.");
    actions.push("Treat this chapter as unresolved until non-presidential, State, NSC country, or agency files are checked.");
  } else if (privateRecords.length <= 2) {
    score += 55;
    signals.push("Only one or two released private records are in the country chapter.");
    actions.push("Prioritize adjacent NSC country files, State records, and withdrawal-sheet leads before treating the chapter as representative.");
  } else if (privateRecords.length <= 4) {
    score += 40;
    signals.push("Four or fewer released private records are in the country chapter.");
    actions.push("Use high-priority print leads to test whether the current private record set is only a presidential-contact skeleton.");
  } else if (privateRecords.length <= 10) {
    score += 20;
    signals.push("The private record set is modest and may miss issue-level policy development.");
    actions.push("Cross-check major public statements and high-priority leads against the country chronology.");
  }

  if (highCandidates.length >= 25 && privateRecords.length <= 4) {
    score += 25;
    signals.push(`${highCandidates.length} high-priority print leads exist against a thin private-record chapter.`);
  } else if (highCandidates.length >= 50) {
    score += 18;
    signals.push(`${highCandidates.length} high-priority print leads require triage.`);
  } else if (highCandidates.length >= 15 && privateRecords.length <= 10) {
    score += 12;
    signals.push(`${highCandidates.length} high-priority print leads may materially alter the chapter chronology.`);
  }

  if (statements.length >= 20 && privateRecords.length <= 4) {
    score += 22;
    signals.push(`${statements.length} public statements contrast with sparse private records.`);
    actions.push("Build a public-private chronology and look for missing decision documents around statement dates.");
  } else if (statements.length >= 50 && privateRecords.length <= 15) {
    score += 10;
    signals.push(`${statements.length} public statements indicate substantial public diplomacy or policy activity.`);
  }

  if (partialPrivate.length) {
    score += 8;
    signals.push(`${partialPrivate.length} private record(s) are partial releases.`);
    actions.push("Flag partial releases for possible replacement, re-review, or annotation.");
  }

  if (privateRecords.length && Object.keys(sourceMix).length === 1) {
    score += 6;
    signals.push("Private records come from a single source bucket.");
  }

  if (!actions.length) {
    actions.push("Maintain as lower-risk, but still check high-priority print leads before final compilation decisions.");
  }

  return {
    country,
    riskScore: score,
    riskLevel: riskLabel(score),
    privateRecordCount: privateRecords.length,
    privatePageCount: privateRecords.reduce((sum, record) => sum + (record.pageCount || 0), 0),
    printCandidateCount: candidates.length,
    highPriorityCandidateCount: highCandidates.length,
    publicStatementCount: statements.length,
    partialPrivateRecordCount: partialPrivate.length,
    privateSourceMix: sourceMix,
    yearCoverage: yearCounts(privateRecords),
    riskSignals: unique(signals),
    recommendedActions: unique(actions)
  };
}

function main() {
  const memcons = readJson("data/memcons.json");
  const candidates = [
    ...readJson("data/chronological-print-candidates.json"),
    ...readJson("data/subject-print-candidates.json"),
    ...readJson("data/deal-print-candidates.json")
  ];
  const publicStatements = readJson("data/public-statements.json");

  const countryRisks = COUNTRIES.map((country) => {
    const privateRecords = memcons.filter((record) => record.chapter?.name === country);
    const countryCandidates = candidates.filter((candidate) => (candidate.countries || []).includes(country));
    const highCandidates = countryCandidates.filter((candidate) => candidate.priority === "High");
    const statements = publicStatements.filter((statement) => (statement.countries || []).includes(country));
    return countryRisk({ country, privateRecords, candidates: countryCandidates, highCandidates, statements });
  }).sort((a, b) => b.riskScore - a.riskScore || a.country.localeCompare(b.country));

  const criticalOrHighCountries = countryRisks.filter((country) => ["Critical", "High"].includes(country.riskLevel));
  const partialPrivateRecords = memcons.filter((record) => isPartialOrRestrictedStatus(record.releaseStatus));
  const highCandidates = candidates.filter((candidate) => candidate.priority === "High");
  const structuralGaps = [
    {
      riskLevel: "Critical",
      title: "Print-candidate backlog is much larger than the verified private corpus",
      evidence: `${candidates.length} OCR-derived print leads, including ${highCandidates.length} high-priority leads, are not yet selected, transcribed, or compared against the country chronologies.`,
      recommendedAction: "Triage high-priority leads by country and theme before treating the memcon/telcon chapters as complete."
    },
    {
      riskLevel: "High",
      title: "Several countries have thin or absent private-record coverage",
      evidence: criticalOrHighCountries.map((country) => `${country.country}: ${country.privateRecordCount} private records, ${country.highPriorityCandidateCount} high-priority leads`).join("; "),
      recommendedAction: "Prioritize these chapters for non-presidential NSC files, State Department records, and agency records."
    },
    {
      riskLevel: "High",
      title: "Public-private chronology mismatches remain unresolved",
      evidence: countryRisks
        .filter((country) => country.publicStatementCount >= 20 && country.privateRecordCount <= 4)
        .map((country) => `${country.country}: ${country.publicStatementCount} public statements vs. ${country.privateRecordCount} private records`)
        .join("; ") || "No extreme mismatch under the current threshold.",
      recommendedAction: "For mismatch countries, map public statements to surrounding private memoranda, cables, briefing papers, and policy papers."
    },
    {
      riskLevel: "High",
      title: "Current site sources are NSC/Bush Library-heavy",
      evidence: "The site now covers Bush Library memcons/telcons, Scowcroft extracts, selected NSC Latin America files, Deal files, and Public Papers. It does not yet represent State central files, embassy cables, Treasury, Defense, CIA, DEA, or congressional notification files.",
      recommendedAction: "Use this site as a presidential/NSC starting point, not as the full FRUS evidentiary universe."
    },
    {
      riskLevel: "Medium",
      title: "Partial releases require replacement or annotation checks",
      evidence: `${partialPrivateRecords.length} private record(s) are marked Partial: ${partialPrivateRecords.map((record) => `${record.chapter?.name} ${record.date}`).join("; ") || "none"}.`,
      recommendedAction: "Check whether less-redacted versions exist in parallel files or later releases."
    },
    {
      riskLevel: "Medium",
      title: "OCR-derived leads are not document-level certainty",
      evidence: "Withdrawal-sheet rows and page OCR identify likely documents but can contain OCR noise, truncated titles, and page-start uncertainty.",
      recommendedAction: "Confirm page images and source folders before final document selection or citation."
    }
  ];

  const audit = {
    generatedAt: new Date().toISOString(),
    scope: "Compiler-risk audit for the South America companion site. Central America remains excluded except where a regional Latin America source may bear on South America policy.",
    summary: {
      privateRecordCount: memcons.length,
      privatePageCount: memcons.reduce((sum, record) => sum + (record.pageCount || 0), 0),
      printCandidateCount: candidates.length,
      highPriorityPrintCandidateCount: highCandidates.length,
      publicStatementCount: publicStatements.length,
      criticalCountryCount: countryRisks.filter((country) => country.riskLevel === "Critical").length,
      highCountryCount: countryRisks.filter((country) => country.riskLevel === "High").length,
      partialPrivateRecordCount: partialPrivateRecords.length,
      countriesWithoutPrivateRecords: countryRisks.filter((country) => country.privateRecordCount === 0).map((country) => country.country)
    },
    countryRisks,
    structuralGaps
  };

  const json = JSON.stringify(audit, null, 2);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(outputPath, `${json}\n`);
  fs.writeFileSync(outputScriptPath, `window.COMPILER_GAPS = ${json};\n`);
  fs.writeFileSync(reportPath, `${json}\n`);
  console.log(`Wrote compiler gap audit: ${audit.summary.criticalCountryCount} critical and ${audit.summary.highCountryCount} high-risk countries.`);
}

main();
