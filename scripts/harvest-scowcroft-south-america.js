const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const dataPath = path.join(repoRoot, "data", "memcons.json");
const dataScriptPath = path.join(repoRoot, "data", "memcons.js");
const reportPath = path.join(repoRoot, "reports", "scowcroft-south-america-harvest.json");
const documentsRoot = path.join(repoRoot, "documents");
const sourceRoot = path.join(repoRoot, ".cache", "scowcroft-source");
const ocrRoot = path.join(repoRoot, ".cache", "scowcroft-ocr");
const siblingCacheRoots = [
  path.resolve(repoRoot, "..", "Bush41-SouthAsia", ".cache"),
  path.resolve(repoRoot, "..", "Bush41-Western-Europe", ".cache")
];

const SOURCE_COLLECTION = {
  name: "Brent Scowcroft Papers",
  url: "https://catalog.archives.gov/id/4522156",
  series: "Presidential Correspondence Files",
  seriesNaid: "4545941",
  referenceUnit: "George Bush Library"
};

const SCOWCROFT_FOLDERS = [
  {
    "naid": "366551660",
    "title": "Presidential Meetings--Memorandum of Conversations 1/24/89-2/25/89",
    "localIdentifier": "91107-001",
    "type": "Memcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-memcon-91107-001.pdf",
    "fileName": "366551660-memcon-91107-001.pdf"
  },
  {
    "naid": "366551661",
    "title": "Presidential Meetings--Memorandum of Conversations 2/26/89-4/19/89",
    "localIdentifier": "91107-002",
    "type": "Memcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-memcon-91107-002.pdf",
    "fileName": "366551661-memcon-91107-002.pdf"
  },
  {
    "naid": "366551662",
    "title": "Presidential Meetings--Memorandum of Conversations 4/19/89-5/31/89",
    "localIdentifier": "91107-003",
    "type": "Memcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-memcon-91107-003.pdf",
    "fileName": "366551662-memcon-91107-003.pdf"
  },
  {
    "naid": "366551663",
    "title": "Presidential Meetings--Memorandum of Conversations 6/1/89-7/12/89",
    "localIdentifier": "91107-004",
    "type": "Memcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-memcon-91107-004.pdf",
    "fileName": "366551663-memcon-91107-004.pdf"
  },
  {
    "naid": "366551664",
    "title": "Presidential Meetings--Memorandum of Conversations 7/14/89-10/2/89",
    "localIdentifier": "91107-005",
    "type": "Memcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-memcon-91107-005.pdf",
    "fileName": "366551664-memcon-91107-005.pdf"
  },
  {
    "naid": "366551665",
    "title": "Presidential Meetings--Memorandum of Conversations 10/3/89-12/16/89",
    "localIdentifier": "91107-006",
    "type": "Memcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-memcon-91107-006.pdf",
    "fileName": "366551665-memcon-91107-006.pdf"
  },
  {
    "naid": "366551666",
    "title": "Presidential Meetings--Memorandum of Conversations 1/11/90-2/21/90",
    "localIdentifier": "91107-007",
    "type": "Memcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-memcon-91107-007.pdf",
    "fileName": "366551666-memcon-91107-007.pdf"
  },
  {
    "naid": "366551667",
    "title": "Presidential Meetings--Memorandum of Conversations 2/22/90-4/11/90",
    "localIdentifier": "91107-008",
    "type": "Memcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-memcon-91107-008.pdf",
    "fileName": "366551667-memcon-91107-008.pdf"
  },
  {
    "naid": "366551670",
    "title": "Presidential Meetings--Memorandum of Conversations 7/5/90-9/24/90",
    "localIdentifier": "91108-001",
    "type": "Memcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-memcon-91108-001.pdf",
    "fileName": "366551670-memcon-91108-001.pdf"
  },
  {
    "naid": "366551671",
    "title": "Presidential Meetings--Memorandum of Conversations 9/25/90-10/31/90",
    "localIdentifier": "91108-002",
    "type": "Memcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-memcon-91108-002.pdf",
    "fileName": "366551671-memcon-91108-002.pdf"
  },
  {
    "naid": "366551672",
    "title": "Presidential Meetings--Memorandum of Conversations 11/13/90-12/21/90",
    "localIdentifier": "91108-003",
    "type": "Memcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-memcon-91108-003.pdf",
    "fileName": "366551672-memcon-91108-003.pdf"
  },
  {
    "naid": "366551673",
    "title": "Presidential Meetings--Memorandum of Conversations 1/14/91-3/8/91",
    "localIdentifier": "91108-004",
    "type": "Memcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-memcon-91108-004.pdf",
    "fileName": "366551673-memcon-91108-004.pdf"
  },
  {
    "naid": "366551674",
    "title": "Presidential Meetings--Memorandum of Conversations 3/11/91-4/24/91",
    "localIdentifier": "91108-005",
    "type": "Memcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-memcon-91108-005.pdf",
    "fileName": "366551674-memcon-91108-005.pdf"
  },
  {
    "naid": "366551675",
    "title": "Presidential Meetings--Memorandum of Conversations 5/3/91-6/28/91",
    "localIdentifier": "91108-006",
    "type": "Memcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-memcon-91108-006.pdf",
    "fileName": "366551675-memcon-91108-006.pdf"
  },
  {
    "naid": "366551676",
    "title": "Presidential Meetings--Memorandum of Conversations 7/11/91-7/22/91",
    "localIdentifier": "91109-001",
    "type": "Memcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-memcon-91109-001.pdf",
    "fileName": "366551676-memcon-91109-001.pdf"
  },
  {
    "naid": "366551677",
    "title": "Presidential Meetings--Memorandum of Conversations 7/24/91-9/24/91",
    "localIdentifier": "91109-002",
    "type": "Memcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-memcon-91109-002.pdf",
    "fileName": "366551677-memcon-91109-002.pdf"
  },
  {
    "naid": "366551680",
    "title": "Presidential Meetings--Memorandum of Conversations 1/1/92-1/31/92",
    "localIdentifier": "91109-005",
    "type": "Memcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-memcon-91109-005.pdf",
    "fileName": "366551680-memcon-91109-005.pdf"
  },
  {
    "naid": "366551683",
    "title": "Presidential Meetings--Memorandum of Conversations 5/1/92-6/17/92",
    "localIdentifier": "91109-008",
    "type": "Memcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-memcon-91109-008.pdf",
    "fileName": "366551683-memcon-91109-008.pdf"
  },
  {
    "naid": "366551684",
    "title": "Presidential Meetings--Memorandum of Conversations 7/1/92-7/9/92",
    "localIdentifier": "91110-001",
    "type": "Memcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-memcon-91110-001.pdf",
    "fileName": "366551684-memcon-91110-001.pdf"
  },
  {
    "naid": "366551685",
    "title": "Presidential Meetings--Memorandum of Conversations 7/9/92-12/22/92",
    "localIdentifier": "91110-002",
    "type": "Memcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-memcon-91110-002.pdf",
    "fileName": "366551685-memcon-91110-002.pdf"
  },
  {
    "naid": "366551686",
    "title": "Presidential Telephone Calls--Memorandum of Conversations 1/23/89-5/10/89",
    "localIdentifier": "91111-001",
    "type": "Telcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-telcon-91111-001.pdf",
    "fileName": "366551686-telcon-91111-001.pdf"
  },
  {
    "naid": "366551687",
    "title": "Presidential Telephone Calls--Memorandum of Conversations 5/10/89-7/27/89",
    "localIdentifier": "91111-002",
    "type": "Telcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-telcon-91111-002.pdf",
    "fileName": "366551687-telcon-91111-002.pdf"
  },
  {
    "naid": "366551688",
    "title": "Presidential Telephone Calls--Memorandum of Conversations 8/1/89-10/23/89",
    "localIdentifier": "91111-003",
    "type": "Telcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-telcon-91111-003.pdf",
    "fileName": "366551688-telcon-91111-003.pdf"
  },
  {
    "naid": "366551690",
    "title": "Presidential Telephone Calls--Memorandum of Conversations 1/1/90-3/15/90",
    "localIdentifier": "91111-005",
    "type": "Telcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-telcon-91111-005.pdf",
    "fileName": "366551690-telcon-91111-005.pdf"
  },
  {
    "naid": "366551691",
    "title": "Presidential Telephone Calls--Memorandum of Conversations 3/15/90-6/22/90",
    "localIdentifier": "91111-006",
    "type": "Telcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-telcon-91111-006.pdf",
    "fileName": "366551691-telcon-91111-006.pdf"
  },
  {
    "naid": "366551692",
    "title": "Presidential Telephone Calls--Memorandum of Conversations 6/23/90-7/31/90",
    "localIdentifier": "91111-007",
    "type": "Telcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-telcon-91111-007.pdf",
    "fileName": "366551692-telcon-91111-007.pdf"
  },
  {
    "naid": "366551693",
    "title": "Presidential Telephone Calls--Memorandum of Conversations 8/2/90-8/20/90",
    "localIdentifier": "91112-001",
    "type": "Telcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-telcon-91112-001.pdf",
    "fileName": "366551693-telcon-91112-001.pdf"
  },
  {
    "naid": "366551694",
    "title": "Presidential Telephone Calls--Memorandum of Conversations 8/22/90-10/5/90",
    "localIdentifier": "91112-002",
    "type": "Telcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-telcon-91112-002.pdf",
    "fileName": "366551694-telcon-91112-002.pdf"
  },
  {
    "naid": "366551695",
    "title": "Presidential Telephone Calls--Memorandum of Conversations 10/11/90-12/31/90",
    "localIdentifier": "91112-003",
    "type": "Telcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-telcon-91112-003.pdf",
    "fileName": "366551695-telcon-91112-003.pdf"
  },
  {
    "naid": "366551696",
    "title": "Presidential Telephone Calls--Memorandum of Conversations 1/1/91-1/28/91",
    "localIdentifier": "91112-004",
    "type": "Telcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-telcon-91112-004.pdf",
    "fileName": "366551696-telcon-91112-004.pdf"
  },
  {
    "naid": "366551697",
    "title": "Presidential Telephone Calls--Memorandum of Conversations 1/30/91-2/22/91",
    "localIdentifier": "91112-005",
    "type": "Telcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-telcon-91112-005.pdf",
    "fileName": "366551697-telcon-91112-005.pdf"
  },
  {
    "naid": "366551698",
    "title": "Presidential Telephone Calls--Memorandum of Conversations 2/22/91-3/6/91",
    "localIdentifier": "91112-006",
    "type": "Telcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-telcon-91112-006.pdf",
    "fileName": "366551698-telcon-91112-006.pdf"
  },
  {
    "naid": "366551699",
    "title": "Presidential Telephone Calls--Memorandum of Conversations 3/7/91-4/25/91",
    "localIdentifier": "91112-007",
    "type": "Telcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-telcon-91112-007.pdf",
    "fileName": "366551699-telcon-91112-007.pdf"
  },
  {
    "naid": "366551700",
    "title": "Presidential Telephone Calls--Memorandum of Conversations 5/3/91-7/21/91",
    "localIdentifier": "91112-008",
    "type": "Telcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-telcon-91112-008.pdf",
    "fileName": "366551700-telcon-91112-008.pdf"
  },
  {
    "naid": "366551701",
    "title": "Presidential Telephone Calls--Memorandum of Conversations 8/5/91-9/25/91",
    "localIdentifier": "91113-001",
    "type": "Telcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-telcon-91113-001.pdf",
    "fileName": "366551701-telcon-91113-001.pdf"
  },
  {
    "naid": "366551702",
    "title": "Presidential Telephone Calls--Memorandum of Conversations 9/27/91-12/25/91",
    "localIdentifier": "91113-002",
    "type": "Telcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-telcon-91113-002.pdf",
    "fileName": "366551702-telcon-91113-002.pdf"
  },
  {
    "naid": "366551703",
    "title": "Presidential Telephone Calls--Memorandum of Conversations 1/2/92-4/9/92",
    "localIdentifier": "91113-003",
    "type": "Telcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-telcon-91113-003.pdf",
    "fileName": "366551703-telcon-91113-003.pdf"
  },
  {
    "naid": "366551704",
    "title": "Presidential Telephone Calls--Memorandum of Conversations 4/10/92-6/30/92",
    "localIdentifier": "91113-004",
    "type": "Telcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-telcon-91113-004.pdf",
    "fileName": "366551704-telcon-91113-004.pdf"
  },
  {
    "naid": "366551705",
    "title": "Presidential Telephone Calls--Memorandum of Conversations 7/10/92-11/5/92",
    "localIdentifier": "91113-005",
    "type": "Telcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-telcon-91113-005.pdf",
    "fileName": "366551705-telcon-91113-005.pdf"
  },
  {
    "naid": "366551706",
    "title": "Presidential Telephone Calls--Memorandum of Conversations 11/5/92-1/2/93",
    "localIdentifier": "91113-006",
    "type": "Telcon",
    "pdfUrl": "https://s3.amazonaws.com/NARAprodstorage/lz/presidential-libraries/bush/gb-gbs/4545941/41-bpr-scow-pcor-telcon-91113-006.pdf",
    "fileName": "366551706-telcon-91113-006.pdf"
  }
];

const COUNTERPARTS = [
  { key: "alfonsin", display: "Raul Alfonsin", country: "Argentina", patterns: [/raul\s+alfonsin/i, /president\s+alfonsin/i] },
  { key: "menem", display: "Carlos Saul Menem", country: "Argentina", patterns: [/carlos\s+(saul\s+)?menem/i, /president\s+menem/i] },
  { key: "di-tella", display: "Guido Di Tella", country: "Argentina", patterns: [/guido\s+di\s+tella/i, /foreign minister\s+di\s+tella/i] },
  { key: "paz-zamora", display: "Jaime Paz Zamora", country: "Bolivia", patterns: [/jaime\s+paz\s+zamora/i, /president\s+paz\s+zamora/i] },
  { key: "sarney", display: "Jose Sarney", country: "Brazil", patterns: [/jose\s+sarney/i, /president\s+sarney/i] },
  { key: "collor", display: "Fernando Collor de Mello", country: "Brazil", patterns: [/fernando\s+collor/i, /collor\s+de\s+mello/i, /president\s+collor/i] },
  { key: "aylwin", display: "Patricio Aylwin", country: "Chile", patterns: [/patricio\s+aylwin/i, /president\s+aylwin/i] },
  { key: "pinochet", display: "Augusto Pinochet", country: "Chile", patterns: [/augusto\s+pinochet/i, /general\s+pinochet/i] },
  { key: "barco", display: "Virgilio Barco", country: "Colombia", patterns: [/virgilio\s+barco/i, /president\s+barco/i] },
  { key: "gaviria", display: "Cesar Gaviria", country: "Colombia", patterns: [/cesar\s+gaviria/i, /president\s+gaviria/i] },
  { key: "borja", display: "Rodrigo Borja", country: "Ecuador", patterns: [/rodrigo\s+borja/i, /president\s+borja/i] },
  { key: "duran-ballen", display: "Sixto Duran Ballen", country: "Ecuador", patterns: [/sixto\s+duran\s+ballen/i, /president\s+duran/i] },
  { key: "hoyte", display: "Desmond Hoyte", country: "Guyana", patterns: [/desmond\s+hoyte/i, /president\s+hoyte/i] },
  { key: "jagan", display: "Cheddi Jagan", country: "Guyana", patterns: [/cheddi\s+jagan/i, /president\s+jagan/i] },
  { key: "rodriguez", display: "Andres Rodriguez", country: "Paraguay", patterns: [/andres\s+rodriguez/i, /president\s+rodriguez/i] },
  { key: "alan-garcia", display: "Alan Garcia", country: "Peru", patterns: [/alan\s+garcia/i, /president\s+garcia/i] },
  { key: "fujimori", display: "Alberto Fujimori", country: "Peru", patterns: [/alberto\s+fujimori/i, /president\s+fujimori/i] },
  { key: "bouterse", display: "Desi Bouterse", country: "Suriname", patterns: [/desi\s+bouterse/i, /desir[eé]\s+bouterse/i, /bouterse/i] },
  { key: "lacalle", display: "Luis Alberto Lacalle", country: "Uruguay", patterns: [/luis\s+alberto\s+lacalle/i, /president\s+lacalle/i] },
  { key: "sanguinetti", display: "Julio Maria Sanguinetti", country: "Uruguay", patterns: [/julio\s+(maria\s+)?sanguinetti/i, /president\s+sanguinetti/i] },
  { key: "carlos-andres-perez", display: "Carlos Andres Perez", country: "Venezuela", patterns: [/carlos\s+andres\s+perez/i, /president\s+perez/i] },
  { key: "lusinchi", display: "Jaime Lusinchi", country: "Venezuela", patterns: [/jaime\s+lusinchi/i, /president\s+lusinchi/i] }
];

const CHAPTER_TOPICS = [
  { chapter: { number: 1, name: "Argentina" }, country: "Argentina", patterns: [/argentina/i, /argentine/i, /alfonsin/i, /menem/i, /di\s+tella/i] },
  { chapter: { number: 2, name: "Bolivia" }, country: "Bolivia", patterns: [/bolivia/i, /bolivian/i, /paz\s+zamora/i] },
  { chapter: { number: 3, name: "Brazil" }, country: "Brazil", patterns: [/brazil/i, /brazilian/i, /sarney/i, /collor/i] },
  { chapter: { number: 4, name: "Chile" }, country: "Chile", patterns: [/chile/i, /chilean/i, /aylwin/i, /pinochet/i] },
  { chapter: { number: 5, name: "Colombia" }, country: "Colombia", patterns: [/colombia/i, /colombian/i, /barco/i, /gaviria/i] },
  { chapter: { number: 6, name: "Ecuador" }, country: "Ecuador", patterns: [/ecuador/i, /ecuadorian/i, /ecuadoran/i, /borja/i, /duran\s+ballen/i] },
  { chapter: { number: 7, name: "Guyana" }, country: "Guyana", patterns: [/guyana/i, /guyanese/i, /hoyte/i, /jagan/i] },
  { chapter: { number: 8, name: "Paraguay" }, country: "Paraguay", patterns: [/paraguay/i, /paraguayan/i, /andres\s+rodriguez/i] },
  { chapter: { number: 9, name: "Peru" }, country: "Peru", patterns: [/peru/i, /peruvian/i, /alan\s+garcia/i, /fujimori/i] },
  { chapter: { number: 10, name: "Suriname" }, country: "Suriname", patterns: [/suriname/i, /surinamese/i, /bouterse/i] },
  { chapter: { number: 11, name: "Uruguay" }, country: "Uruguay", patterns: [/uruguay/i, /uruguayan/i, /lacalle/i, /sanguinetti/i] },
  { chapter: { number: 12, name: "Venezuela" }, country: "Venezuela", patterns: [/venezuela/i, /venezuelan/i, /carlos\s+andres\s+perez/i, /president\s+perez/i, /lusinchi/i] }
];

const DIRECT_COUNTRY_CHAPTERS = new Map(CHAPTER_TOPICS.map((topic) => [topic.country, topic.chapter]));

const EXCLUDED_SUBJECT_PATTERNS = [
  /^PARTICIPANTS:/i,
  /defense minister/i,
  /secretary general/i,
  /iraqi national congress/i,
  /economic summit/i,
  /opening session/i,
  /plenary session/i,
  /G-7 Meeting/i
];

const NON_SOUTH_AMERICA_TITLE_PATTERNS = [
  /costa\s+rica/i,
  /prime minister\s+gonzalez/i,
  /\bspain\b/i
];

const COUNTRY_TITLE_PATTERNS = new Map([
  ["Argentina", [/argentina/i, /argentine/i]],
  ["Bolivia", [/bolivia/i, /bolivian/i]],
  ["Brazil", [/brazil/i, /brazilian/i]],
  ["Chile", [/chile/i, /chilean/i]],
  ["Colombia", [/colombia/i, /colombian/i]],
  ["Ecuador", [/ecuador/i, /ecuadorian/i, /ecuadoran/i]],
  ["Guyana", [/guyana/i, /guyanese/i]],
  ["Paraguay", [/paraguay/i, /paraguayan/i]],
  ["Peru", [/peru/i, /peruvian/i]],
  ["Suriname", [/suriname/i, /surinamese/i]],
  ["Uruguay", [/uruguay/i, /uruguayan/i]],
  ["Venezuela", [/venezuela/i, /venezuelan/i]]
]);

function slug(value) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function run(command, args) {
  childProcess.execFileSync(command, args, { stdio: "inherit" });
}

function download(folder) {
  ensureDir(sourceRoot);
  const target = path.join(sourceRoot, folder.fileName);
  if (!fs.existsSync(target)) {
    const siblingSource = siblingCacheRoots
      .map((root) => path.join(root, "scowcroft-source", folder.fileName))
      .find((candidate) => fs.existsSync(candidate));
    if (siblingSource) {
      fs.copyFileSync(siblingSource, target);
      return target;
    }
    run("curl", ["-L", folder.pdfUrl, "-o", target]);
  }
  return target;
}

function ocr(folder, sourcePath) {
  ensureDir(ocrRoot);
  const sidecar = path.join(ocrRoot, `${folder.naid}.txt`);
  const ocrPdf = path.join(ocrRoot, `${folder.naid}-ocr.pdf`);
  if (!fs.existsSync(sidecar)) {
    const siblingSidecar = siblingCacheRoots
      .map((root) => path.join(root, "scowcroft-ocr", `${folder.naid}.txt`))
      .find((candidate) => fs.existsSync(candidate));
    if (siblingSidecar) {
      fs.copyFileSync(siblingSidecar, sidecar);
      return sidecar;
    }
    run("ocrmypdf", ["--sidecar", sidecar, "--skip-text", "--deskew", "--optimize", "0", sourcePath, ocrPdf]);
  }
  return sidecar;
}

function splitSidecarPages(text) {
  return text.split("\f").map((pageText) => pageText.trim());
}

function findDocumentStarts(pages) {
  const starts = [];
  for (let index = 0; index < pages.length; index += 1) {
    const normalized = pages[index].replace(/\s+/g, " ");
    if (
      /MEMORANDUM\s+OF\s+(TELEPHONE\s+)?CONVERSATION/i.test(normalized) &&
      /SUBJECT\s*:/i.test(normalized) &&
      /PARTICIPANTS\s*:/i.test(normalized)
    ) {
      starts.push(index);
    }
  }
  return starts;
}

function inferYearFromFolder(folder) {
  const yearMatch = folder.title.match(/(?:^|\D)\d{1,2}\/\d{1,2}\/(\d{2})(?=\D|$)/);
  if (!yearMatch) return null;
  return `19${yearMatch[1]}`;
}

function dateFromText(text, folder) {
  const match = text.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December)\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?/i
  );
  if (!match) return { raw: "", iso: "1989-01-01" };
  const year = match[3] || inferYearFromFolder(folder);
  if (!year) return { raw: match[0], iso: "1989-01-01" };
  const raw = `${match[1]} ${match[2]}, ${year}`;
  const parsed = new Date(`${raw} UTC`);
  return { raw: match[0], iso: parsed.toISOString().slice(0, 10) };
}

function titleFromText(text, fallbackLeader, type) {
  const subject = text.match(/SUBJECT:\s*(.+?)(?:PARTICIPANTS:|DATE,?\s+TIME|The President:)/is);
  if (subject) {
    return subject[1].replace(/\s+/g, " ").trim();
  }
  return `${type === "Telcon" ? "Telephone conversation" : "Meeting"}: President Bush and ${fallbackLeader}`;
}

function classifyDoc(text, folder) {
  if (folder.type === "Telcon") return "Telcon";
  return /MEMORANDUM\s+OF\s+TELEPHONE\s+CONVERSATION/i.test(text) ? "Telcon" : "Memcon";
}

function findCounterpart(text) {
  return COUNTERPARTS.find((counterpart) => counterpart.patterns.some((pattern) => pattern.test(text)));
}

function titleNamesCounterpart(title, counterpart) {
  const countryPatterns = COUNTRY_TITLE_PATTERNS.get(counterpart.country) || [];
  return [...counterpart.patterns, ...countryPatterns].some((pattern) => pattern.test(title));
}

function topicForText(text) {
  const scores = CHAPTER_TOPICS.map((topic) => ({
    topic,
    score: topic.patterns.reduce((total, pattern) => total + (text.match(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`)) || []).length, 0)
  }));
  scores.sort((a, b) => b.score - a.score || a.topic.chapter.number - b.topic.chapter.number);
  return scores[0]?.score ? scores[0] : null;
}

function directTopicForCounterpart(counterpart) {
  const chapter = DIRECT_COUNTRY_CHAPTERS.get(counterpart.country);
  if (!chapter) return null;
  return {
    chapter,
    country: counterpart.country
  };
}

function headerTextFor(text) {
  const throughDate = text.match(/(SUBJECT:.*?DATE,?\s+TIME.*?(?:AND PLACE|PLACE)?\s*:?.*?)(?:\n\s*(?:The President:|President Bush|Prime Minister|Foreign Minister|Secretary General|General Secretary|President\s+[A-Z])|$)/is);
  if (throughDate) return throughDate[1].replace(/\s+/g, " ");

  const throughParticipants = text.match(/(SUBJECT:.*?PARTICIPANTS:.*?)(?:\n\s*DATE,?\s+TIME|\n\s*(?:The President:|President Bush|Prime Minister|Foreign Minister|Secretary General|General Secretary|President\s+[A-Z])|$)/is);
  if (throughParticipants) return throughParticipants[1].replace(/\s+/g, " ");

  const throughSubject = text.match(/(SUBJECT:\s*.+?)(?:\n|PARTICIPANTS:|$)/is);
  return (throughSubject ? throughSubject[1] : text.slice(0, 1000)).replace(/\s+/g, " ");
}

function pageCount(filePath) {
  const output = childProcess.execFileSync("pdfinfo", [filePath], { encoding: "utf8" });
  const match = output.match(/^Pages:\s+(\d+)/m);
  return match ? Number(match[1]) : 0;
}

function extractPages(sourcePath, startIndex, endIndex, outPath) {
  ensureDir(path.dirname(outPath));
  run("pdfseparate", ["-f", String(startIndex + 1), "-l", String(endIndex), sourcePath, path.join(path.dirname(outPath), "page-%04d.pdf")]);
  const pages = [];
  for (let page = startIndex + 1; page <= endIndex; page += 1) {
    pages.push(path.join(path.dirname(outPath), `page-${String(page).padStart(4, "0")}.pdf`));
  }
  run("pdfunite", [...pages, outPath]);
  for (const page of pages) fs.rmSync(page, { force: true });
}

function buildRecordsForFolder(folder, sourcePath, sidecarPath) {
  const pages = splitSidecarPages(fs.readFileSync(sidecarPath, "utf8"));
  const starts = findDocumentStarts(pages);
  const records = [];

  for (let i = 0; i < starts.length; i += 1) {
    const start = starts[i];
    const end = starts[i + 1] ?? pages.length;
    const text = pages.slice(start, end).join("\n\n");
    const headerText = headerTextFor(text);
    const counterpart = findCounterpart(headerText);
    if (!counterpart) continue;

    const type = classifyDoc(text, folder);
    const date = dateFromText(text, folder);
    const title = titleFromText(text, counterpart.display, type);
    if (EXCLUDED_SUBJECT_PATTERNS.some((pattern) => pattern.test(title))) continue;
    if (
      !titleNamesCounterpart(title, counterpart) &&
      NON_SOUTH_AMERICA_TITLE_PATTERNS.some((pattern) => pattern.test(title))
    ) {
      continue;
    }

    const directTopic = counterpart ? directTopicForCounterpart(counterpart) : null;
    const headerTopic = topicForText(`${title} ${headerText}`);
    const bodyTopic = topicForText(text);
    const topic = directTopic || headerTopic?.topic || (bodyTopic && bodyTopic.score >= 5 ? bodyTopic.topic : null);
    if (!topic) continue;

    const chapterSlug = slug(topic.chapter.name);
    const leaderSlug = slug(counterpart.display);
    const fileName = `${date.iso}-bush-${leaderSlug}-${type.toLowerCase()}-${folder.localIdentifier}-p${start + 1}-scowcroft.pdf`;
    const relativePath = `documents/${chapterSlug}/${fileName}`;
    const outPath = path.join(documentsRoot, chapterSlug, fileName);

    if (!fs.existsSync(outPath)) {
      extractPages(sourcePath, start, end, outPath);
    }

    const pagesInDoc = pageCount(outPath);
    records.push({
      id: `scowcroft-${folder.naid}-${start + 1}-${leaderSlug}-${type.toLowerCase()}`,
      date: date.iso,
      sortDate: date.iso,
      type,
      title,
      sourceTitle: `${folder.title}; source pages ${start + 1}-${end}`,
      participants: ["George H. W. Bush", counterpart.display],
      countries: [...new Set(["United States", topic.country === "Regional" ? null : topic.country, counterpart.country].filter(Boolean))],
      chapter: topic.chapter,
      releaseStatus: "Declassified",
      naid: folder.naid,
      localIdentifier: folder.localIdentifier,
      pdfUrl: relativePath,
      catalogUrl: `https://catalog.archives.gov/id/${folder.naid}`,
      source: {
        ...SOURCE_COLLECTION,
        objectUrl: folder.pdfUrl,
        objectFilename: path.basename(folder.pdfUrl),
        sourcePages: `${start + 1}-${end}`
      },
      frusVolume: "Foreign Relations of the United States, 1989-1992, Volume XXV, Latin America",
      frusTopics: ["Latin America", "South America", topic.country, "Brent Scowcroft Papers", "Head-of-state memcons and telcons"],
      topics: ["Latin America", "South America", topic.country, type, "Head of state"],
      pageCount: pagesInDoc,
      notes:
        "Extracted from OCR of the Brent Scowcroft Papers Presidential Correspondence Files. Page range is based on detected memorandum-of-conversation headers.",
      documentTitle: type === "Telcon" ? "Memorandum of a Telephone Conversation" : "Memorandum of Conversation",
      subjectLine: title,
      dateLine: date.raw || date.iso,
      sourceNote: `Source: George H.W. Bush Library, Brent Scowcroft Papers, Presidential Correspondence Files, ${folder.title}, ${folder.localIdentifier}, NAID ${folder.naid}, source pages ${start + 1}-${end}.`
    });
  }

  return records;
}

function mergeRecords(existing, additions) {
  const byId = new Map(existing.filter((record) => !String(record.id).startsWith("scowcroft-")).map((record) => [record.id, record]));
  for (const record of additions) byId.set(record.id, record);
  return [...byId.values()].sort(
    (a, b) => a.chapter.number - b.chapter.number || a.sortDate.localeCompare(b.sortDate) || a.title.localeCompare(b.title)
  );
}

function main() {
  const existing = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const additions = [];
  const folderReports = [];

  for (const folder of SCOWCROFT_FOLDERS) {
    const sourcePath = download(folder);
    const sidecarPath = ocr(folder, sourcePath);
    const records = buildRecordsForFolder(folder, sourcePath, sidecarPath);
    additions.push(...records);
    folderReports.push({
      naid: folder.naid,
      title: folder.title,
      extractedRecords: records.map((record) => ({
        id: record.id,
        date: record.date,
        type: record.type,
        title: record.title,
        chapter: record.chapter.name,
        pdfUrl: record.pdfUrl
      }))
    });
  }

  const merged = mergeRecords(existing, additions);
  const json = JSON.stringify(merged, null, 2);
  fs.writeFileSync(dataPath, `${json}\n`);
  fs.writeFileSync(dataScriptPath, `window.MEMCONS = ${json};\n`);
  ensureDir(path.dirname(reportPath));
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceCollection: SOURCE_COLLECTION,
        sourceFolders: SCOWCROFT_FOLDERS,
        addedRecords: additions.length,
        folderReports
      },
      null,
      2
    )}\n`
  );
  console.log(`Merged ${additions.length} Scowcroft South America head-of-state records.`);
}

main();
