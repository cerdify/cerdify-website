// Local preview that serves the repository root the way GitHub Pages does:
// /how-it-works -> how-it-works.html, /resources/ -> resources/index.html,
// unknown paths -> 404.html with status 404.
//
//   node _src/serve.mjs [port]     (default 8787)

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const port = Number(process.argv[2] ?? 8787);
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8", ".pdf": "application/pdf", ".json": "application/json" };

async function isFile(p) { try { return (await stat(p)).isFile(); } catch { return false; } }

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (path.split("/").some((s) => s.startsWith("_") || s.startsWith("."))) return send(res, 404, join(ROOT, "404.html"));
  const base = normalize(join(ROOT, path));
  if (!base.startsWith(ROOT)) return send(res, 404, join(ROOT, "404.html"));
  for (const c of path.endsWith("/") ? [join(base, "index.html")] : [base, base + ".html"]) {
    if (await isFile(c)) return send(res, 200, c);
  }
  if (await isFile(join(base, "index.html"))) { res.writeHead(301, { Location: path + "/" }); return res.end(); }
  send(res, 404, join(ROOT, "404.html"));
}).listen(port, () => console.log(`http://localhost:${port}/`));

async function send(res, status, file) {
  res.writeHead(status, { "Content-Type": types[extname(file)] ?? "application/octet-stream", "Cache-Control": "max-age=600" });
  res.end(await readFile(file));
}
