import { Settings, SETTINGS_DEFAULTS, SETTINGS_KEY } from "../models/settings.model";
import { has, image, str } from "../utils/validate";

/** Singleton: se crea con defaults la primera vez que alguien lo pide. */
export async function getSettings() {
  const doc = await Settings.findOneAndUpdate(
    { key: SETTINGS_KEY },
    { $setOnInsert: { key: SETTINGS_KEY } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  // Documentos creados antes de los usos de terreno: .lean() no aplica defaults.
  if (doc && !Array.isArray(doc.landUses)) doc.landUses = [...SETTINGS_DEFAULTS.landUses];
  if (doc && !Array.isArray(doc.priceRanges)) {
    doc.priceRanges = SETTINGS_DEFAULTS.priceRanges.map((r) => ({ ...r }));
  }
  return doc;
}

function section(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function popularSearches(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const v = section(item);
      const label = str(v.label, 80);
      if (!label) return null;
      const query: Record<string, string> = {};
      for (const [k, val] of Object.entries(section(v.query))) {
        const key = str(k, 30);
        const text = str(val, 100);
        if (key && text && /^[a-zA-Z]+$/.test(key)) query[key] = text;
      }
      return { label, query };
    })
    .filter((v): v is { label: string; query: Record<string, string> } => v !== null)
    .slice(0, 20);
}

// Íconos permitidos en las cifras de Inicio (el front tiene el mismo catálogo).
const STAT_ICONS = [
  "casa",
  "departamento",
  "terreno",
  "propiedades",
  "proyectos",
  "llave",
  "premio",
  "clientes",
];

function stats(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const v = section(item);
      const icon = str(v.icon, 20);
      return {
        icon: STAT_ICONS.includes(icon) ? icon : "propiedades",
        label: str(v.label, 60),
        value: str(v.value, 30),
      };
    })
    .filter((s) => s.label && s.value)
    .slice(0, 8);
}

function landUses(value: unknown) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .map((v) => str(v, 40))
    .filter((v) => v && !seen.has(v.toLowerCase()) && seen.add(v.toLowerCase()))
    .slice(0, 12);
}

function priceRanges(value: unknown) {
  if (!Array.isArray(value)) return [];
  const bound = (v: unknown) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  return value
    .map((item) => ({ min: bound(section(item).min), max: bound(section(item).max) }))
    .filter(
      (r) =>
        (r.min !== null || r.max !== null) && (r.min === null || r.max === null || r.min < r.max),
    )
    .sort((a, b) => (a.min ?? 0) - (b.min ?? 0))
    .slice(0, 8);
}

/** Actualiza por secciones: lo que no viene en el body queda como estaba. */
export async function updateSettings(body: Record<string, any>) {
  await getSettings();
  const set: Record<string, unknown> = {};

  if (has(body, "hero")) {
    const h = section(body.hero);
    for (const k of ["title", "subtitle", "ctaLabel", "ctaLink"] as const) {
      if (has(h, k)) set[`hero.${k}`] = str(h[k], 300);
    }
    if (has(h, "image")) set["hero.image"] = image(h.image);
  }
  if (has(body, "popularSearches")) set.popularSearches = popularSearches(body.popularSearches);
  if (has(body, "about")) {
    const a = section(body.about);
    if (has(a, "title")) set["about.title"] = str(a.title, 200);
    if (has(a, "text")) set["about.text"] = str(a.text, 10000);
    if (has(a, "image")) set["about.image"] = image(a.image);
  }
  if (has(body, "stats")) set.stats = stats(body.stats);
  if (has(body, "landUses")) set.landUses = landUses(body.landUses);
  if (has(body, "priceRanges")) set.priceRanges = priceRanges(body.priceRanges);
  if (has(body, "contact")) {
    const c = section(body.contact);
    for (const k of Object.keys(SETTINGS_DEFAULTS.contact)) {
      if (has(c, k)) set[`contact.${k}`] = str(c[k], 300);
    }
    if (typeof set["contact.whatsapp"] === "string") {
      set["contact.whatsapp"] = (set["contact.whatsapp"] as string).replace(/\D/g, "");
    }
  }
  if (has(body, "sellCta")) {
    const s = section(body.sellCta);
    if (has(s, "title")) set["sellCta.title"] = str(s.title, 200);
    if (has(s, "text")) set["sellCta.text"] = str(s.text, 2000);
  }

  return Settings.findOneAndUpdate({ key: SETTINGS_KEY }, { $set: set }, { new: true }).lean();
}
