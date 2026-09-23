/**
 * Extrae el contenido del WordPress actual de G3i (Elementor + JetEngine)
 * leyendo el HTML público, porque la REST API está bloqueada por Solid Security.
 *
 * Uso:
 *   pnpm scrape:wp                 → recorre los sitemaps y escribe data/wp-export.json
 *   pnpm scrape:wp --renormalize   → sin red: recalcula los campos normalizados desde
 *                                    los bloques `raw` del JSON (tras ajustar mapping.ts)
 *
 * El JSON se commitea: es el respaldo de la migración aunque el WordPress desaparezca.
 */
import axios from "axios";
import * as cheerio from "cheerio";
// domhandler no es dependencia directa: el tipo de nodo se toma de lo que devuelve cheerio.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Nodes = cheerio.Cheerio<any>;
import fs from "fs";
import path from "path";
import {
  WpPropertyType,
  deliveryDatesFrom,
  fold,
  mapAmenities,
  normalizeSector,
  normalizeTitle,
  parseBathrooms,
  parseCoordinates,
  parseNumber,
  parsePositive,
  parsePrice,
  projectStageFrom,
  projectTypesFrom,
  propertyConditionFrom,
  propertyTypeFrom,
  stripEmojis,
} from "./mapping";

const SITE = "https://g3i.ec";
const OUT_FILE = path.join(__dirname, "data", "wp-export.json");
const DELAY_MS = 400;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const PROPERTY_SITEMAPS: { file: string; type: WpPropertyType }[] = [
  { file: "casas-g3i-sitemap.xml", type: "casa" },
  { file: "departamentos-g3i-sitemap.xml", type: "departamento" },
  { file: "terrenos-g3i-sitemap.xml", type: "terreno" },
];
const PROJECT_SITEMAP = "proyect-g3i-sitemap.xml";
const TESTIMONIAL_SITEMAP = "testimonios-sitemap.xml";
const ADVISOR_SITEMAP = "vendedores_g3i-sitemap.xml";
const POST_SITEMAP = "post-sitemap.xml";
// Páginas donde JetEngine pinta el listado de testimonios (el detalle viene vacío).
const TESTIMONIAL_LISTING_PAGES = [`${SITE}/`, `${SITE}/testimonios/`];

// ---------------------------------------------------------------------------
// Tipos del export
// ---------------------------------------------------------------------------

export interface LatLngOrNull {
  lat: number | null;
  lng: number | null;
}

export interface RawProperty {
  sitemapType: WpPropertyType;
  title: string;
  price: string;
  transaction: string;
  sectorTerms: string[];
  /** Valores tal cual, indexados por el ícono Font Awesome que los acompaña en la ficha. */
  fields: Record<string, string>;
  descriptionText: string;
  features: string[];
  mapQuery: string;
}

export interface WpPropertyExport {
  wpUrl: string;
  wpId: number | null;
  publishedAt: string | null;
  modifiedAt: string | null;
  type: WpPropertyType;
  title: string;
  originalTitle: string;
  price: number | null;
  sector: string | null;
  sectorRaw: string;
  condition: string;
  totalM2: number | null;
  builtM2: number | null;
  gardenM2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  halfBathrooms: number | null;
  parking: number | null;
  frontMeters: number | null;
  description: string;
  features: string[];
  amenities: string[];
  unmatchedFeatures: string[];
  location: LatLngOrNull;
  address: string;
  images: string[];
  videos: string[];
  warnings: string[];
  raw: RawProperty;
}

export interface RawProject {
  title: string;
  priceFrom: string;
  stageTerm: string;
  sectorTerms: string[];
  fields: Record<string, string>;
  descriptionText: string;
  features: string[];
  mapQuery: string;
}

export interface WpUnitExport {
  name: string;
  type: WpPropertyType;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  storageRooms: number | null;
  builtM2: number | null;
  price: number | null;
  description: string;
}

export interface WpProjectExport {
  wpUrl: string;
  wpId: number | null;
  publishedAt: string | null;
  modifiedAt: string | null;
  title: string;
  originalTitle: string;
  stage: string;
  propertyTypes: WpPropertyType[];
  sector: string | null;
  sectorRaw: string;
  priceFrom: number | null;
  deliveryDate: string;
  deliveryDates: string[];
  totalUnits: number | null;
  description: string;
  features: string[];
  amenities: string[];
  unmatchedFeatures: string[];
  location: LatLngOrNull;
  address: string;
  images: string[];
  videos: string[];
  brochure: string | null;
  units: WpUnitExport[];
  warnings: string[];
  raw: RawProject;
}

export interface WpTestimonialExport {
  wpUrl: string;
  wpId: number | null;
  name: string;
  text: string;
  context: string;
  photo: string | null;
}

export interface WpAdvisorExport {
  wpUrl: string;
  wpId: number | null;
  name: string;
  photo: string | null;
  bio: string;
}

export interface WpPostExport {
  wpUrl: string;
  wpId: number | null;
  title: string;
  originalTitle: string;
  excerpt: string;
  content: string;
  cover: string | null;
  publishedAt: string | null;
}

export interface WpExport {
  scrapedAt: string;
  source: string;
  counts: Record<string, number>;
  properties: WpPropertyExport[];
  projects: WpProjectExport[];
  testimonials: WpTestimonialExport[];
  advisors: WpAdvisorExport[];
  posts: WpPostExport[];
  report: {
    unmatchedSectors: { wpUrl: string; sector: string }[];
    unmatchedFeatures: Record<string, number>;
    missingCoordinates: string[];
    brokenImages: string[];
    warnings: { wpUrl: string; warning: string }[];
  };
}

// ---------------------------------------------------------------------------
// Red
// ---------------------------------------------------------------------------

const http = axios.create({
  timeout: 30000,
  headers: { "User-Agent": USER_AGENT, "Accept-Language": "es-EC,es;q=0.9" },
  maxRedirects: 5,
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url: string): Promise<string> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await sleep(DELAY_MS);
      const res = await http.get<string>(url, { responseType: "text" });
      return res.data;
    } catch (error) {
      if (attempt === 3) throw error;
      await sleep(1500 * attempt);
    }
  }
  throw new Error(`No se pudo descargar ${url}`);
}

const imageCheckCache = new Map<string, boolean>();

/** El sitio tiene imágenes destacadas que devuelven 404 (HTML): se verifican una por una. */
async function isLiveImage(url: string): Promise<boolean> {
  const cached = imageCheckCache.get(url);
  if (cached !== undefined) return cached;
  let ok = false;
  try {
    await sleep(DELAY_MS);
    const res = await http.head(url, { validateStatus: () => true });
    ok = res.status === 200 && /^image\//.test(String(res.headers["content-type"] || ""));
    if (res.status === 405) {
      const get = await http.get(url, {
        headers: { Range: "bytes=0-0" },
        validateStatus: () => true,
        responseType: "arraybuffer",
      });
      ok = [200, 206].includes(get.status) && /^image\//.test(String(get.headers["content-type"] || ""));
    }
  } catch {
    ok = false;
  }
  imageCheckCache.set(url, ok);
  return ok;
}

async function readSitemap(file: string): Promise<string[]> {
  const xml = await fetchText(`${SITE}/${file}`);
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  return urls.filter((u) => !/wp-content\/uploads/.test(u));
}

/** La primera URL de cada sitemap de CPT es el archivo del listado (ej. /casas/). */
function isArchiveUrl(url: string): boolean {
  const pathname = new URL(url).pathname.replace(/\/+$/, "");
  return pathname.split("/").filter(Boolean).length <= 1;
}

// ---------------------------------------------------------------------------
// Helpers de HTML
// ---------------------------------------------------------------------------

type Doc = cheerio.CheerioAPI;

function loadPage(html: string): Doc {
  const $ = cheerio.load(html);
  // "Otras propiedades" repite fichas de otros inmuebles con los mismos widgets:
  // si no se quita, sus precios y títulos se mezclan con los de la página.
  $("[data-widget_type^='jet-listing-grid']").remove();
  $("[data-widget_type^='template']").remove();
  return $;
}

function clean(text: string): string {
  return text.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

function metaContent($: Doc, prop: string): string | null {
  return $(`meta[property='${prop}']`).attr("content") || $(`meta[name='${prop}']`).attr("content") || null;
}

function wpIdOf($: Doc): number | null {
  const bodyClass = $("body").attr("class") || "";
  const m = bodyClass.match(/postid-(\d+)/) || ($("main").attr("class") || "").match(/post-(\d+)/);
  return m ? Number(m[1]) : null;
}

/** Nombre original de una imagen de WordPress: sin sufijo de miniatura "-450x306". */
function originalImageUrl(url: string): string {
  return url.replace(/-\d{2,4}x\d{2,4}(\.(?:png|jpe?g|webp|gif))$/i, "$1").replace(/^http:/, "https:");
}

function isContentImage(url: string): boolean {
  if (!/\/wp-content\/uploads\/\d{4}\/\d{2}\//.test(url)) return false;
  if (/elementor\/thumbs|cropped-|\/g3i-1\.|G3I-LOGO|favicon/i.test(url)) return false;
  return /\.(png|jpe?g|webp|gif)$/i.test(url);
}

/** Clave para detectar la misma foto con distinto tamaño ("-scaled", "-1024x1024"). */
function imageKey(url: string): string {
  return originalImageUrl(url).replace(/-scaled(\.\w+)$/i, "$1").toLowerCase();
}

/**
 * HTML de WordPress → texto con párrafos separados por "\n\n" y listas "- ".
 * `markdown` conserva negritas, enlaces y subtítulos (para el blog).
 */
function htmlToText($: Doc, root: Nodes, markdown = false): string {
  const el = root.clone();
  el.find("script, style, svg, .social-link-content").remove();
  // Los saltos de línea del código fuente no significan nada en HTML: sin esto,
  // cada "<br />\n" del editor de WordPress se convierte en un párrafo nuevo.
  const collapse = (nodes: Nodes) => {
    nodes.contents().each((_, node) => {
      if (node.type === "text") node.data = node.data.replace(/\s+/g, " ");
      else collapse($(node));
    });
  };
  collapse(el);
  el.find("br").replaceWith("\n");
  if (markdown) {
    el.find("strong, b").each((_, n) => {
      const t = $(n).text();
      if (t.trim()) $(n).replaceWith(`**${t.trim()}**${/\s$/.test(t) ? " " : ""}`);
    });
    el.find("a[href]").each((_, n) => {
      const t = $(n).text().trim();
      const href = $(n).attr("href") || "";
      if (t && /^https?:/.test(href)) $(n).replaceWith(`[${t}](${href})`);
    });
    el.find("h1, h2, h3, h4, h5, h6").each((_, n) => {
      $(n).replaceWith(`\n\n## ${clean($(n).text())}\n\n`);
    });
  } else {
    el.find("h1, h2, h3, h4, h5, h6").each((_, n) => {
      $(n).replaceWith(`\n\n${clean($(n).text())}\n\n`);
    });
  }
  el.find("ol").each((_, ol) => {
    $(ol)
      .children("li")
      .each((i, li) => {
        $(li).replaceWith(`\n${i + 1}. ${$(li).text().trim()}\n`);
      });
  });
  el.find("li").each((_, li) => {
    $(li).replaceWith(`\n- ${$(li).text().trim()}\n`);
  });
  el.find("p, div, ul, ol, blockquote").each((_, n) => {
    $(n).prepend("\n\n").append("\n\n");
  });
  const text = el
    .text()
    .replace(/ /g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  // Las listas quedan separadas por líneas en blanco: se compactan para que lean como lista.
  return text.replace(/(^|\n)((?:- |\d+\. ).+)\n\n(?=(?:- |\d+\. ))/g, "$1$2\n").replace(
    /(^|\n)((?:- |\d+\. ).+)\n\n(?=(?:- |\d+\. ))/g,
    "$1$2\n",
  );
}

/** Valores de la ficha indexados por el ícono que los acompaña (e-fas-bed → "bed"). */
function iconFields($: Doc): Record<string, string> {
  const fields: Record<string, string> = {};
  $("[data-widget_type^='jet-listing-dynamic-field']").each((_, el) => {
    const text = clean($(el).text());
    if (!text || text.length > 60) return;
    const section = $(el).closest("section.elementor-inner-section");
    const icon = section
      .find("svg[class*='e-fa']")
      .toArray()
      .map((s) => ($(s).attr("class") || "").match(/e-fa[srb]-([\w-]+)/)?.[1])
      .find((name) => name && name !== "check-circle");
    if (icon && !(icon in fields)) fields[icon] = text;
  });
  return fields;
}

function firstPriceField($: Doc): string {
  let price = "";
  $("[data-widget_type^='jet-listing-dynamic-field']").each((_, el) => {
    const text = clean($(el).text());
    if (!price && /\$\s*\d/.test(text) && text.length < 40) price = text;
  });
  return price;
}

function terms($: Doc, taxonomy: RegExp): string[] {
  const out: string[] = [];
  $("a.jet-listing-dynamic-terms__link").each((_, a) => {
    if (taxonomy.test($(a).attr("href") || "")) {
      const t = clean($(a).text());
      if (t && !out.includes(t)) out.push(t);
    }
  });
  return out;
}

function descriptionNode($: Doc): Nodes | null {
  let found: Nodes | null = null;
  $("[data-widget_type^='jet-listing-dynamic-field'] .jet-listing-dynamic-field__content").each((_, el) => {
    if (found) return;
    const node = $(el);
    if (node.find(".jet-check-list").length) return;
    if (node.find("p, ul, ol, h1, h2, h3, h4, h5, h6").length || clean(node.text()).length > 120) found = node;
  });
  return found;
}

function featureList($: Doc): string[] {
  const list = $(".jet-check-list").first();
  return list
    .find(".jet-check-list__item-content")
    .toArray()
    .map((n) => clean($(n).text()))
    .filter(Boolean);
}

function mapQueryOf($: Doc): string {
  const src = $("iframe[src*='google.com/maps'], iframe[data-src*='google.com/maps']").first();
  const url = src.attr("src") || src.attr("data-src") || "";
  if (!url) return "";
  try {
    return new URL(url.replace(/&#0?38;/g, "&")).searchParams.get("q") || "";
  } catch {
    return decodeURIComponent((url.match(/[?&]q=([^&]+)/) || [])[1] || "");
  }
}

function youtubeUrls(html: string): string[] {
  const ids = new Set<string>();
  for (const m of html.matchAll(/(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/g)) {
    ids.add(m[1]);
  }
  return [...ids].map((id) => `https://www.youtube.com/watch?v=${id}`);
}

function pdfUrls(html: string): string[] {
  return [...new Set([...html.matchAll(/https?:\/\/g3i\.ec\/wp-content\/uploads\/[^"'\s<>]+\.pdf/gi)].map((m) => m[0]))];
}

/** Destacada primero, luego la galería en su orden; sin duplicados ni imágenes rotas. */
async function collectImages($: Doc, brokenImages: string[]): Promise<string[]> {
  const candidates: string[] = [];
  const og = metaContent($, "og:image");
  if (og) candidates.push(og);
  $("[data-widget_type^='gallery']")
    .first()
    .find("a[href]")
    .each((_, a) => {
      candidates.push($(a).attr("href") || "");
    });

  const seen = new Set<string>();
  const out: string[] = [];
  for (const candidate of candidates) {
    if (!candidate || !isContentImage(candidate)) continue;
    const key = imageKey(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    const original = originalImageUrl(candidate);
    if (await isLiveImage(original)) out.push(original);
    else if (original !== candidate && (await isLiveImage(candidate))) out.push(candidate);
    else brokenImages.push(candidate);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Normalización (se reusa con --renormalize)
// ---------------------------------------------------------------------------

function dropRepeatedTitle(description: string, originalTitle: string): string {
  const paragraphs = description.split("\n\n");
  const norm = (s: string) => fold(stripEmojis(s)).replace(/[^\p{L}\d]+/gu, "");
  if (paragraphs.length > 1 && norm(paragraphs[0]) === norm(originalTitle)) paragraphs.shift();
  return paragraphs.join("\n\n").trim();
}

/** Montos en USD que aparecen en un texto (para detectar precios desactualizados). */
function pricesMentioned(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/(?:\$|usd)\s*\$?\s*(\d{2,3}[.,]\d{3}(?:[.,]\d{1,2})?|\d{5,7})/gi)) {
    const value = parsePrice(m[1]);
    if (value && value >= 10000) out.push(value);
  }
  return out;
}

function normalizeProperty(
  base: Pick<WpPropertyExport, "wpUrl" | "wpId" | "publishedAt" | "modifiedAt" | "images" | "videos">,
  raw: RawProperty,
): WpPropertyExport {
  const warnings: string[] = [];
  const type = propertyTypeFrom(raw.sitemapType, raw.title);
  const title = normalizeTitle(raw.title);
  const description = dropRepeatedTitle(raw.descriptionText, raw.title);
  const sector = normalizeSector(raw.sectorTerms);
  const price = parsePrice(raw.price);
  const f = raw.fields;
  const baths = parseBathrooms(f["bath"]);
  const area = parsePositive(f["ruler-combined"]);
  const amenities = mapAmenities(raw.features, description, "property");
  const coords = raw.mapQuery ? parseCoordinates(raw.mapQuery) : null;

  if (!sector.slug) warnings.push(`sector sin equivalencia en el catálogo: "${sector.raw}"`);
  if (raw.sectorTerms.length > 1) warnings.push(`varios sectores en WordPress (${sector.raw}); se eligió ${sector.slug}`);
  if (!price) warnings.push("sin precio");
  if (!base.images.length) warnings.push("sin imágenes");
  if (raw.mapQuery && !coords) warnings.push(`ubicación sin coordenadas legibles: "${raw.mapQuery}"`);
  if (!raw.mapQuery) warnings.push("sin mapa de ubicación");
  if (raw.transaction && fold(raw.transaction) !== "venta") warnings.push(`transacción "${raw.transaction}"`);
  const mentioned = pricesMentioned(description);
  // ±1 es redondeo de centavos ("$147.707,90" vs el campo "$ 147.707").
  if (price && mentioned.length && !mentioned.some((m) => Math.abs(m - price) <= 1)) {
    warnings.push(`la descripción menciona ${mentioned.map((p) => `$${p}`).join(", ")} y el precio es $${price}`);
  }
  if (new Set(mentioned.map((m) => Math.round(m / 10))).size > 1) {
    warnings.push("la descripción menciona varios precios (¿varias unidades en una ficha?)");
  }

  return {
    ...base,
    type,
    title,
    originalTitle: raw.title,
    price,
    sector: sector.slug,
    sectorRaw: sector.raw,
    condition: propertyConditionFrom(type, raw.title, description),
    // En terrenos el área de la ficha es el lote; en casas y departamentos, la construcción.
    totalM2: type === "terreno" ? area : null,
    builtM2: type === "terreno" ? null : area,
    gardenM2: type === "terreno" ? null : parsePositive(f["tree"]),
    bedrooms: type === "terreno" ? null : parsePositive(f["bed"]),
    bathrooms: type === "terreno" ? null : baths.bathrooms,
    halfBathrooms: type === "terreno" ? null : baths.halfBathrooms,
    parking: type === "terreno" ? null : parsePositive(f["car"]),
    frontMeters: type === "terreno" ? parsePositive(f["ruler-horizontal"]) : null,
    description,
    features: raw.features,
    amenities: amenities.keys,
    unmatchedFeatures: amenities.unmatched,
    location: { lat: coords?.lat ?? null, lng: coords?.lng ?? null },
    address: coords ? "" : raw.mapQuery,
    warnings,
    raw,
  };
}

/**
 * Inventario explícito en la descripción ("Casa 1 / 4 🛏️ | 3.5 🛁 | 201 m² … 3 🚗 | 1 🗄️ | Precio: $558.921").
 * Las líneas "Suites desde $X" son tipologías, no unidades, y no se convierten.
 */
function unitsFromDescription(description: string, types: WpPropertyType[]): WpUnitExport[] {
  const units: WpUnitExport[] = [];
  const re =
    /(casa|departamento|dpto|suite)\s+([\w-]{1,4})\s*\n\s*(\d+)\s*🛏️?\s*\|\s*([\d.,]+)\s*🛁\s*\|\s*([\d.,]+)\s*m²([^\n]*)\n?\s*(\d+)\s*🚗\s*\|\s*(\d+)\s*🗄️?\s*\|\s*precio:?\s*\$?\s*([\d.,]+)/giu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(description))) {
    const kind = fold(m[1]);
    const type: WpPropertyType = kind === "casa" ? "casa" : kind === "suite" ? "suite" : "departamento";
    // Unit no tiene medios baños: se conserva el decimal ("3.5") tal cual lo publica el sitio.
    const baths = parsePositive(m[4]);
    const extra = clean(stripEmojis(m[6].replace(/^\s*\+\s*/, "")));
    units.push({
      name: `${m[1].charAt(0).toUpperCase()}${m[1].slice(1).toLowerCase()} ${m[2]}`,
      type: types.includes(type) || !types.length ? type : types[0],
      bedrooms: parsePositive(m[3]),
      bathrooms: baths,
      parking: parsePositive(m[7]),
      storageRooms: parsePositive(m[8]),
      builtM2: parsePositive(m[5]),
      price: parsePrice(m[9]),
      description: extra ? `Incluye ${extra}.` : "",
    });
  }
  return units;
}

function normalizeProject(
  base: Pick<WpProjectExport, "wpUrl" | "wpId" | "publishedAt" | "modifiedAt" | "images" | "videos" | "brochure">,
  raw: RawProject,
): WpProjectExport {
  const warnings: string[] = [];
  const description = dropRepeatedTitle(raw.descriptionText, raw.title);
  const sector = normalizeSector(raw.sectorTerms);
  const typeInfo = projectTypesFrom(raw.fields["cubes"] || "", raw.title, description);
  const stage = projectStageFrom(raw.stageTerm);
  const amenities = mapAmenities(raw.features, description, "project");
  const coords = raw.mapQuery ? parseCoordinates(raw.mapQuery) : null;
  const dates = deliveryDatesFrom(description);
  const units = unitsFromDescription(description, typeInfo.types);

  if (!sector.slug) warnings.push(`sector sin equivalencia en el catálogo: "${sector.raw}"`);
  if (typeInfo.conflict) {
    warnings.push(`el campo "tipo" dice "${raw.fields["cubes"]}" pero el título dice otra cosa; se usó ${typeInfo.types.join(", ")}`);
  }
  if (!stage) warnings.push(`etapa no reconocida: "${raw.stageTerm}"`);
  if (!base.images.length) warnings.push("sin imágenes");
  if (!coords) warnings.push(raw.mapQuery ? `ubicación sin coordenadas legibles: "${raw.mapQuery}"` : "sin mapa de ubicación");
  if (dates.length > 1) warnings.push(`varias fechas de entrega (${dates.join(", ")}); se tomó la primera`);

  return {
    ...base,
    title: normalizeTitle(raw.title),
    originalTitle: raw.title,
    stage,
    propertyTypes: typeInfo.types,
    sector: sector.slug,
    sectorRaw: sector.raw,
    priceFrom: parsePrice(raw.priceFrom),
    deliveryDate: dates[0] ?? "",
    deliveryDates: dates,
    totalUnits: parsePositive(raw.fields["home"]),
    description,
    features: raw.features,
    amenities: amenities.keys,
    unmatchedFeatures: amenities.unmatched,
    location: { lat: coords?.lat ?? null, lng: coords?.lng ?? null },
    address: coords ? "" : raw.mapQuery,
    units,
    warnings,
    raw,
  };
}

// ---------------------------------------------------------------------------
// Scrapers por tipo
// ---------------------------------------------------------------------------

async function scrapeProperty(url: string, sitemapType: WpPropertyType, brokenImages: string[]) {
  const html = await fetchText(url);
  const $ = loadPage(html);
  const descNode = descriptionNode($);
  const raw: RawProperty = {
    sitemapType,
    title: clean($("h1").first().text()) || clean(metaContent($, "og:title") || "").replace(/\s*-\s*G3I$/i, ""),
    price: firstPriceField($),
    transaction: terms($, /posicin-propiedades|posicion-propiedades/)[0] || "",
    sectorTerms: terms($, /sectores_tax/),
    fields: iconFields($),
    descriptionText: descNode ? htmlToText($, descNode) : "",
    features: featureList($),
    mapQuery: mapQueryOf($),
  };
  const images = await collectImages($, brokenImages);
  return normalizeProperty(
    {
      wpUrl: url,
      wpId: wpIdOf($),
      publishedAt: metaContent($, "article:published_time"),
      modifiedAt: metaContent($, "article:modified_time"),
      images,
      videos: youtubeUrls(html),
    },
    raw,
  );
}

async function scrapeProject(url: string, brokenImages: string[]) {
  const html = await fetchText(url);
  const $ = loadPage(html);
  const descNode = descriptionNode($);
  const raw: RawProject = {
    title: clean($("h1").first().text()),
    priceFrom: firstPriceField($),
    stageTerm: terms($, /posicion-proyectos/)[0] || "",
    sectorTerms: terms($, /sectores_tax/),
    fields: iconFields($),
    descriptionText: descNode ? htmlToText($, descNode) : "",
    features: featureList($),
    mapQuery: mapQueryOf($),
  };
  const images = await collectImages($, brokenImages);
  return normalizeProject(
    {
      wpUrl: url,
      wpId: wpIdOf($),
      publishedAt: metaContent($, "article:published_time"),
      modifiedAt: metaContent($, "article:modified_time"),
      images,
      videos: youtubeUrls(html),
      brochure: pdfUrls(html)[0] ?? null,
    },
    raw,
  );
}

async function scrapeTestimonials(urls: string[]): Promise<WpTestimonialExport[]> {
  // El detalle solo trae el título; el texto vive en el listado de JetEngine, que se cruza por id.
  const byId = new Map<number, { url: string; title: string }>();
  for (const url of urls) {
    const $ = loadPage(await fetchText(url));
    const id = wpIdOf($);
    if (id) byId.set(id, { url, title: clean($("h1").first().text()) });
  }

  const found = new Map<number, WpTestimonialExport>();
  for (const page of TESTIMONIAL_LISTING_PAGES) {
    const $ = cheerio.load(await fetchText(page));
    $(".jet-listing-grid__item").each((_, item) => {
      const id = Number($(item).attr("data-post-id"));
      if (!byId.has(id) || found.has(id)) return;
      const values = $(item)
        .find("[data-widget_type^='jet-listing-dynamic-field']")
        .toArray()
        .map((n) => clean($(n).text()))
        .filter(Boolean);
      const img = $(item)
        .find("img")
        .toArray()
        .map((n) => $(n).attr("src") || "")
        .find(isContentImage);
      const meta = byId.get(id)!;
      found.set(id, {
        wpUrl: meta.url,
        wpId: id,
        text: values[0] ?? "",
        name: values[1] ?? meta.title,
        context: values[2] ?? "",
        photo: img ? originalImageUrl(img) : null,
      });
    });
  }

  const out: WpTestimonialExport[] = [];
  for (const [id, meta] of byId) {
    const t = found.get(id);
    if (t) {
      if (t.photo && !(await isLiveImage(t.photo))) t.photo = null;
      out.push(t);
    } else {
      out.push({ wpUrl: meta.url, wpId: id, name: meta.title, text: "", context: "", photo: null });
    }
  }
  return out;
}

async function scrapeAdvisor(url: string): Promise<WpAdvisorExport> {
  const $ = loadPage(await fetchText(url));
  const og = metaContent($, "og:image");
  let photo: string | null = null;
  if (og && isContentImage(og)) {
    const original = originalImageUrl(og);
    if (await isLiveImage(original)) photo = original;
    else if (await isLiveImage(og)) photo = og;
  }
  return {
    wpUrl: url,
    wpId: wpIdOf($),
    name: clean($("h1").first().text()),
    photo,
    bio: htmlToText($, $(".page-content").first()),
  };
}

async function scrapePost(url: string): Promise<WpPostExport> {
  const $ = loadPage(await fetchText(url));
  const originalTitle = clean($("h1").first().text());
  const content = htmlToText($, $(".page-content").first(), true);
  const og = metaContent($, "og:image");
  let cover: string | null = null;
  if (og && isContentImage(og) && (await isLiveImage(originalImageUrl(og)))) cover = originalImageUrl(og);
  const metaDescription = metaContent($, "og:description") || metaContent($, "description") || "";
  const firstParagraph = content.split("\n\n").find((p) => !p.startsWith("#") && p.length > 40) || "";
  const excerptBase = clean(metaDescription || firstParagraph.replace(/\*\*/g, ""));
  return {
    wpUrl: url,
    wpId: wpIdOf($),
    title: normalizeTitle(originalTitle),
    originalTitle,
    excerpt: excerptBase.length > 240 ? `${excerptBase.slice(0, 237).replace(/\s+\S*$/, "")}…` : excerptBase,
    content,
    cover,
    publishedAt: metaContent($, "article:published_time"),
  };
}

// ---------------------------------------------------------------------------
// Reporte
// ---------------------------------------------------------------------------

function buildReport(data: Omit<WpExport, "report" | "counts" | "scrapedAt" | "source">, brokenImages: string[]) {
  const unmatchedFeatures: Record<string, number> = {};
  const warnings: { wpUrl: string; warning: string }[] = [];
  const unmatchedSectors: { wpUrl: string; sector: string }[] = [];
  const missingCoordinates: string[] = [];
  for (const item of [...data.properties, ...data.projects]) {
    for (const f of item.unmatchedFeatures) unmatchedFeatures[f] = (unmatchedFeatures[f] || 0) + 1;
    for (const w of item.warnings) warnings.push({ wpUrl: item.wpUrl, warning: w });
    if (!item.sector) unmatchedSectors.push({ wpUrl: item.wpUrl, sector: item.sectorRaw });
    if (item.location.lat === null) missingCoordinates.push(item.wpUrl);
  }
  return {
    unmatchedSectors,
    unmatchedFeatures,
    missingCoordinates,
    brokenImages: [...new Set(brokenImages)],
    warnings,
  };
}

function countsOf(data: Pick<WpExport, "properties" | "projects" | "testimonials" | "advisors" | "posts">) {
  const counts: Record<string, number> = {
    properties: data.properties.length,
    projects: data.projects.length,
    units: data.projects.reduce((n, p) => n + p.units.length, 0),
    testimonials: data.testimonials.length,
    advisors: data.advisors.length,
    posts: data.posts.length,
    withCoordinates: [...data.properties, ...data.projects].filter((i) => i.location.lat !== null).length,
  };
  for (const p of data.properties) counts[`type:${p.type}`] = (counts[`type:${p.type}`] || 0) + 1;
  return counts;
}

function writeExport(data: WpExport) {
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function printSummary(data: WpExport) {
  console.log("\nResumen:", data.counts);
  if (data.report.unmatchedSectors.length) {
    console.log("Sectores sin mapear:", data.report.unmatchedSectors.map((s) => s.sector).join(", "));
  }
  console.log("Características descartadas:", data.report.unmatchedFeatures);
  if (data.report.brokenImages.length) console.log("Imágenes rotas:", data.report.brokenImages);
  console.log(`Avisos: ${data.report.warnings.length} (ver report.warnings en el JSON)`);
  console.log(`✔ Export escrito en ${path.relative(process.cwd(), OUT_FILE)}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function renormalize() {
  if (!fs.existsSync(OUT_FILE)) throw new Error(`No existe ${OUT_FILE}; corre primero el scrape completo`);
  const data = JSON.parse(fs.readFileSync(OUT_FILE, "utf8")) as WpExport;
  data.properties = data.properties.map((p) => normalizeProperty(p, p.raw));
  data.projects = data.projects.map((p) => normalizeProject(p, p.raw));
  data.posts = data.posts.map((p) => ({ ...p, title: normalizeTitle(p.originalTitle) }));
  data.counts = countsOf(data);
  data.report = buildReport(data, data.report.brokenImages);
  writeExport(data);
  printSummary(data);
}

async function scrapeAll() {
  const brokenImages: string[] = [];
  const properties: WpPropertyExport[] = [];
  for (const { file, type } of PROPERTY_SITEMAPS) {
    const urls = (await readSitemap(file)).filter((u) => !isArchiveUrl(u));
    console.log(`${file}: ${urls.length} fichas`);
    for (const url of urls) {
      const p = await scrapeProperty(url, type, brokenImages);
      console.log(`  · [${p.type}] ${p.title} — $${p.price ?? "?"} — ${p.images.length} fotos`);
      properties.push(p);
    }
  }

  const projects: WpProjectExport[] = [];
  const projectUrls = (await readSitemap(PROJECT_SITEMAP)).filter((u) => !isArchiveUrl(u));
  console.log(`${PROJECT_SITEMAP}: ${projectUrls.length} proyectos`);
  for (const url of projectUrls) {
    const p = await scrapeProject(url, brokenImages);
    console.log(`  · ${p.title} — desde $${p.priceFrom ?? "?"} — ${p.images.length} renders, ${p.units.length} unidades`);
    projects.push(p);
  }

  const testimonialUrls = (await readSitemap(TESTIMONIAL_SITEMAP)).filter((u) => !isArchiveUrl(u));
  const testimonials = await scrapeTestimonials(testimonialUrls);
  console.log(`Testimonios: ${testimonials.length}`);

  const advisors: WpAdvisorExport[] = [];
  for (const url of (await readSitemap(ADVISOR_SITEMAP)).filter((u) => !isArchiveUrl(u))) {
    advisors.push(await scrapeAdvisor(url));
  }
  console.log(`Asesores: ${advisors.length}`);

  const posts: WpPostExport[] = [];
  // En el sitemap de posts no hay archivo: cada URL de un solo segmento es un artículo.
  for (const url of (await readSitemap(POST_SITEMAP)).filter((u) => new URL(u).pathname !== "/")) {
    posts.push(await scrapePost(url));
  }
  console.log(`Posts: ${posts.length}`);

  const body = { properties, projects, testimonials, advisors, posts };
  const data: WpExport = {
    scrapedAt: new Date().toISOString(),
    source: SITE,
    counts: countsOf(body),
    ...body,
    report: buildReport(body, brokenImages),
  };
  writeExport(data);
  printSummary(data);
}

const main = process.argv.includes("--renormalize") ? async () => renormalize() : scrapeAll;

main().catch((error) => {
  console.error("✖ Falló el scrape:", error);
  process.exit(1);
});
