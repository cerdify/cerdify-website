// Builds cerdify.com from _src/ into the repository root.
//
//   node _src/build.mjs          write the pages, sitemap.xml and robots.txt
//   node _src/build.mjs --check  fail if any generated file is out of date
//
// No dependencies. GitHub Pages (Jekyll) skips folders that start with "_",
// so nothing in _src/ is published. The generated files are committed.
//
// Each page in _src/pages/ starts with a JSON block:
//   <!--page { "title": "...", "description": "...", ... } -->
// followed by the HTML that goes inside <main>.

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(SRC);
const check = process.argv.includes("--check");
const site = JSON.parse(readFileSync(join(SRC, "site.json"), "utf8"));
const ORIGIN = site.origin;

const read = (p) => readFileSync(join(SRC, p), "utf8");
const css = read("site.css").trim();
const mark = read("partials/mark.svg").trim();
const header = read("partials/header.html");
const footer = read("partials/footer.html");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const text = (html) => html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, "'").replace(/\s+/g, " ").trim();

const mailto = (() => {
  const b = site.betaRequest;
  return `mailto:${b.to}?subject=${encodeURIComponent(b.subject)}&body=${encodeURIComponent(b.body)}`;
})();

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".html") ? [p] : [];
  });
}

const pages = walk(join(SRC, "pages")).map((file) => {
  const raw = readFileSync(file, "utf8");
  const m = raw.match(/^<!--page\s*([\s\S]*?)-->\s*/);
  if (!m) throw new Error(`${file}: missing <!--page {...} --> header`);
  const meta = JSON.parse(m[1]);
  const rel = relative(join(SRC, "pages"), file).split(sep).join("/");
  const out = rel;
  let path = "/" + rel.replace(/\.html$/, "");
  if (path === "/index") path = "/";
  else if (path.endsWith("/index")) path = path.slice(0, -"index".length);
  return { file, out, path, meta, body: raw.slice(m[0].length) };
});

// Every page needs its own title and description.
const seen = new Map();
for (const p of pages) {
  for (const k of ["title", "description"]) {
    if (!p.meta[k]) throw new Error(`${p.out}: missing ${k}`);
    const key = k + ":" + p.meta[k];
    if (seen.has(key)) throw new Error(`${p.out}: same ${k} as ${seen.get(key)}`);
    seen.set(key, p.out);
  }
  if (p.meta.description.length > 180) throw new Error(`${p.out}: description is ${p.meta.description.length} characters (keep it under 180)`);
}

const ORG_ID = ORIGIN + "/#organization";
const organization = {
  "@type": "Organization",
  "@id": ORG_ID,
  name: site.legalName,
  legalName: site.legalName,
  alternateName: "Cerdify",
  url: ORIGIN + "/",
  logo: { "@type": "ImageObject", url: ORIGIN + "/assets/cerdify-mark-512.png", width: 512, height: 512 },
  email: site.email,
  address: { "@type": "PostalAddress", addressLocality: "Alpharetta", addressRegion: "GA", addressCountry: "US" },
  contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: site.email, availableLanguage: "en" },
};
const software = {
  "@type": "SoftwareApplication",
  "@id": ORIGIN + "/#software",
  name: "Cerdify",
  url: ORIGIN + "/",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Accounting",
  operatingSystem: "Web browser",
  description: "Month-end close review software for QuickBooks Online. Prepare, Diagnose, Support, Close and Report, then post approved correcting entries to QuickBooks Online and confirm they match.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free during the invitation-only beta" },
  publisher: { "@id": ORG_ID },
};

function faqFrom(body) {
  const items = [...body.matchAll(/<details[^>]*>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)];
  return items.map(([, q, a]) => ({ "@type": "Question", name: text(q), acceptedAnswer: { "@type": "Answer", text: text(a) } }));
}

function jsonLd(p, url) {
  const graph = [organization];
  if (p.path === "/") {
    graph.push({ "@type": "WebSite", "@id": ORIGIN + "/#website", url: ORIGIN + "/", name: "Cerdify", publisher: { "@id": ORG_ID } });
  }
  if (p.meta.software) graph.push(software);
  const page = {
    "@type": p.meta.article ? "Article" : "WebPage",
    "@id": url + "#page",
    url,
    name: p.meta.title,
    description: p.meta.description,
    isPartOf: { "@id": ORIGIN + "/#website" },
    publisher: { "@id": ORG_ID },
  };
  if (p.meta.article) {
    Object.assign(page, {
      headline: p.meta.h1 ?? p.meta.title,
      datePublished: p.meta.published,
      dateModified: p.meta.modified ?? p.meta.published,
      author: { "@id": ORG_ID },
      image: ORIGIN + site.ogImage.path,
      mainEntityOfPage: url,
    });
    delete page.name;
    delete page.isPartOf;
  }
  graph.push(page);
  if (p.meta.crumbs) {
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: p.meta.crumbs.map(([name, href], i) => ({ "@type": "ListItem", position: i + 1, name, item: ORIGIN + href })),
    });
  }
  const faq = faqFrom(p.body);
  if (faq.length) graph.push({ "@type": "FAQPage", "@id": url + "#faq", mainEntity: faq });
  // Escape "<" so that no string can close the script element.
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }, null, 1).replace(/</g, "\\u003c");
}

function crumbsHtml(crumbs) {
  if (!crumbs) return "";
  const items = crumbs.map(([name, href], i) =>
    i === crumbs.length - 1 ? `<li><span aria-current="page">${esc(name)}</span></li>` : `<li><a href="${href}">${esc(name)}</a></li>`);
  return `<nav class="crumbs" aria-label="Breadcrumb"><ol>${items.join("")}</ol></nav>`;
}

function fill(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (!(k in vars)) throw new Error(`unknown placeholder {{${k}}}`);
    return vars[k];
  });
}

function navHeader(p) {
  // Mark the current section in the header navigation.
  return header.replace(/<a href="([^"]+)"( data-nav="(\w+)")>/g, (all, href, _attr, key) =>
    `<a href="${href}"${p.meta.nav === key ? ' aria-current="page"' : ""}>`);
}

function render(p) {
  const url = ORIGIN + p.path;
  const vars = { mark, beta_mailto: esc(mailto), email: site.email, year: String(site.copyrightYear), legal_name: site.legalName };
  const verify = Object.entries(site.verification ?? {})
    .filter(([, v]) => v)
    .map(([k, v]) => `<meta name="${esc(k)}" content="${esc(v)}">`)
    .join("\n");
  const og = site.ogImage;
  const head = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${esc(p.meta.title)}</title>`,
    `<meta name="description" content="${esc(p.meta.description)}">`,
    p.meta.noindex ? `<meta name="robots" content="noindex">` : `<link rel="canonical" href="${url}">`,
    `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`,
    `<meta name="color-scheme" content="light dark">`,
    `<meta name="theme-color" content="#F5F7FA" media="(prefers-color-scheme: light)">`,
    `<meta name="theme-color" content="#101418" media="(prefers-color-scheme: dark)">`,
    `<meta property="og:type" content="${p.meta.article ? "article" : "website"}">`,
    `<meta property="og:site_name" content="Cerdify">`,
    `<meta property="og:locale" content="en_US">`,
    `<meta property="og:title" content="${esc(p.meta.ogTitle ?? p.meta.title)}">`,
    `<meta property="og:description" content="${esc(p.meta.description)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${ORIGIN}${og.path}">`,
    `<meta property="og:image:type" content="image/png">`,
    `<meta property="og:image:width" content="${og.width}">`,
    `<meta property="og:image:height" content="${og.height}">`,
    `<meta property="og:image:alt" content="${esc(og.alt)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(p.meta.ogTitle ?? p.meta.title)}">`,
    `<meta name="twitter:description" content="${esc(p.meta.description)}">`,
    `<meta name="twitter:image" content="${ORIGIN}${og.path}">`,
    `<meta name="twitter:image:alt" content="${esc(og.alt)}">`,
    verify,
    `<link rel="preload" href="/fonts/ibm-plex-sans-latin.woff2" as="font" type="font/woff2" crossorigin>`,
    `<style>\n${css}\n</style>`,
    p.meta.noindex ? "" : `<script type="application/ld+json">\n${jsonLd(p, url)}\n</script>`,
  ].filter(Boolean).join("\n");
  const body = fill(p.body.trim(), { ...vars, crumbs: crumbsHtml(p.meta.crumbs) });
  return `<!doctype html>
<html lang="en">
<head>
${head}
</head>
<body>
<a class="skip" href="#main">Skip to main content</a>
${fill(navHeader(p), vars).trim()}

<main id="main">
${body}
</main>

${fill(footer, vars).trim()}
</body>
</html>
`;
}

const outputs = new Map();
for (const p of pages) outputs.set(p.out, render(p));

const indexed = pages.filter((p) => !p.meta.noindex).sort((a, b) => a.path.localeCompare(b.path));
outputs.set("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexed.map((p) => `  <url><loc>${ORIGIN}${p.path}</loc><lastmod>${p.meta.modified ?? site.modified}</lastmod></url>`).join("\n")}
</urlset>
`);
outputs.set("robots.txt", `# cerdify.com
User-agent: *
Allow: /

Sitemap: ${ORIGIN}/sitemap.xml
`);

let stale = [];
for (const [out, content] of outputs) {
  const target = join(ROOT, out);
  const current = existsSync(target) ? readFileSync(target, "utf8") : null;
  if (current === content) continue;
  if (check) { stale.push(out); continue; }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
  console.log("wrote", out);
}
if (check && stale.length) {
  console.error("Out of date (run node _src/build.mjs):\n  " + stale.join("\n  "));
  process.exit(1);
}
console.log(`${outputs.size} files ${check ? "checked" : "up to date"}.`);
