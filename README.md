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

## Scowcroft Files

Run the Scowcroft Presidential Correspondence Files extractor to add South America head-of-state
memcons and telcons from the Brent Scowcroft Papers:

```bash
node scripts/harvest-scowcroft-south-america.js
```

This scans OCR for South America leaders, extracts the relevant page ranges into `documents/`, merges
the records into `data/memcons.json`, and writes
`reports/scowcroft-south-america-harvest.json`.

## Source Anchors

- FRUS 1989-1992, Volume XXV, Latin America: <https://history.state.gov/historicaldocuments/frus1989-92v25>
- Records of the National Security Council, NAID 2163580: <https://catalog.archives.gov/search-within/2163580>
- Latin American Directorate Chronological Files: <https://catalog.archives.gov/id/2197972>
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
