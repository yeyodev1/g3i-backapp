import { CustomError } from "../errors/customError.error";
import {
  AMENITY_KEYS,
  PROPERTY_CONDITION_KEYS,
  PROPERTY_STATUSES,
  PROPERTY_TYPE_KEYS,
  PropertyStatus,
  SECTOR_KEYS,
} from "../config/catalogs";
import { Property } from "../models/property.model";
import { listingPipeline } from "../utils/featured";
import { Project } from "../models/project.model";
import { publicLocation } from "../utils/geo";
import { pageParams, paginated } from "../utils/pagination";
import { uniqueSlug } from "../utils/uniqueSlug";
import {
  featuredOrder,
  assertObjectId,
  bool,
  catalogArray,
  has,
  images,
  listParam,
  location,
  num,
  numOrNull,
  objectIdOrNull,
  oneOf,
  price,
  str,
  textSearch,
  videos,
} from "../utils/validate";
import { cleanupAssets, imageAssets, videoAssets } from "./upload.service";

const MAX_IMAGES = 25;
const CODE_REGEX = /^[A-Za-z0-9_-]{1,30}$/;

export const PROPERTY_CARD_FIELDS =
  "code title slug summary type condition sector locality badge price images bedrooms bathrooms parking builtM2 totalM2 frontMeters landUse isFeatured";

export function toPropertyCard(p: any) {
  return {
    _id: p._id,
    code: p.code || "",
    title: p.title,
    slug: p.slug,
    summary: p.summary || "",
    type: p.type,
    condition: p.condition || "",
    sector: p.sector || "",
    locality: p.locality || "",
    badge: p.badge || "",
    price: p.price ?? 0,
    cover: p.images?.[0]?.url || "",
    imagesCount: p.images?.length || 0,
    bedrooms: p.bedrooms ?? null,
    bathrooms: p.bathrooms ?? null,
    parking: p.parking ?? null,
    builtM2: p.builtM2 ?? null,
    totalM2: p.totalM2 ?? null,
    frontMeters: p.frontMeters ?? null,
    landUse: p.landUse || "",
    isFeatured: !!p.isFeatured,
  };
}

const NULLABLE_NUMBERS = [
  "ageYears",
  "totalM2",
  "builtM2",
  "gardenM2",
  "bedrooms",
  "bathrooms",
  "halfBathrooms",
  "parking",
  "storageRooms",
  "elevators",
  "floors",
  "frontMeters",
  "depthMeters",
  "buildableFloors",
] as const;

/** Whitelist de lo que el admin puede escribir. Solo se incluyen las claves presentes. */
function buildData(body: Record<string, any>): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  if (has(body, "code")) data.code = str(body.code, 30);
  if (has(body, "title")) data.title = str(body.title, 200);
  if (has(body, "summary")) data.summary = str(body.summary, 220);
  if (has(body, "description")) data.description = str(body.description, 50000);
  if (has(body, "address")) data.address = str(body.address, 300);
  if (has(body, "locality")) data.locality = str(body.locality, 60);
  if (has(body, "badge")) data.badge = str(body.badge, 24);
  if (has(body, "landUse")) data.landUse = str(body.landUse, 40);
  if (has(body, "city")) data.city = str(body.city, 80) || "Quito";
  if (has(body, "type")) data.type = oneOf(body.type, PROPERTY_TYPE_KEYS, "tipo");
  if (has(body, "condition")) {
    data.condition = body.condition ? oneOf(body.condition, PROPERTY_CONDITION_KEYS, "etapa") : "";
  }
  if (has(body, "sector")) {
    data.sector = body.sector ? oneOf(body.sector, SECTOR_KEYS, "sector") : "";
  }
  for (const field of NULLABLE_NUMBERS) {
    if (has(body, field)) {
      const n = numOrNull(body[field]);
      data[field] = n === null ? null : Math.max(0, n);
    }
  }
  if (has(body, "price")) data.price = price(body.price);
  if (has(body, "hoa")) {
    const hoa = body.hoa && typeof body.hoa === "object" ? body.hoa : {};
    data.hoa = { enabled: bool(hoa.enabled), amount: Math.max(0, num(hoa.amount)) };
  }
  if (has(body, "serviceBathroom")) data.serviceBathroom = bool(body.serviceBathroom);
  if (has(body, "isFeatured")) data.isFeatured = bool(body.isFeatured);
  if (has(body, "featuredOrder")) data.featuredOrder = featuredOrder(body.featuredOrder);
  if (has(body, "amenities")) data.amenities = catalogArray(body.amenities, AMENITY_KEYS);
  if (has(body, "images")) {
    if (Array.isArray(body.images) && body.images.length > MAX_IMAGES) {
      throw new CustomError(`Máximo ${MAX_IMAGES} fotos por propiedad`, 400);
    }
    data.images = images(body.images, MAX_IMAGES);
  }
  if (has(body, "videos")) data.videos = videos(body.videos);
  if (has(body, "floorPlans")) data.floorPlans = images(body.floorPlans, 20);
  if (has(body, "location")) data.location = location(body.location);
  if (has(body, "status")) data.status = oneOf(body.status, PROPERTY_STATUSES, "estado");
  if (has(body, "project")) data.project = objectIdOrNull(body.project);

  return data;
}

/** Siguiente G3I-0001, G3I-0002... a partir del mayor código con ese formato. */
async function nextCode(): Promise<string> {
  const docs = await Property.find({ code: /^G3I-\d+$/ }, { code: 1 }).lean();
  const max = docs.reduce((acc, d) => Math.max(acc, Number(d.code?.slice(4)) || 0), 0);
  return `G3I-${String(max + 1).padStart(4, "0")}`;
}

async function assertCodeFree(code: string, excludeId?: string) {
  if (!CODE_REGEX.test(code)) {
    throw new CustomError("El código solo puede tener letras, números y guiones (máx. 30)", 400);
  }
  const filter: Record<string, unknown> = { code };
  if (excludeId) filter._id = { $ne: excludeId };
  if (await Property.exists(filter)) {
    throw new CustomError(`Ya existe una propiedad con el código ${code}`, 409);
  }
}

async function assertProject(projectId: unknown) {
  if (projectId && !(await Project.exists({ _id: projectId }))) {
    throw new CustomError("El proyecto asociado no existe", 400);
  }
}

// ─── Público ──────────────────────────────────────────────────────────

function publicFilter(query: Record<string, any>): Record<string, unknown> {
  const filter: Record<string, any> = { status: "published" };
  const types = listParam(query.type).filter((t) => (PROPERTY_TYPE_KEYS as string[]).includes(t));
  if (types.length) filter.type = { $in: types };
  const sectors = listParam(query.sector);
  if (sectors.length) filter.sector = { $in: sectors };
  const conditions = listParam(query.condition);
  if (conditions.length) filter.condition = { $in: conditions };

  const minPrice = numOrNull(query.minPrice);
  const maxPrice = numOrNull(query.maxPrice);
  if (minPrice !== null || maxPrice !== null) {
    filter.price = {};
    if (minPrice !== null) filter.price.$gte = minPrice;
    if (maxPrice !== null) filter.price.$lte = maxPrice;
  }
  // Terrenos: rango de metraje y uso del suelo.
  const minM2 = numOrNull(query.minM2);
  const maxM2 = numOrNull(query.maxM2);
  if (minM2 !== null || maxM2 !== null) {
    filter.totalM2 = {};
    if (minM2 !== null) filter.totalM2.$gte = minM2;
    if (maxM2 !== null) filter.totalM2.$lte = maxM2;
  }
  const landUses = listParam(query.landUse);
  if (landUses.length) filter.landUse = { $in: landUses };
  const bedrooms = numOrNull(query.bedrooms);
  if (bedrooms !== null && bedrooms > 0) filter.bedrooms = { $gte: bedrooms };
  if (bool(query.featured)) filter.isFeatured = true;

  const search = textSearch(query.q, ["title", "code", "summary", "address"]);
  if (search) Object.assign(filter, search);
  return filter;
}

function sortFor(sort: unknown, featured: boolean): Record<string, 1 | -1> {
  if (sort === "price-asc") return { price: 1, createdAt: -1 };
  if (sort === "price-desc") return { price: -1, createdAt: -1 };
  // «Más buscadas»: primero las que la inmobiliaria destaca (en su orden) y luego las más visitadas.
  if (sort === "popular") return { isFeatured: -1, featuredRank: 1, views: -1, createdAt: -1 };
  if (featured) return { featuredRank: 1, createdAt: -1 };
  return { createdAt: -1 };
}

export async function listPublic(query: Record<string, any>) {
  const params = pageParams(query);
  const filter = publicFilter(query);
  const [docs, total] = await Promise.all([
    Property.aggregate(
      listingPipeline(
        filter,
        sortFor(query.sort, bool(query.featured)),
        PROPERTY_CARD_FIELDS,
        params,
      ),
    ),
    Property.countDocuments(filter),
  ]);
  return paginated(docs.map(toPropertyCard), total, params);
}

export async function getPublicBySlug(slug: string) {
  const doc = await Property.findOneAndUpdate(
    { slug, status: "published" },
    { $inc: { views: 1 } },
    { new: true },
  )
    .select("-source")
    .populate("project", "title slug status")
    .lean();
  if (!doc) throw new CustomError("Propiedad no encontrada", 404);

  const project = doc.project as any;
  return {
    ...doc,
    project:
      project && project.status === "published"
        ? { _id: project._id, title: project.title, slug: project.slug }
        : null,
    location: publicLocation(String(doc._id), doc.location),
  };
}

export async function relatedPublic(slug: string) {
  const current = await Property.findOne({ slug, status: "published" })
    .select("type sector")
    .lean();
  if (!current) throw new CustomError("Propiedad no encontrada", 404);
  const docs = await Property.find({
    _id: { $ne: current._id },
    status: "published",
    $or: [{ type: current.type }, ...(current.sector ? [{ sector: current.sector }] : [])],
  })
    .select(PROPERTY_CARD_FIELDS + " createdAt")
    .sort({ isFeatured: -1, createdAt: -1 })
    .limit(30)
    .lean();

  // Primero las que comparten tipo Y sector: son las comparables de verdad.
  const score = (d: any) =>
    (d.type === current.type ? 1 : 0) + (d.sector === current.sector ? 1 : 0);
  return docs
    .sort((a, b) => score(b) - score(a))
    .slice(0, 6)
    .map(toPropertyCard);
}

// ─── Admin ────────────────────────────────────────────────────────────

export async function adminList(query: Record<string, any>) {
  const params = pageParams(query, 20);
  const filter: Record<string, any> = {};
  if (query.status && (PROPERTY_STATUSES as readonly string[]).includes(query.status)) {
    filter.status = query.status;
  }
  if (query.type && (PROPERTY_TYPE_KEYS as string[]).includes(query.type)) filter.type = query.type;
  if (query.sector) filter.sector = str(query.sector, 50);
  const search = textSearch(query.q, ["title", "code", "address", "slug"]);
  if (search) Object.assign(filter, search);

  const [docs, total] = await Promise.all([
    Property.find(filter)
      .select(PROPERTY_CARD_FIELDS + " status views createdAt updatedAt")
      // En el portal se puede ordenar por visitas para ver qué es lo más buscado.
      .sort(query.sort === "views" ? { views: -1, updatedAt: -1 } : { updatedAt: -1 })
      .skip(params.skip)
      .limit(params.limit)
      .lean(),
    Property.countDocuments(filter),
  ]);
  const items = docs.map((d) => ({
    ...toPropertyCard(d),
    status: d.status,
    views: d.views ?? 0,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));
  return paginated(items, total, params);
}

export async function adminGet(id: string) {
  assertObjectId(id, "Identificador de propiedad inválido");
  const doc = await Property.findById(id).lean();
  if (!doc) throw new CustomError("Propiedad no encontrada", 404);
  return doc;
}

export async function create(body: Record<string, any>) {
  const data = buildData(body ?? {});
  if (!data.title) throw new CustomError("El título es obligatorio", 400);
  if (!data.type) throw new CustomError("El tipo de propiedad es obligatorio", 400);

  if (data.code) await assertCodeFree(data.code as string);
  else data.code = await nextCode();
  await assertProject(data.project);

  if (!has(body, "summary") && data.description) {
    data.summary = String(data.description).replace(/\s+/g, " ").slice(0, 220);
  }
  data.slug = await uniqueSlug(Property, str(body.slug) || (data.title as string));

  return Property.create(data);
}

export async function update(id: string, body: Record<string, any>) {
  assertObjectId(id, "Identificador de propiedad inválido");
  const current = await Property.findById(id).select("_id").lean();
  if (!current) throw new CustomError("Propiedad no encontrada", 404);

  const data = buildData(body ?? {});
  if (has(body, "title") && !data.title) throw new CustomError("El título es obligatorio", 400);
  if (has(body, "code")) {
    if (data.code) await assertCodeFree(data.code as string, id);
    else delete data.code; // un código no se borra: se perdería la referencia interna
  }
  if (has(body, "project")) await assertProject(data.project);
  // El slug cambia solo si se pide: cambiarlo al editar el título rompería enlaces ya compartidos.
  if (str(body.slug)) data.slug = await uniqueSlug(Property, str(body.slug), id);

  const doc = await Property.findByIdAndUpdate(
    id,
    { $set: data },
    { new: true, runValidators: true },
  ).lean();
  return doc;
}

export async function setStatus(id: string, status: unknown) {
  assertObjectId(id, "Identificador de propiedad inválido");
  const value = oneOf(status, PROPERTY_STATUSES, "estado") as PropertyStatus;
  const doc = await Property.findByIdAndUpdate(
    id,
    { $set: { status: value } },
    { new: true },
  ).lean();
  if (!doc) throw new CustomError("Propiedad no encontrada", 404);
  return doc;
}

export async function setFeatured(id: string, body: Record<string, any>) {
  assertObjectId(id, "Identificador de propiedad inválido");
  const set: Record<string, unknown> = { isFeatured: bool(body?.isFeatured) };
  if (has(body ?? {}, "featuredOrder")) set.featuredOrder = featuredOrder(body.featuredOrder);
  const doc = await Property.findByIdAndUpdate(id, { $set: set }, { new: true }).lean();
  if (!doc) throw new CustomError("Propiedad no encontrada", 404);
  return doc;
}

export async function remove(id: string) {
  assertObjectId(id, "Identificador de propiedad inválido");
  const doc = await Property.findByIdAndDelete(id).lean();
  if (!doc) throw new CustomError("Propiedad no encontrada", 404);
  await cleanupAssets([
    ...imageAssets(doc.images),
    ...imageAssets(doc.floorPlans),
    ...videoAssets(doc.videos),
  ]);
  return { ok: true };
}
