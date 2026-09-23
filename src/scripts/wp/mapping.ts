/**
 * Normalización pura de los datos crudos del WordPress de G3i.
 *
 * Sin I/O: todo lo que scrape.ts e import.ts necesitan interpretar (números con
 * formatos mezclados, sectores, amenities, títulos en mayúsculas, coordenadas)
 * vive acá para poder revisarlo y ajustarlo en un solo lugar.
 */
import { AMENITIES, AmenityItem, SECTORS } from "../../config/catalogs";

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

/** Minúsculas sin tildes: la base para comparar lo que escribió cada editor. */
export function fold(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const EMOJI_RE = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}\u{1F3FB}-\u{1F3FF}]/gu;

export function stripEmojis(input: string): string {
  return input.replace(EMOJI_RE, "").replace(/[ \t]{2,}/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Números
// ---------------------------------------------------------------------------

/**
 * Interpreta "1.234,5", "1,234.5", "222,3", "53.08", "255.874" o "$147.707,90".
 * Con un solo separador seguido de exactamente 3 dígitos se asume miles
 * (así escriben los precios en el sitio); con 1-2 dígitos, decimal.
 */
export function parseNumber(input: string | null | undefined): number | null {
  if (!input) return null;
  const match = String(input).match(/\d[\d.,]*/);
  if (!match) return null;
  let token = match[0].replace(/[.,]+$/, "");
  const lastDot = token.lastIndexOf(".");
  const lastComma = token.lastIndexOf(",");

  if (lastDot !== -1 && lastComma !== -1) {
    const decimalSep = lastDot > lastComma ? "." : ",";
    const thousandSep = decimalSep === "." ? "," : ".";
    token = token.split(thousandSep).join("").replace(decimalSep, ".");
  } else if (lastDot !== -1 || lastComma !== -1) {
    const sep = lastDot !== -1 ? "." : ",";
    const parts = token.split(sep);
    const tail = parts[parts.length - 1];
    if (parts.length > 2 || tail.length === 3) {
      token = parts.join("");
    } else {
      token = parts.join(".");
    }
  }
  const value = Number(token);
  return Number.isFinite(value) ? value : null;
}

/** Precio en USD enteros; 0 o ilegible → null. */
export function parsePrice(input: string | null | undefined): number | null {
  const value = parseNumber(input);
  if (value === null || value <= 0) return null;
  return Math.round(value);
}

/** Áreas y conteos: 0 no aporta nada en la UI, así que se guarda como null. */
export function parsePositive(input: string | null | undefined): number | null {
  const value = parseNumber(input);
  if (value === null || value <= 0) return null;
  return Math.round(value * 100) / 100;
}

/** "4.5" / "3,5" → 4 baños completos + 1 medio baño. */
export function parseBathrooms(input: string | null | undefined): {
  bathrooms: number | null;
  halfBathrooms: number | null;
} {
  const value = parseNumber(input);
  if (value === null || value <= 0) return { bathrooms: null, halfBathrooms: null };
  const full = Math.floor(value);
  const half = value - full >= 0.5 ? 1 : 0;
  return { bathrooms: full || null, halfBathrooms: half || null };
}

// ---------------------------------------------------------------------------
// Sectores
// ---------------------------------------------------------------------------

const SECTOR_ALIASES: Record<string, string> = {
  cumbaya: "cumbaya",
  cumbay: "cumbaya",
  tumbaco: "tumbaco",
  nayon: "nayon",
  miravalle: "miravalle",
  puembo: "puembo",
  pifo: "pifo",
  "san patricio": "san-patricio",
  "ciudad san patricio": "san-patricio",
  lumbisi: "lumbisi",
  "ruta viva": "ruta-viva",
};

// Cuando WordPress trae varios términos, el más específico describe mejor la ubicación.
const GENERIC_SECTORS = new Set(["cumbaya", "tumbaco"]);

export interface SectorResult {
  slug: string | null;
  raw: string;
}

/** Recibe uno o varios términos ("Cumbayá, Lumbisi") y devuelve el slug del catálogo. */
export function normalizeSector(rawTerms: string | string[]): SectorResult {
  const terms = (Array.isArray(rawTerms) ? rawTerms : rawTerms.split(","))
    .map((t) => t.trim())
    .filter(Boolean);
  const raw = terms.join(", ");
  const slugs = terms.map((t) => SECTOR_ALIASES[fold(t)]).filter(Boolean) as string[];
  if (!slugs.length) return { slug: null, raw };
  const specific = slugs.find((s) => !GENERIC_SECTORS.has(s));
  return { slug: specific ?? slugs[0], raw };
}

export function sectorLabelOf(slug: string): string {
  return SECTORS.find((s) => s.key === slug)?.label ?? slug;
}

// ---------------------------------------------------------------------------
// Tipos y etapas
// ---------------------------------------------------------------------------

export type WpPropertyType = "casa" | "departamento" | "terreno" | "suite";

/** El sitemap define el tipo; "suite" solo se distingue por el título. */
export function propertyTypeFrom(sitemapType: WpPropertyType, title: string): WpPropertyType {
  if (sitemapType === "departamento" && /\bsuites?\b/i.test(fold(title))) return "suite";
  return sitemapType;
}

/** Término "posicion-proyectos" de WordPress → stage del contrato. */
export function projectStageFrom(termSlugOrLabel: string): "en-planos" | "en-construccion" | "por-estrenar" | "" {
  const t = fold(termSlugOrLabel);
  if (/planos/.test(t)) return "en-planos";
  if (/construccion|obra/.test(t)) return "en-construccion";
  if (/finalizado|estrenar|terminado/.test(t)) return "por-estrenar";
  return "";
}

/**
 * Qué vende un proyecto: el campo "tipo" de JetEngine más lo que diga el título.
 * El campo está mal cargado en algunos proyectos (dice "Casas" y vende
 * departamentos), por eso manda el título cuando lo contradice.
 */
export function projectTypesFrom(field: string, title: string, description: string): {
  types: WpPropertyType[];
  conflict: boolean;
} {
  const f = fold(field);
  const t = fold(title);
  const d = fold(description);
  const fromField = new Set<WpPropertyType>();
  if (/casa/.test(f)) fromField.add("casa");
  if (/depar|depto/.test(f)) fromField.add("departamento");
  if (/terreno|lote/.test(f)) fromField.add("terreno");
  if (/suite/.test(f)) fromField.add("suite");

  const fromTitle = new Set<WpPropertyType>();
  if (/\bcasas?\b/.test(t)) fromTitle.add("casa");
  if (/departamento|\bdepto|\bdptos?\b/.test(t)) fromTitle.add("departamento");
  if (/\bsuites?\b|\bestudios?\b/.test(t)) fromTitle.add("suite");
  if (/\bsuites?\b|\bestudios?\b/.test(d) && (fromField.has("departamento") || fromTitle.has("departamento"))) {
    fromTitle.add("suite");
  }

  // Solo es contradicción si cambia la familia (casa vs. departamento/suite vs. terreno):
  // "Departamentos" con título "estudios y suites" es la misma familia y se suman.
  const family = (x: WpPropertyType) => (x === "suite" ? "departamento" : x);
  const titleFamilies = new Set([...fromTitle].map(family));
  const conflict = titleFamilies.size > 0 && [...fromField].some((x) => !titleFamilies.has(family(x)));
  const types = conflict ? [...fromTitle] : [...new Set([...fromField, ...fromTitle])];
  const order: WpPropertyType[] = ["casa", "departamento", "suite", "terreno"];
  types.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return { types, conflict };
}

const MONTHS: Record<string, string> = {
  ene: "Enero",
  feb: "Febrero",
  mar: "Marzo",
  abr: "Abril",
  may: "Mayo",
  jun: "Junio",
  jul: "Julio",
  ago: "Agosto",
  sep: "Septiembre",
  set: "Septiembre",
  oct: "Octubre",
  nov: "Noviembre",
  dic: "Diciembre",
};

/** Todas las fechas "Entrega: noviembre 2026" / "entrega dic. 2027" en orden de aparición. */
export function deliveryDatesFrom(text: string): string[] {
  const out: string[] = [];
  const re =
    /entrega(?:\s+inmediata)?[\s:–-]*(?:en\s+)?(ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic)[a-záéíóú]*\.?\s*(?:de\s+|del\s+)?(20\d\d)/gi;
  const folded = fold(text);
  let m: RegExpExecArray | null;
  while ((m = re.exec(folded))) {
    const value = `${MONTHS[m[1].toLowerCase()]} ${m[2]}`;
    if (!out.includes(value)) out.push(value);
  }
  // "2 torres con entrega Diciembre 2026 y Diciembre 2027": la segunda fecha no lleva "entrega".
  const pair = folded.match(
    /entrega\s+(ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic)[a-z]*\.?\s*(20\d\d)\s+y\s+(ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic)[a-z]*\.?\s*(20\d\d)/,
  );
  if (pair) {
    const second = `${MONTHS[pair[3]]} ${pair[4]}`;
    if (!out.includes(second)) out.push(second);
  }
  return out;
}

/**
 * Etapa de una propiedad (reventa). WordPress no tiene el campo: se deduce del
 * texto y, si no hay señales claras, se deja vacío para que el admin lo decida.
 */
export function propertyConditionFrom(
  type: WpPropertyType,
  title: string,
  description: string,
  currentYear = new Date().getFullYear(),
): "en-planos" | "en-construccion" | "a-estrenar" | "usada" | "" {
  if (type === "terreno") return "";
  const text = fold(`${title} ${description}`);
  if (/\ben planos\b|preventa|prelanzamiento/.test(text)) return "en-planos";
  const dates = deliveryDatesFrom(`${title} ${description}`);
  if (dates.some((d) => Number(d.slice(-4)) >= currentYear)) return "en-construccion";
  // "Estrenar" solo cuenta en el título: en descripciones aparece como "baños listos para estrenar".
  if (/estrenar|\bnuev[oa]\b/.test(fold(title)) || /listo para entrega|entrega inmediata/.test(text)) {
    return "a-estrenar";
  }
  return "";
}

// ---------------------------------------------------------------------------
// Amenities
// ---------------------------------------------------------------------------

/**
 * Características de JetEngine → keys del catálogo. `null` = se descarta a
 * propósito (servicios básicos que no son amenity o sin equivalente).
 */
const FEATURE_MAP: Record<string, string | null> = {
  luz: null,
  agua: null,
  telefono: null,
  electricidad: null,
  alcantarillado: null,
  chimenea: null,
  pergola: null,
  "walking closet": null,
  "parqueadero de visitas": "parqueadero-visitas",
  bodega: "bodega",
  jardin: "jardin",
  bbq: "area-bbq",
  piscina: "piscina",
  "seguridad privada": "guardiania",
  seguridad: "guardiania",
  "video seguridad": "guardiania",
  "sistema de alarma": "guardiania",
  vista: "vista",
  "casa comunal": "sala-comunal",
  "areas infantiles": "areas-infantiles",
  "conjunto privado": "urbanizacion-privada",
  gimnasio: "gimnasio",
  sauna: "sauna",
  turco: "turco",
  hidromasaje: "jacuzzi",
  terraza: "terraza",
  ascensor: "ascensor",
  balcon: "balcon",
};

/** Menciones inequívocas en la descripción que la lista de características no trae. */
const DESCRIPTION_HINTS: [RegExp, string][] = [
  [/\bpiscina\b/, "piscina"],
  [/\bjacuzzi\b|hidromasaje/, "jacuzzi"],
  [/\bsauna\b/, "sauna"],
  [/\bturco\b/, "turco"],
  [/\bgimnasio\b|\bgym\b/, "gimnasio"],
  [/\bbbq\b/, "area-bbq"],
  [/co-?work/, "coworking"],
  [/pet (?:friendly|zone|station)|zona pet|area pet/, "pet-friendly"],
  [/rooftop/, "rooftop"],
  [/padel/, "cancha-padel"],
  [/areas? humedas?/, "zonas-humedas"],
  [/\blobby\b/, "lobby"],
  [/areas? verdes?/, "areas-verdes"],
  [/guardiania|seguridad 24|doble filtro de seguridad|triple filtro/, "guardiania"],
  [/generador electrico/, "generador-electrico"],
  [/\bascensor\b/, "ascensor"],
  [/kids? (?:club|zone)|juegos infantiles|areas? infantil/, "areas-infantiles"],
  [/urbanizacion privada|conjunto privado/, "urbanizacion-privada"],
  [/sala comunal|salon comunal/, "sala-comunal"],
  [/ubicacion estrategica/, "ubicacion-estrategica"],
  [/\bcisterna\b/, "cisterna"],
  [/canchas? de (?:futbol|tenis|basket|volley)|area deportiva/, "area-deportiva"],
  [/salon de eventos|area de eventos/, "area-eventos"],
  [/parque (?:privado|interno)/, "parque-interno"],
  [/frente (?:a|al) parque/, "frente-parque"],
  [/\bbalcon\b/, "balcon"],
  [/sala de estar/, "sala-estar"],
  [/(?:espectacular|hermosa|excelente|maravillosa) vista|vista (?:panoramica|espectacular|privilegiada)/, "vista"],
];

function allowedFor(scope: "property" | "project"): Map<string, AmenityItem> {
  return new Map(
    AMENITIES.filter((a) => a.scope === "both" || a.scope === scope).map((a) => [a.key, a]),
  );
}

export interface AmenityResult {
  keys: string[];
  unmatched: string[];
}

export function mapAmenities(
  rawFeatures: string[],
  description: string,
  scope: "property" | "project",
): AmenityResult {
  const allowed = allowedFor(scope);
  const keys = new Set<string>();
  const unmatched: string[] = [];

  const push = (key: string) => {
    // En proyectos la "casa comunal" es el salón comunal del catálogo de proyectos.
    const k = scope === "project" && key === "sala-comunal" ? "salon-comunal" : key;
    if (allowed.has(k)) keys.add(k);
  };

  for (const raw of rawFeatures) {
    const f = fold(raw);
    if (!f) continue;
    if (f in FEATURE_MAP) {
      const key = FEATURE_MAP[f];
      if (key) push(key);
      else unmatched.push(raw);
    } else {
      unmatched.push(raw);
    }
  }

  const text = fold(description);
  for (const [re, key] of DESCRIPTION_HINTS) {
    if (re.test(text)) push(key);
  }

  const order = AMENITIES.map((a) => a.key);
  return {
    keys: [...keys].sort((a, b) => order.indexOf(a) - order.indexOf(b)),
    unmatched: [...new Set(unmatched)],
  };
}

// ---------------------------------------------------------------------------
// Títulos
// ---------------------------------------------------------------------------

/**
 * Nombres propios que deben conservar mayúscula (y tilde) al pasar a oración.
 * Los más largos primero para que "Ciudad San Patricio" gane a "San Patricio".
 */
const PROPER_NOUNS = [
  "Ciudad San Patricio",
  "Colegio Menor San Francisco",
  "Colegio Menor",
  "Pakakuna Gardens",
  "La Viña Alta",
  "Real Alto",
  "Auki Plaza",
  "San Patricio",
  "Ruta Viva",
  "Pacho Salas",
  "Pachosalas",
  "La Primavera",
  "Intervalles",
  "Auquichico",
  "Cumbayá",
  "Tumbaco",
  "Nayón",
  "Miravalle",
  "Puembo",
  "Pifo",
  "Lumbisí",
  "Quito",
  "Ecuador",
  "Checa",
  "Livadi",
  "Kentia",
  "Éclat",
  "USFQ",
  "TV",
  "USD",
].sort((a, b) => b.length - a.length);

const ACCENT_CLASS: Record<string, string> = {
  a: "[aá]",
  e: "[eé]",
  i: "[ií]",
  o: "[oó]",
  u: "[uúü]",
  n: "[nñ]",
};

function accentInsensitive(word: string): string {
  return fold(word)
    .split("")
    .map((ch) => ACCENT_CLASS[ch] ?? ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("");
}

const PROPER_NOUN_RES = PROPER_NOUNS.map(
  (noun) => [new RegExp(`(?<![\\p{L}\\d])${accentInsensitive(noun)}(?![\\p{L}])`, "giu"), noun] as const,
);

/** Errores de tipeo vistos en los títulos del sitio. */
const TITLE_FIXES: [RegExp, string][] = [
  [/\bcumbay(?![a-záà])/gi, "Cumbayá"],
  [/\bestrategica\b/gi, "estratégica"],
  [/\b(\d+)\s*dorm\b\.?/gi, "$1 dormitorios"],
  [/\bsala\s*tv\b\.?/gi, "sala de TV"],
];

const ABBREVIATIONS = new Set([
  "urb",
  "dorm",
  "hab",
  "av",
  "sr",
  "sra",
  "dpto",
  "depto",
  "ene",
  "feb",
  "mar",
  "abr",
  "jun",
  "jul",
  "ago",
  "sep",
  "sept",
  "oct",
  "nov",
  "dic",
]);

/** Quita "$255.874", "Desde $136646", "Desde USD 75,262" y variantes. */
export function stripPriceFromTitle(title: string): string {
  return title
    .replace(/[,.]?\s*desde\s+(?:usd\s*)?\$?\s*\d[\d.,]*(?:\s*usd)?/gi, "")
    .replace(/[,.]?\s*(?:usd\s*)?\$\s*\d[\d.,]*(?:\s*usd)?/gi, "")
    .replace(/[,.]?\s*usd\s*\d[\d.,]*/gi, "");
}

/**
 * Título en oración en español: sin emojis, sin precio, sin MAYÚSCULAS
 * sostenidas ni "Title Case", con los sectores y nombres propios bien escritos.
 */
export function normalizeTitle(original: string): string {
  let t = stripEmojis(original);
  t = stripPriceFromTitle(t);
  t = t.replace(/\s*\|\s*/g, ", ");
  for (const [re, rep] of TITLE_FIXES) t = t.replace(re, rep);
  t = t
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/,\s*,/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Minúsculas en todo salvo siglas cortas (m², TV); los nombres propios se reponen abajo.
  t = t.replace(/[\p{L}\d²]+/gu, (word) => {
    if (/^[A-ZÁÉÍÓÚÑ]{2,4}$/.test(word) && /^(USD|TV|USFQ|SEK)$/.test(word)) return word;
    return word.toLowerCase();
  });
  for (const [re, noun] of PROPER_NOUN_RES) t = t.replace(re, noun);

  // Tras un punto de fin de oración va mayúscula; tras "urb." o "dorm." no.
  t = t.replace(/([\p{L}\d²]+)([.!?])\s+(\p{Ll})/gu, (all, prev: string, punct: string, next: string) =>
    ABBREVIATIONS.has(prev.toLowerCase()) ? all : `${prev}${punct} ${next.toUpperCase()}`,
  );

  t = t.replace(/^[\s,.;:–-]+|[\s,.;:–-]+$/g, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ---------------------------------------------------------------------------
// Resumen
// ---------------------------------------------------------------------------

/** Primer párrafo con sustancia, cortado en palabra completa a ≤ max caracteres. */
export function summaryFrom(description: string, max = 220): string {
  const paragraphs = description
    .split(/\n+/)
    .map((p) => stripEmojis(p.replace(/^[-•]\s*/, "")).trim())
    .filter((p) => p.length >= 40);
  const base = (paragraphs[0] ?? stripEmojis(description)).replace(/\s+/g, " ").trim();
  if (base.length <= max) return base;
  const cut = base.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 120 ? lastSpace : cut.length).replace(/[\s,;:.–-]+$/, "")}…`;
}

// ---------------------------------------------------------------------------
// Coordenadas
// ---------------------------------------------------------------------------

export interface LatLng {
  lat: number;
  lng: number;
}

// Referencia para recuperar plus codes cortos ("QHJ6+27 Quito").
const QUITO: LatLng = { lat: -0.2, lng: -78.5 };
const OLC_ALPHABET = "23456789CFGHJMPQRVWX";

function olcEncodePrefix(lat: number, lng: number, pairs: number): string {
  let la = lat + 90;
  let ln = lng + 180;
  let code = "";
  let res = 20;
  for (let i = 0; i < pairs; i++) {
    const a = Math.floor(la / res);
    const b = Math.floor(ln / res);
    code += OLC_ALPHABET[a] + OLC_ALPHABET[b];
    la -= a * res;
    ln -= b * res;
    res /= 20;
  }
  return code;
}

function olcDecodeCenter(full: string): LatLng | null {
  const clean = full.replace("+", "").toUpperCase();
  if (clean.length < 10 || [...clean].some((c) => !OLC_ALPHABET.includes(c))) return null;
  let lat = 0;
  let lng = 0;
  let res = 20;
  for (let i = 0; i < 10; i += 2) {
    lat += OLC_ALPHABET.indexOf(clean[i]) * res;
    lng += OLC_ALPHABET.indexOf(clean[i + 1]) * res;
    if (i < 8) res /= 20;
  }
  return { lat: lat - 90 + res / 2, lng: lng - 180 + res / 2 };
}

/** Decodifica un plus code corto de 4+2 dígitos usando Quito como referencia. */
export function decodeShortPlusCode(code: string, ref: LatLng = QUITO): LatLng | null {
  const m = code.toUpperCase().match(/\b([23456789CFGHJMPQRVWX]{4})\+([23456789CFGHJMPQRVWX]{2})\b/);
  if (!m) return null;
  const full = `${olcEncodePrefix(ref.lat, ref.lng, 2)}${m[1]}+${m[2]}`;
  const center = olcDecodeCenter(full);
  if (!center) return null;
  // Igual que recoverNearest de Open Location Code: corrige si cae a más de media celda.
  const resolution = 1;
  if (ref.lat + resolution / 2 < center.lat) center.lat -= resolution;
  else if (ref.lat - resolution / 2 > center.lat) center.lat += resolution;
  if (ref.lng + resolution / 2 < center.lng) center.lng -= resolution;
  else if (ref.lng - resolution / 2 > center.lng) center.lng += resolution;
  return { lat: round6(center.lat), lng: round6(center.lng) };
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * Interpreta el parámetro `q` del iframe de Google Maps: decimal
 * ("-0.21, -78.41"), grados-minutos-segundos (0°12'43.1"S 78°26'27.2"W) o
 * plus code corto. Descarta cualquier cosa fuera del valle de Quito.
 */
export function parseCoordinates(q: string): LatLng | null {
  const text = q.replace(/\s+/g, " ").trim();
  let result: LatLng | null = null;

  const dec = text.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (dec) result = { lat: Number(dec[1]), lng: Number(dec[2]) };

  if (!result) {
    const dms = text.match(
      /(\d{1,2})°\s*(\d{1,2})['′]\s*([\d.]+)["″]?\s*([NS])\s*,?\s*(\d{1,3})°\s*(\d{1,2})['′]\s*([\d.]+)["″]?\s*([EW])/i,
    );
    if (dms) {
      const lat = Number(dms[1]) + Number(dms[2]) / 60 + Number(dms[3]) / 3600;
      const lng = Number(dms[5]) + Number(dms[6]) / 60 + Number(dms[7]) / 3600;
      result = {
        lat: round6(/s/i.test(dms[4]) ? -lat : lat),
        lng: round6(/w/i.test(dms[8]) ? -lng : lng),
      };
    }
  }

  if (!result) result = decodeShortPlusCode(text);
  if (!result) return null;
  const inValley = result.lat > -0.5 && result.lat < 0.2 && result.lng > -78.7 && result.lng < -78.1;
  return inValley ? result : null;
}
