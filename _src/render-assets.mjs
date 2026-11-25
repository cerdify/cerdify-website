// Renders the binary assets with headless Chrome:
//   assets/og-cerdify.png                    from _src/og.html (1200 x 630 link preview)
//   assets/cerdify-mark-512.png              from _src/partials/mark.svg (logo for structured data)
//   resources/month-end-close-checklist.pdf  from the built checklist page
//
//   node _src/serve.mjs &               (the PDF is printed from the local preview)
//   node _src/render-assets.mjs [http://localhost:8787]
//
// Set CHROME to the browser path if it isn't in the default Windows location.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";

const SRC = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(SRC);
const base = process.argv[2] ?? "http://localhost:8787";
const chrome = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
// A fresh profile each run, so no cached font or page from an earlier run is used.
const profile = mkdtempSync(join(tmpdir(), "cerdify-render-"));

function run(args) {
  execFileSync(chrome, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", `--user-data-dir=${profile}`, ...args], { stdio: "inherit" });
}

mkdirSync(join(ROOT, "assets"), { recursive: true });

run(["--window-size=1200,630", "--virtual-time-budget=3000", `--screenshot=${join(ROOT, "assets/og-cerdify.png")}`, pathToFileURL(join(SRC, "og.html")).href]);

const markPage = join(tmpdir(), "cerdify-mark-512.html");
const svg = readFileSync(join(SRC, "partials/mark.svg"), "utf8").replace("<svg ", '<svg width="512" height="512" ');
writeFileSync(markPage, `<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`);
run(["--window-size=512,512", "--default-background-color=00000000", `--screenshot=${join(ROOT, "assets/cerdify-mark-512.png")}`, pathToFileURL(markPage).href]);
rmSync(markPage);

run(["--no-pdf-header-footer", "--run-all-compositor-stages-before-draw", "--virtual-time-budget=10000", `--print-to-pdf=${join(ROOT, "resources/month-end-close-checklist.pdf")}`, `${base}/resources/month-end-close-checklist`]);
rmSync(profile, { recursive: true, force: true });
console.log("assets rendered");
