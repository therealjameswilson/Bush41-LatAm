const fs = require("fs");
const https = require("https");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data", "memcons.json");
const CACHE_DIR = path.join("/private/tmp", "bush41-western-europe-pdfs");

function download(url, targetPath) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 0) {
      resolve();
      return;
    }

    const file = fs.createWriteStream(targetPath);
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          file.close();
          fs.rmSync(targetPath, { force: true });
          reject(new Error(`HTTP ${response.statusCode} for ${url}`));
          return;
        }

        response.pipe(file);
        file.on("finish", () => {
          file.close(resolve);
        });
      })
      .on("error", (error) => {
        file.close();
        fs.rmSync(targetPath, { force: true });
        reject(error);
      });
  });
}

function pageCount(pdfPath) {
  const output = execFileSync("pdfinfo", [pdfPath], { encoding: "utf8" });
  const match = output.match(/^Pages:\s+(\d+)/m);
  if (!match) {
    throw new Error(`Could not find page count in pdfinfo output for ${pdfPath}`);
  }
  return Number(match[1]);
}

function isRemoteUrl(url) {
  return /^https?:\/\//i.test(url);
}

async function main() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const records = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));

  for (const [index, record] of records.entries()) {
    if (!record.pdfUrl) {
      record.pageCount = null;
      continue;
    }

    const filename = `${record.naid || index}.pdf`;
    const targetPath = isRemoteUrl(record.pdfUrl)
      ? path.join(CACHE_DIR, filename)
      : path.join(ROOT, record.pdfUrl);
    if (isRemoteUrl(record.pdfUrl)) {
      await download(record.pdfUrl, targetPath);
    }
    record.pageCount = pageCount(targetPath) - (record.provenancePages || 0);
    console.log(`${String(index + 1).padStart(3, "0")}/${records.length} ${record.pageCount}p ${record.title}`);
  }

  fs.writeFileSync(DATA_PATH, `${JSON.stringify(records, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
