# FRUS 1989-1992 Volume XXV Memcons and Telcons

A GitHub Pages website for housing declassified memoranda and telephone conversations relevant to
*Foreign Relations of the United States, 1989-1992, Volume XXV, Latin America*.

The repository follows the same static-site pattern as `Bush41-Western-Europe`: records live in
`data/memcons.json`, with `data/memcons.js` as a filesystem-friendly mirror. The site groups records
into one chronological chapter for each South America country. Central America is intentionally
excluded because it belongs in a separate FRUS volume.

The site also carries a broader South America index from the parent National Security Council
collection, so the compiler can move from formal memcons/telcons into country files, regional
packets, summit files, drug-policy material, debt/economic files, and related online PDFs.

The public site also includes a separate reference section for George H.W. Bush public statements
drawn from GovInfo's *Public Papers of the Presidents* collection. That section is not counted as
part of the archival memcon/telcon corpus; it is a chronology and citation aid for checking public
line, travel, nominations, treaty messages, and speech material against the private record.

## Priority Collection

The first source to prioritize is the National Archives Catalog series:

- Latin American Directorate Chronological Files, NAID 2197972: <https://catalog.archives.gov/id/2197972>
- Parent collection, Records of the National Security Council (George H. W. Bush Administration), NAID 2163580: <https://catalog.archives.gov/id/2163580>

Run the priority collection harvester to refresh its file-unit index:

```bash
node scripts/harvest-latin-american-directorate.js
```

This writes `data/priority-collection.json` and
`reports/latin-american-directorate-harvest.json`.

To OCR the public chronological PDFs and extract South America print-candidate leads, run:

```bash
node scripts/harvest-chronological-print-candidates.js
```

This writes `data/chronological-print-candidates.json` and
`reports/chronological-print-candidates-harvest.json`. The public site merges these NAID 2197972
leads with the subject-file leads, but keeps the source series visible and filterable.

## Broader NSC Parent Collection

The parent collection should be mined heavily for South America material:

- Search within Records of the National Security Council, NAID 2163580: <https://catalog.archives.gov/search-within/2163580>

Run the broader collection harvester with:

```bash
node scripts/harvest-nsc-south-america.js
```

This writes `data/nsc-south-america.json` and `reports/nsc-south-america-harvest.json`.
The harvester searches country names, selected leader names, and regional terms, then filters
results back to records with NAID 2163580 in their Catalog ancestry.

## Latin American Affairs Subject Files

The Latin American Affairs Directorate Subject Files, NAID 376217847, are a second named NSC
series to keep close to the volume work:

- Search within Latin American Affairs Directorate Subject Files: <https://catalog.archives.gov/search-within/376217847>

Run the focused subject-file harvester with:

```bash
node scripts/harvest-latin-american-subject-files.js
```

This scans the full 146-file-unit series and writes South America country files plus regional Latin
America folders to `data/subject-files.json` and
`reports/latin-american-subject-files-harvest.json`.

To turn those online PDFs into a compiler-facing print-candidate worklist, run:

```bash
node scripts/harvest-subject-print-candidates.js
```

This downloads the public PDFs into `.cache/subject-files/`, OCRs them with `ocrmypdf`, extracts
memoranda, memcons, telcons, talking points, letters, cables, reports, and withdrawal-sheet leads,
and writes `data/subject-print-candidates.json` plus
`reports/subject-print-candidates-harvest.json`. The visible Source notes retain the PDF marker
sheet provenance: George H.W. Bush Library, Bush Presidential Records, National Security Council,
Latin American Affairs Directorate Files, Subject File 1989, OA/ID, folder ID number, folder title,
access restriction, and FOIA number.

## Timothy E. Deal Subject Files

The Timothy E. Deal Subject Files, NAID 2554810, add economic-policy, debt, trade, summit, and
Enterprise for the Americas Initiative material from the NSC parent collection:

- Timothy E. Deal Subject Files: <https://catalog.archives.gov/id/2554810>

Refresh the Catalog file-unit index with:

```bash
node scripts/harvest-deal-subject-files.js
```

This writes `data/deal-subject-files.json`, `data/deal-subject-files.js`, and
`reports/deal-subject-files-harvest.json`.

To OCR the online PDFs and add South America or hemisphere-wide print-candidate leads to the public
worklist, run:

```bash
node scripts/harvest-deal-print-candidates.js
```

This writes `data/deal-print-candidates.json`, `data/deal-print-candidates.js`, and
`reports/deal-print-candidates-harvest.json`. The harvester filters out Central
America/Caribbean-only items and prevents Uruguay Round-only trade references from becoming Uruguay
country matches unless the document also names South America countries.

## Chapter Arrangement

1. Argentina
2. Bolivia
3. Brazil
4. Chile
5. Colombia
6. Ecuador
7. Guyana
8. Paraguay
9. Peru
10. Suriname
11. Uruguay
12. Venezuela

Records inside each chapter are arranged chronologically by `sortDate`.

## Bush Library Memcons and Telcons

Run the Bush Library table harvester to build the initial memcon/telcon dataset:

```bash
node scripts/harvest-bush-library-memcons.js
```

The harvester filters for South America countries, excludes Central America, enriches rows from the
National Archives Catalog, and cross-references the Latin American Directorate Chronological Files as
the compiler-priority collection.

To check the live Bush Library table without changing `data/memcons.json`, run:

```bash
node scripts/audit-bush-library-memcons.js
```

The audit writes `reports/bush-library-memcons-audit.json` and flags any South America memcon/telcon
table rows that are missing from the site dataset.

To audit the National Archives Catalog series records directly, including Presidential Memcon Files
NAID 321498039 and the January 1989 telcon file unit NAID 322361434, run:

```bash
node scripts/audit-presidential-memcon-telcon-series.js
```

If the audit finds South America item records missing from the site, import them with:

```bash
node scripts/harvest-presidential-series-gaps.js
```

## Scowcroft Files

Run the Scowcroft Presidential Correspondence Files extractor to add South America head-of-state
memcons and telcons from the Brent Scowcroft Papers:

```bash
node scripts/harvest-scowcroft-south-america.js
```

This scans OCR for South America leaders, extracts the relevant page ranges into `documents/`, merges
the records into `data/memcons.json`, and writes
`reports/scowcroft-south-america-harvest.json`.

The published Scowcroft extracts include page 1 of the source folder PDF as a provenance sheet before
the conversation pages. If the cached source-folder PDFs are already present and the local extracts
need to be refreshed without rerunning the full harvester, run:

```bash
node scripts/refresh-scowcroft-provenance-sheets.js
```

The refresh script reads the PDF provenance-sheet OCR, rewrites Scowcroft citation metadata in the
Volume XXXI Bush-document Source Note pattern, prepends the provenance sheet to each local PDF, keeps
`pageCount` scoped to conversation text by setting `provenancePages: 1`, and writes
`reports/scowcroft-provenance-sheet-refresh.json`.

## Source Note Standard

The visible Source note follows the model used in *Foreign Relations, 1989-1992, Volume XXXI, START I,
1989-1991*: repository, Bush Presidential Records, office or collection, series, OA/ID or file unit,
folder title, then release facts. Catalog-only working metadata such as NAIDs, table rows, digital
objects, source page ranges, duplicate provenance, and project-PDF construction remains in structured
metadata or the expanded provenance trail rather than the visible Source note.

After refreshing any memcon, telcon, or print-candidate dataset, normalize the public citation fields
with:

```bash
node scripts/refresh-frus-source-notes.js
```

This writes `reports/source-note-audit.json` and keeps the visible notes aligned with the Volume
XXXI pattern while preserving long catalog trails in `provenanceNote` when needed.

## Presidential Daily Diary and Backup References

Harvest date-file references from the White House Office of Appointments and Scheduling Files,
Presidential Daily Diary and Presidential Daily Backup Materials, NAID 186322:

```bash
node scripts/harvest-daily-diary-references.js
```

The script attaches same-date diary/backup references to each listed South America memcon or telcon,
creates the filterable reference layer in `data/daily-diary-references.json`, and writes
`reports/daily-diary-references-harvest.json`. These files are schedule and call-reference evidence:
they can document timing, participants, status of calls, and supporting materials, but they are not
treated as substantive meeting minutes or telephone-call summaries. Broad country/person searches are
limited to the first 100 Catalog results per term where the Catalog proxy requires abbreviated search.

## Compiler Exports

The public site builds spreadsheet-ready CSV downloads in the browser from the loaded JSON datasets.
The export links sit at the top of the chronology section so a compiler can immediately download the
core declassified chronology and related review worklists. The compiler review queue is the triage
sheet: structural risks, country coverage gaps, partial releases, and high-priority print-candidate
leads sorted by urgency and country risk. The document context export gives one row per declassified
memcon/telcon with same-date diary/backup references, nearby high-priority print leads, and nearby
public statements. The all-evidence timeline export merges private memcons/telcons,
print-candidate leads, Daily Diary/backup references, and public statements into one date-sorted
worklist with source notes, direct links, and a volume-date-scope flag. The citation workbench
export turns the same evidence layers into a Source-note and reference audit sheet with repository
path fields, FOIA/access data, provenance trails, link fields, and review flags. The selection
matrix export ranks verified private records and OCR-derived print-candidate leads together by
country risk, date scope, source-note status, nearby evidence, and likely print value. The country
dossier export gives one rollup row per South America chapter with private-record coverage, source
mix, year gaps, public-statement counts, diary/backup counts, print-candidate pressure, risk
signals, and recommended actions. The other downloads preserve the full chronology, print-candidate,
daily diary/backup, and public-statement datasets.

To produce the same CSV files locally, run:

```bash
node scripts/build-compiler-exports.js
```

## Persons List

Generate the FRUS-style persons list from the user-provided Bush comprehensive names authority:

```bash
python3 scripts/build-persons-list.py /path/to/Bush-Comprehensive-Names-List.docx
```

This writes `persons.html`, `data/persons.json`, `data/persons.js`, and
`reports/persons-list-build.json`. The filter keeps entries tied to South America countries and
capitals, senior regional-policy roles, people named in the site's record metadata or OCR candidate
text, and core U.S. principals needed to interpret the memcons, telcons, and compiler leads. The
page format follows the official Volume XXXI Persons page:
<https://history.state.gov/historicaldocuments/frus1989-92v31/persons>.

## Compiler Gap Audit

Run the compiler-risk audit with:

```bash
node scripts/audit-compiler-gaps.js
```

This compares the verified private memcon/telcon corpus with OCR-derived print-candidate leads and
GovInfo public statements. It writes `data/compiler-gaps.json`, `data/compiler-gaps.js`, and
`reports/compiler-gap-audit.json`, then the public site renders the country risk ranking and
structural gaps. The audit is intentionally conservative: it treats thin country chapters,
high-priority lead backlogs, public-private chronology mismatches, partial releases, and source
families outside the current site as compiler risk.

## GovInfo Public Papers Reference

Run the Public Papers harvester with:

```bash
node scripts/harvest-public-statements.js
```

The harvester searches the GovInfo collection for George H.W. Bush public papers, parses package
MODS metadata and granule HTML where available, and OCR-splits the scanned 1989, 1990, and 1991
Book II PDF volumes where GovInfo exposes only volume-level scans. It writes
`data/public-statements.json`, `data/public-statements.js`, and
`reports/public-statements-harvest.json`.

The filter set covers Argentina, Bolivia, Brazil, Chile, Colombia, Ecuador, Guyana, Paraguay, Peru,
Suriname, Uruguay, and Venezuela. It strips Uruguay Round-only trade references from the Uruguay
country match and limits ambassador nomination/appointment matches to posts whose title names a
South America country.

## Source Anchors

- FRUS 1989-1992, Volume XXV, Latin America: <https://history.state.gov/historicaldocuments/frus1989-92v25>
- FRUS 1989-1992, Volume XXXI, START I source-note model: <https://history.state.gov/historicaldocuments/frus1989-92v31>
- Records of the National Security Council, NAID 2163580: <https://catalog.archives.gov/search-within/2163580>
- Latin American Directorate Chronological Files: <https://catalog.archives.gov/id/2197972>
- Latin American Affairs Directorate Subject Files: <https://catalog.archives.gov/search-within/376217847>
- Timothy E. Deal Subject Files: <https://catalog.archives.gov/id/2554810>
- Presidential Memcon Files: <https://catalog.archives.gov/id/321498039>
- January 1989 Presidential Telcon file unit: <https://catalog.archives.gov/id/322361434>
- Brent Scowcroft Papers, NAID 4522156: <https://catalog.archives.gov/id/4522156>
- Scowcroft Presidential Correspondence Files, NAID 4545941: <https://catalog.archives.gov/id/4545941>
- Bush Library Memcons and Telcons index: <https://www.bush41library.gov/digital-research-room/about-textual-collections/memcons-and-telcons>
- FOIA 2000-0429-F finding aid: <https://www.bush41library.gov/digital-research-room/finding-aid/foia/records-memcons-and-telcons-january-1989-december-1991>
- GovInfo Public Papers of the Presidents: George H.W. Bush: <https://www.govinfo.gov/app/collection/ppp/president-41_Bush,%20George%20H.%20W.>
- National Archives Catalog: <https://catalog.archives.gov/>

## Local Preview

Run a local static server so the page can fetch JSON:

```bash
python3 -m http.server 4181
```

Then open <http://127.0.0.1:4181/>.

## Publish

This repository deploys through GitHub Pages with `.github/workflows/deploy-pages.yml`.
