#!/usr/bin/env python3
"""Build a FRUS-style Persons page from the Bush comprehensive names list."""

from __future__ import annotations

import json
import os
import re
import sys
import unicodedata
from datetime import datetime, timezone
from html import escape
from pathlib import Path
from typing import Any
from xml.etree import ElementTree
from zipfile import ZipFile


REPO_ROOT = Path(__file__).resolve().parents[1]
MODEL_URL = "https://history.state.gov/historicaldocuments/frus1989-92v31/persons"
SOURCE_TITLE = "Bush Comprehensive Names List.docx"

SOUTH_AMERICA_TERMS = [
    "Argentina",
    "Argentine",
    "Buenos Aires",
    "Bolivia",
    "Bolivian",
    "La Paz",
    "Brazil",
    "Brazilian",
    "Brasilia",
    "Chile",
    "Chilean",
    "Santiago",
    "Colombia",
    "Colombian",
    "Bogota",
    "Ecuador",
    "Ecuadorian",
    "Quito",
    "Guyana",
    "Guyanese",
    "Embassy in Georgetown",
    "U.S. Embassy in Georgetown",
    "Paraguay",
    "Paraguayan",
    "Asuncion",
    "Peru",
    "Peruvian",
    "Lima",
    "Suriname",
    "Surinamese",
    "Paramaribo",
    "Uruguay",
    "Uruguayan",
    "Montevideo",
    "Venezuela",
    "Venezuelan",
    "Caracas",
    "South America",
    "Southern Cone",
    "Andean",
]

REGIONAL_TERMS = [
    "Inter-American Affairs",
    "Latin America",
    "Latin American",
    "Organization of American States",
    "Western Hemisphere",
    "American Republics",
    "Enterprise for the Americas",
]

SENIOR_REGIONAL_ROLE_TERMS = [
    "Assistant Secretary",
    "Principal Deputy Assistant Secretary",
    "Deputy Assistant Secretary",
    "Special Assistant to the President",
    "Senior Director",
    "Director for Latin",
    "Director, Office of South American Affairs",
    "U.S. Permanent Representative",
    "Permanent Representative",
    "Director General",
    "Deputy Assistant Administrator",
]

CORE_US_PRINCIPALS = [
    "Baker, James Addison",
    "Bennett, William J.",
    "Brady, Nicholas Frederick",
    "Bush, George Herbert Walker",
    "Card, Andrew H.",
    "Darman, Richard G.",
    "Deal, Timothy E.",
    "Demarest, David F.",
    "Eagleburger, Lawrence Sidney",
    "Fitzwater, M. Marlin",
    "Gates, Robert M.",
    "Gray, C. Boyden",
    "Haass, Richard N.",
    "Hills, Carla A.",
    "Kanter, Arnold L.",
    "Kimmitt, Robert M.",
    "Mosbacher, Robert A.",
    "Pastorino, Robert S.",
    "Porter, Roger B.",
    "Quayle, James Danforth",
    "Scowcroft, Gen. Brent",
    "Skinner, Samuel K.",
    "Sununu, John H.",
    "Zoellick, Robert Bruce",
]

SUFFIXES = {"jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "v"}
WORD_NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

ENTRY_REPLACEMENTS = {
    "Aylwin, Patrico,": "Aylwin, Patricio,",
    "DiTella, Guido,": "Di Tella, Guido,",
    "Paz Zamora, Jamie,": "Paz Zamora, Jaime,",
    "President of Columbia": "President of Colombia",
}

SUPPLEMENTAL_ENTRIES = [
    "Paz Estenssoro, Victor, President of Bolivia until August 6, 1989",
]


def normalize_text(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    asciiish = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", " ", asciiish.lower()).strip()


def slugify(value: str) -> str:
    slug = normalize_text(value).replace(" ", "-")
    return slug or "person"


def extract_docx_paragraphs(path: Path) -> list[str]:
    with ZipFile(path) as docx:
        document = ElementTree.fromstring(docx.read("word/document.xml"))

    paragraphs: list[str] = []
    seen: set[str] = set()
    for paragraph in document.findall(".//w:p", WORD_NS):
        text = "".join(
            node.text or "" for node in paragraph.findall(".//w:t", WORD_NS)
        ).strip()
        for old, new in ENTRY_REPLACEMENTS.items():
            text = text.replace(old, new)
        if text and text not in seen:
            seen.add(text)
            paragraphs.append(text)
    return paragraphs


def split_entry(entry: str) -> tuple[str, str]:
    parts = [part.strip() for part in entry.split(",")]
    if len(parts) < 2:
        return entry.strip(), ""

    name_parts = parts[:2]
    if len(parts) > 2 and parts[2].strip().lower() in SUFFIXES:
        name_parts.append(parts[2].strip())

    name = ", ".join(name_parts)
    description = entry[len(name) :].lstrip(", ")
    return name, description


def name_variants(name: str) -> set[str]:
    parts = [part.strip() for part in name.split(",")]
    if not parts:
        return set()

    surname = parts[0]
    given = parts[1] if len(parts) > 1 else ""
    given = re.sub(r'["“”][^"“”]+["“”]', "", given)
    given = re.sub(r"\([^)]*\)", "", given).strip()

    given_tokens = [token for token in re.split(r"\s+", given) if token]
    given_non_initials = [
        token for token in given_tokens if not re.fullmatch(r"[A-Z]\.?", token)
    ]
    first_given = given_non_initials[0] if given_non_initials else ""
    given_full = " ".join(given_non_initials)

    surname_tokens = [token for token in re.split(r"\s+", surname) if token]
    first_surname = surname_tokens[0] if surname_tokens else surname

    raw_variants = {
        name,
        f"{given} {surname}",
        f"{given_full} {surname}",
        f"{first_given} {surname}",
        f"{given_full} {first_surname}",
        f"{first_given} {first_surname}",
    }
    return {normalize_text(variant) for variant in raw_variants if len(normalize_text(variant)) > 5}


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def walk_strings(value: Any) -> list[str]:
    strings: list[str] = []
    if isinstance(value, str):
        strings.append(value)
    elif isinstance(value, list):
        for item in value:
            strings.extend(walk_strings(item))
    elif isinstance(value, dict):
        for item in value.values():
            strings.extend(walk_strings(item))
    return strings


def site_match_text() -> str:
    candidate_strings: list[str] = []

    memcons = load_json(REPO_ROOT / "data" / "memcons.json")
    for record in memcons:
        candidate_strings.extend(record.get("participants", []))
        candidate_strings.append(record.get("title", ""))

    for filename in [
        "chronological-print-candidates.json",
        "subject-print-candidates.json",
        "deal-print-candidates.json",
    ]:
        records = load_json(REPO_ROOT / "data" / filename)
        for record in records:
            for key in ["documentTitle", "ocrSnippet", "reviewReason"]:
                candidate_strings.append(record.get(key, ""))

    return f" {normalize_text(' '.join(candidate_strings))} "


def has_term(entry: str, terms: list[str]) -> bool:
    normalized = normalize_text(entry)
    return any(f" {normalize_text(term)} " in f" {normalized} " for term in terms)


def has_senior_regional_role(entry: str) -> bool:
    central_or_caribbean_only = has_term(entry, ["Central America", "Caribbean"]) and not has_term(
        entry, SOUTH_AMERICA_TERMS
    )
    if central_or_caribbean_only:
        return False
    return has_term(entry, REGIONAL_TERMS) and has_term(entry, SENIOR_REGIONAL_ROLE_TERMS)


def is_core_us_principal(name: str) -> bool:
    normalized = normalize_text(name)
    return any(
        normalized.startswith(normalize_text(principal))
        for principal in CORE_US_PRINCIPALS
    )


def build_person_entries(raw_entries: list[str]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    corpus = site_match_text()
    entries: list[dict[str, Any]] = []
    excluded_site_matches: list[str] = []

    for raw in raw_entries:
        name, description = split_entry(raw)
        reasons: list[str] = []

        if has_term(raw, SOUTH_AMERICA_TERMS):
            reasons.append("South America country or capital in name authority entry")
        if has_senior_regional_role(raw):
            reasons.append("Senior regional-policy role")
        if is_core_us_principal(name):
            reasons.append("Core U.S. principal for Bush 41 South America records")

        variants = name_variants(name)
        if any(f" {variant} " in corpus for variant in variants):
            if reasons:
                reasons.append("Name appears in site record metadata or OCR candidate text")
            else:
                excluded_site_matches.append(raw)

        if reasons:
            entries.append(
                {
                    "id": slugify(name),
                    "name": name,
                    "description": description,
                    "entry": raw,
                    "sortKey": normalize_text(name),
                    "reasons": reasons,
                }
            )

    duplicate_names: list[dict[str, Any]] = []
    deduped_by_name: dict[str, dict[str, Any]] = {}
    for entry in entries:
        existing = deduped_by_name.get(entry["sortKey"])
        if not existing:
            deduped_by_name[entry["sortKey"]] = entry
            continue

        duplicate_names.append({"kept": existing["entry"], "dropped": entry["entry"]})
        existing["reasons"] = sorted(set(existing["reasons"] + entry["reasons"]))
        if len(entry["description"]) > len(existing["description"]):
            entry["reasons"] = existing["reasons"]
            deduped_by_name[entry["sortKey"]] = entry

    entries = sorted(deduped_by_name.values(), key=lambda item: item["sortKey"])
    by_letter: dict[str, int] = {}
    for entry in entries:
        letter = entry["name"][0].upper()
        by_letter[letter] = by_letter.get(letter, 0) + 1

    report = {
        "sourceEntryCount": len(raw_entries),
        "includedEntryCount": len(entries),
        "duplicateIncludedNameCount": len(duplicate_names),
        "duplicateIncludedNames": duplicate_names,
        "excludedSiteNameMatchCount": len(excluded_site_matches),
        "excludedSiteNameMatchesSample": excluded_site_matches[:50],
        "byLetter": by_letter,
        "filters": {
            "southAmericaTerms": SOUTH_AMERICA_TERMS,
            "regionalTerms": REGIONAL_TERMS,
            "seniorRegionalRoleTerms": SENIOR_REGIONAL_ROLE_TERMS,
            "coreUsPrincipals": CORE_US_PRINCIPALS,
        },
    }
    return entries, report


def render_person_entry(entry: dict[str, Any]) -> str:
    text = entry["entry"]
    name = entry["name"]
    if text.startswith(name):
        rest = text[len(name) :].lstrip(", ")
        if rest:
            return (
                f'<li id="{escape(entry["id"])}">'
                f'<span class="person-name">{escape(name)}</span>, {escape(rest)}</li>'
            )
    return f'<li id="{escape(entry["id"])}">{escape(text)}</li>'


def render_persons_html(data: dict[str, Any]) -> str:
    persons = data["persons"]
    letters = sorted({person["name"][0].upper() for person in persons})
    letter_links = "\n              ".join(
        f'<a href="#persons-{letter.lower()}">{letter}</a>' for letter in letters
    )

    grouped: list[str] = []
    for letter in letters:
        letter_people = [
            person for person in persons if person["name"].upper().startswith(letter)
        ]
        items = "\n              ".join(render_person_entry(person) for person in letter_people)
        grouped.append(
            f"""<section class="persons-letter" id="persons-{letter.lower()}" aria-labelledby="persons-{letter.lower()}-title">
            <h2 id="persons-{letter.lower()}-title">{letter}</h2>
            <ul class="frus-persons-list">
              {items}
            </ul>
          </section>"""
        )

    grouped_html = "\n          ".join(grouped)
    generated_at = data["generatedAt"].replace("T", " ").replace("Z", " UTC")
    total_source = data["source"]["totalUniqueEntries"]
    total_persons = data["includedEntryCount"]

    return f"""<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Persons | FRUS 1989-1992 Volume XXV Files</title>
    <meta
      name="description"
      content="A FRUS-style persons list for the Bush 41 South America memcons, telcons, and compiler leads."
    />
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <header class="site-header">
      <a class="brand" href="index.html#top" aria-label="Bush 41 Latin America memcons home">
        <span class="brand-mark">41</span>
        <span>FRUS Volume XXV Files</span>
      </a>
      <nav aria-label="Primary navigation">
        <a href="index.html#chapters">Chapters</a>
        <a href="index.html#provenance">Provenance</a>
        <a href="index.html#method">Method</a>
        <a href="index.html#compiler-gaps">Gaps</a>
        <a href="index.html#print-candidates">Print Candidates</a>
        <a href="index.html#public-statements">Public Statements</a>
        <a aria-current="page" href="persons.html">Persons</a>
        <a href="index.html#records">Records</a>
        <a href="index.html#sources">Sources</a>
      </nav>
    </header>

    <main class="persons-page">
      <section class="section persons-hero" aria-labelledby="persons-title">
        <div class="section-heading">
          <div>
            <p class="kicker">FRUS 1989-1992, Volume XXV</p>
            <h1 id="persons-title">Persons</h1>
          </div>
        </div>
        <p class="lede persons-lede">
          Names and offices are drawn from the user-provided <em>{escape(SOURCE_TITLE)}</em> and
          filtered for South America country relevance, senior regional-policy roles, site record
          metadata, and core U.S. principals. The entries follow the published FRUS convention:
          surname first, then office, title, or role with applicable dates.
        </p>
        <p class="method-source">
          Format model:
          <a href="{MODEL_URL}" rel="noreferrer">FRUS 1989-1992, Volume XXXI, Persons</a>.
        </p>
      </section>

      <section class="stats compact-stats persons-stats" aria-label="Persons list summary">
        <div>
          <span>{total_persons}</span>
          <p>persons included</p>
        </div>
        <div>
          <span>{total_source}</span>
          <p>unique source entries reviewed</p>
        </div>
        <div>
          <span>{len(letters)}</span>
          <p>alphabetical sections</p>
        </div>
      </section>

      <section class="section persons-index" aria-labelledby="persons-index-title">
        <div class="section-heading">
          <p class="kicker">Reference</p>
          <h2 id="persons-index-title">Alphabetical List</h2>
        </div>
        <div class="persons-alpha" aria-label="Persons alphabet navigation">
          {letter_links}
        </div>
        <div class="persons-list-root">
          {grouped_html}
        </div>
      </section>
    </main>

    <footer>
      <p>Generated {escape(generated_at)} from {escape(SOURCE_TITLE)}.</p>
      <a href="https://github.com/therealjameswilson/Bush41-LatAm">Repository</a>
    </footer>
  </body>
</html>
"""


def main() -> int:
    if len(sys.argv) > 1:
        source_path = Path(sys.argv[1]).expanduser()
    elif os.environ.get("PERSONS_SOURCE_DOCX"):
        source_path = Path(os.environ["PERSONS_SOURCE_DOCX"]).expanduser()
    else:
        print(
            "Usage: scripts/build-persons-list.py /path/to/Bush-Comprehensive-Names-List.docx",
            file=sys.stderr,
        )
        return 2

    if not source_path.exists():
        print(f"Source DOCX not found: {source_path}", file=sys.stderr)
        return 2

    source_entries = extract_docx_paragraphs(source_path)
    raw_entries = list(source_entries)
    seen_entries = set(raw_entries)
    for supplemental_entry in SUPPLEMENTAL_ENTRIES:
        if supplemental_entry not in seen_entries:
            raw_entries.append(supplemental_entry)

    persons, report = build_person_entries(raw_entries)
    supplemental_count = len(raw_entries) - len(source_entries)
    report["sourceEntryCount"] = len(source_entries)
    report["supplementalEntryCount"] = supplemental_count
    report["inputEntryCount"] = len(raw_entries)
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    data = {
        "generatedAt": generated_at,
        "source": {
            "title": SOURCE_TITLE,
            "kind": "user-provided DOCX name authority",
            "totalUniqueEntries": len(source_entries),
            "supplementalEntries": supplemental_count,
        },
        "model": {
            "title": "FRUS 1989-1992, Volume XXXI, Persons",
            "url": MODEL_URL,
        },
        "scope": (
            "South America volume persons list generated from a comprehensive Bush-era name "
            "authority using country, capital, regional-policy, site metadata, and core-principal filters."
        ),
        "includedEntryCount": len(persons),
        "persons": persons,
    }

    data_path = REPO_ROOT / "data" / "persons.json"
    js_path = REPO_ROOT / "data" / "persons.js"
    report_path = REPO_ROOT / "reports" / "persons-list-build.json"
    html_path = REPO_ROOT / "persons.html"

    data_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    js_path.write_text(
        "window.PERSONS_DATA = "
        + json.dumps(data, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )
    report_path.write_text(
        json.dumps({"generatedAt": generated_at, **report}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    html_path.write_text(render_persons_html(data), encoding="utf-8")

    print(f"Wrote {data_path.relative_to(REPO_ROOT)}")
    print(f"Wrote {js_path.relative_to(REPO_ROOT)}")
    print(f"Wrote {report_path.relative_to(REPO_ROOT)}")
    print(f"Wrote {html_path.relative_to(REPO_ROOT)}")
    print(
        f"Included {len(persons)} of {len(source_entries)} unique source entries"
        f" plus {supplemental_count} supplemental entries"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
