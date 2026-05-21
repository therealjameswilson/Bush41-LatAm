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
folder title, then release facts. Working metadata such as NAIDs, catalog URLs, digital-object
filenames, source page ranges, duplicate provenance, and project-PDF construction remains in the
expanded provenance trail for each record.

## Source Anchors

- FRUS 1989-1992, Volume XXV, Latin America: <https://history.state.gov/historicaldocuments/frus1989-92v25>
- FRUS 1989-1992, Volume XXXI, START I source-note model: <https://history.state.gov/historicaldocuments/frus1989-92v31>
- Records of the National Security Council, NAID 2163580: <https://catalog.archives.gov/search-within/2163580>
- Latin American Directorate Chronological Files: <https://catalog.archives.gov/id/2197972>
- Latin American Affairs Directorate Subject Files: <https://catalog.archives.gov/search-within/376217847>
- Presidential Memcon Files: <https://catalog.archives.gov/id/321498039>
- January 1989 Presidential Telcon file unit: <https://catalog.archives.gov/id/322361434>
- Brent Scowcroft Papers, NAID 4522156: <https://catalog.archives.gov/id/4522156>
- Scowcroft Presidential Correspondence Files, NAID 4545941: <https://catalog.archives.gov/id/4545941>
- Bush Library Memcons and Telcons index: <https://www.bush41library.gov/digital-research-room/about-textual-collections/memcons-and-telcons>
- FOIA 2000-0429-F finding aid: <https://www.bush41library.gov/digital-research-room/finding-aid/foia/records-memcons-and-telcons-january-1989-december-1991>
- National Archives Catalog: <https://catalog.archives.gov/>

## Local Preview

Run a local static server so the page can fetch JSON:

```bash
python3 -m http.server 4181
```

Then open <http://127.0.0.1:4181/>.

## Publish

This repository deploys through GitHub Pages with `.github/workflows/deploy-pages.yml`.
