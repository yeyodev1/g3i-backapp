/**
 * Importa data/wp-export.json a Mongo con upserts idempotentes.
 *
 * Uso:
 *   pnpm migrate:wp                       → importa todo
 *   pnpm migrate:wp --dry-run             → solo informa qué crearía/actualizaría
 *   pnpm migrate:wp --only=properties     → properties | projects | content
 *
 * Re-ejecutarlo es seguro: se busca por source.wpUrl (propiedades y proyectos)
 * o por nombre/título (unidades, asesores, testimonios, posts). En un documento
 * existente se conservan código, slug, visitas, destacados, un estado "sold" o
 * "hidden" puesto por el admin y las imágenes ya subidas a Cloudinary.
 */
import "dotenv/config";
import fs from "fs";
import mongoose from "mongoose";
import path from "path";
import { dbConnect } from "../../config/mongo";
import { Advisor } from "../../models/advisor.model";
import { Post } from "../../models/post.model";
import { Project } from "../../models/project.model";
import { Property } from "../../models/property.model";
import { Testimonial } from "../../models/testimonial.model";
import { Unit } from "../../models/unit.model";
import { isCloudinaryConfigured, uploadImage } from "../../services/cloudinary.service";
import { slugify } from "../../utils/slugify";
import { summaryFrom } from "./mapping";
import type { WpExport, WpProjectExport, WpPropertyExport } from "./scrape";

const DATA_FILE = path.join(__dirname, "data", "wp-export.json");
const MAX_IMAGES = 25;

type Only = "properties" | "projects" | "content" | "all";
type Img = { url: string; publicId: string; alt: string };

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const ONLY = ((args.find((a) => a.startsWith("--only="))?.split("=")[1] ?? "all") as Only);
if (!["properties", "projects", "content", "all"].includes(ONLY)) {
  console.error(`✖ --only debe ser properties, projects o content (llegó "${ONLY}")`);
  process.exit(1);
}

const stats: Record<string, { created: number; updated: number }> = {};
function count(kind: string, created: boolean) {
  stats[kind] ??= { created: 0, updated: 0 };
  stats[kind][created ? "created" : "updated"]++;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** "G3I-0001": el siguiente número libre entre propiedades y proyectos (el refCode de un lead no debe ser ambiguo). */
async function makeCodeGenerator(): Promise<() => string> {
  const codes = [
    ...(await Property.find({ code: /^G3I-\d+$/ }).distinct("code")),
    ...(await Project.find({ code: /^G3I-\d+$/ }).distinct("code")),
  ] as string[];
  let next = codes.reduce((max, c) => Math.max(max, Number(c.slice(4))), 0) + 1;
  return () => `G3I-${String(next++).padStart(4, "0")}`;
}

async function freeSlug(model: mongoose.Model<any>, title: string, excludeId?: unknown): Promise<string> {
  const base = slugify(title).slice(0, 90).replace(/-+$/, "") || "item";
  let candidate = base;
  for (let n = 2; ; n++) {
    const filter: Record<string, unknown> = { slug: candidate };
    if (excludeId) filter._id = { $ne: excludeId };
    if (!(await model.exists(filter))) return candidate;
    candidate = `${base}-${n}`;
  }
}

const cloudinaryReady = isCloudinaryConfigured();

/** Sube a Cloudinary si está configurado; si no, deja la URL original para rehost-images.ts. */
async function toImages(urls: string[], folder: string, alt: string): Promise<Img[]> {
  const out: Img[] = [];
  for (const url of urls.slice(0, MAX_IMAGES)) {
    if (!cloudinaryReady || DRY_RUN) {
      out.push({ url, publicId: "", alt });
      continue;
    }
    try {
      const up = await uploadImage(url, folder);
      out.push({ url: up.url, publicId: up.publicId, alt });
    } catch (error) {
      console.warn(`  ! no se pudo subir ${url}: ${(error as Error).message}; queda la URL original`);
      out.push({ url, publicId: "", alt });
    }
  }
  return out;
}

function alreadyRehosted(images: { publicId?: string }[] | undefined): boolean {
  return !!images?.some((i) => i.publicId);
}

/** El admin puede haber marcado vendido/oculto: la migración no lo revive. */
function keepStatus(current: string | undefined, computed: string): string {
  return current && !["draft", "published"].includes(current) ? current : computed;
}

function sectorOf(item: { sector: string | null; sectorRaw: string }): string {
  // Sin equivalencia en el catálogo se guarda el texto como slug para que el admin lo vea y decida.
  return item.sector ?? slugify(item.sectorRaw);
}

function sentenceCase(text: string): string {
  const t = text.trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ---------------------------------------------------------------------------
// Propiedades
// ---------------------------------------------------------------------------

async function importProperties(items: WpPropertyExport[], nextCode: () => string) {
  const ordered = [...items].sort((a, b) => (a.publishedAt ?? "").localeCompare(b.publishedAt ?? ""));
  for (const p of ordered) {
    const existing = await Property.findOne({ "source.wpUrl": p.wpUrl });
    const slug = existing?.slug ?? (await freeSlug(Property, p.title));
    const status = p.price && p.images.length ? "published" : "draft";
    const images = alreadyRehosted(existing?.images)
      ? existing!.images
      : await toImages(p.images, `g3i/properties/${slug}`, p.title);

    const doc = {
      title: p.title,
      slug,
      summary: summaryFrom(p.description),
      description: p.description,
      type: p.type,
      transaction: "venta" as const,
      condition: p.condition,
      sector: sectorOf(p),
      city: "Quito",
      address: p.address,
      location: { lat: p.location.lat, lng: p.location.lng, exact: false, radiusMeters: 400 },
      price: p.price ?? 0,
      totalM2: p.totalM2,
      builtM2: p.builtM2,
      gardenM2: p.gardenM2,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      halfBathrooms: p.halfBathrooms,
      parking: p.parking,
      frontMeters: p.frontMeters,
      amenities: p.amenities,
      images,
      videos: p.videos.map((url) => ({ url, publicId: "" })),
      status: keepStatus(existing?.status, status),
      source: { wpUrl: p.wpUrl },
    };

    count("properties", !existing);
    console.log(`  ${existing ? "~" : "+"} [${p.type}] ${p.title} (${doc.status})`);
    if (DRY_RUN) continue;
    if (existing) {
      existing.set(doc);
      await existing.save();
    } else {
      await Property.create({ ...doc, code: nextCode() });
    }
  }
}

// ---------------------------------------------------------------------------
// Proyectos y unidades
// ---------------------------------------------------------------------------

async function importProjects(items: WpProjectExport[], nextCode: () => string) {
  const ordered = [...items].sort((a, b) => (a.publishedAt ?? "").localeCompare(b.publishedAt ?? ""));
  for (const p of ordered) {
    const existing = await Project.findOne({ "source.wpUrl": p.wpUrl });
    const slug = existing?.slug ?? (await freeSlug(Project, p.title));
    const status = p.priceFrom && p.images.length ? "published" : "draft";
    const images = alreadyRehosted(existing?.images)
      ? existing!.images
      : await toImages(p.images, `g3i/projects/${slug}`, p.title);

    const doc = {
      title: p.title,
      slug,
      summary: summaryFrom(p.description),
      description: p.description,
      stage: p.stage,
      propertyTypes: p.propertyTypes,
      sector: sectorOf(p),
      city: "Quito",
      address: p.address,
      // Un proyecto es público (tiene sala de ventas): su ubicación se muestra exacta.
      location: { lat: p.location.lat, lng: p.location.lng, exact: p.location.lat !== null, radiusMeters: 400 },
      priceFrom: p.priceFrom,
      deliveryDate: p.deliveryDate,
      totalUnits: p.totalUnits,
      amenities: p.amenities,
      images,
      videos: p.videos.map((url) => ({ url, publicId: "" })),
      brochure: p.brochure ? { url: p.brochure, publicId: "", name: "Brochure" } : existing?.brochure ?? null,
      status: keepStatus(existing?.status, status),
      source: { wpUrl: p.wpUrl },
    };

    count("projects", !existing);
    console.log(`  ${existing ? "~" : "+"} ${p.title} (${doc.status}, ${p.units.length} unidades)`);
    if (DRY_RUN) {
      for (const _ of p.units) count("units", true);
      continue;
    }

    let project = existing;
    if (project) {
      project.set(doc);
      await project.save();
    } else {
      project = await Project.create({ ...doc, code: nextCode() });
    }

    for (const [order, u] of p.units.entries()) {
      const current = await Unit.findOne({ project: project._id, name: u.name });
      const unitDoc = {
        project: project._id,
        name: u.name,
        type: u.type,
        bedrooms: u.bedrooms,
        bathrooms: u.bathrooms,
        parking: u.parking,
        storageRooms: u.storageRooms,
        builtM2: u.builtM2,
        price: u.price ?? 0,
        description: u.description,
        order,
      };
      count("units", !current);
      if (current) {
        current.set(unitDoc);
        await current.save();
      } else {
        await Unit.create({ ...unitDoc, status: "available" });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Contenido: testimonios, asesores, posts
// ---------------------------------------------------------------------------

async function importContent(data: WpExport) {
  for (const [order, t] of data.testimonials.entries()) {
    if (!t.text) {
      console.log(`  · testimonio "${t.name}" sin texto, se omite`);
      continue;
    }
    const existing = await Testimonial.findOne({ name: t.name });
    const photo = t.photo ? (await toImages([t.photo], "g3i/team", t.name))[0] : existing?.photo ?? null;
    const doc = { name: t.name, text: t.text, context: sentenceCase(t.context), photo, rating: 5, isActive: true };
    count("testimonials", !existing);
    console.log(`  ${existing ? "~" : "+"} testimonio: ${t.name}`);
    if (DRY_RUN) continue;
    if (existing) {
      existing.set(doc);
      await existing.save();
    } else {
      await Testimonial.create({ ...doc, order });
    }
  }

  for (const [order, a] of data.advisors.entries()) {
    const existing = await Advisor.findOne({ name: a.name });
    const photo = a.photo ? (await toImages([a.photo], "g3i/team", a.name))[0] : existing?.photo ?? null;
    const doc = {
      name: a.name,
      photo,
      bio: a.bio || existing?.bio || "",
      role: existing?.role || "Asesor inmobiliario",
      isActive: true,
    };
    count("advisors", !existing);
    console.log(`  ${existing ? "~" : "+"} asesor: ${a.name}`);
    if (DRY_RUN) continue;
    if (existing) {
      existing.set(doc);
      await existing.save();
    } else {
      await Advisor.create({ ...doc, order });
    }
  }

  for (const p of data.posts) {
    const existing = await Post.findOne({ title: p.title });
    const slug = existing?.slug ?? (await freeSlug(Post, p.title));
    const cover = p.cover ? (await toImages([p.cover], `g3i/posts/${slug}`, p.title))[0] : existing?.cover ?? null;
    const doc = {
      title: p.title,
      slug,
      excerpt: p.excerpt,
      content: p.content,
      cover,
      status: existing?.status ?? "published",
      publishedAt: p.publishedAt ? new Date(p.publishedAt) : new Date(),
    };
    count("posts", !existing);
    console.log(`  ${existing ? "~" : "+"} post: ${p.title}`);
    if (DRY_RUN) continue;
    if (existing) {
      existing.set(doc);
      await existing.save();
    } else {
      await Post.create(doc);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!fs.existsSync(DATA_FILE)) throw new Error(`No existe ${DATA_FILE}; corre primero pnpm scrape:wp`);
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) as WpExport;

  console.log(`Export del ${data.scrapedAt}${DRY_RUN ? " — DRY RUN, no se escribe nada" : ""}`);
  console.log(
    cloudinaryReady
      ? "Cloudinary configurado: las imágenes se suben al importar."
      : "Cloudinary no configurado: se guardan las URLs de g3i.ec (luego pnpm migrate:images).",
  );

  await dbConnect();
  const nextCode = await makeCodeGenerator();

  if (ONLY === "all" || ONLY === "properties") {
    console.log(`\nPropiedades (${data.properties.length})`);
    await importProperties(data.properties, nextCode);
  }
  if (ONLY === "all" || ONLY === "projects") {
    console.log(`\nProyectos (${data.projects.length})`);
    await importProjects(data.projects, nextCode);
  }
  if (ONLY === "all" || ONLY === "content") {
    console.log("\nContenido");
    await importContent(data);
  }

  console.log("\nResultado:", stats);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("✖ Falló la importación:", error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
