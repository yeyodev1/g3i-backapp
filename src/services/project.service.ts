import { Types } from "mongoose";
import { CustomError } from "../errors/customError.error";
import {
  AMENITY_KEYS,
  PROJECT_STAGE_KEYS,
  PROJECT_STATUSES,
  PROPERTY_TYPE_KEYS,
  ProjectStatus,
  SECTOR_KEYS,
  UNIT_STATUSES,
  UnitStatus,
} from "../config/catalogs";
import { Project } from "../models/project.model";
import { Property } from "../models/property.model";
import { Unit } from "../models/unit.model";
import { publicLocation } from "../utils/geo";
import { pageParams, paginated } from "../utils/pagination";
import { uniqueSlug } from "../utils/uniqueSlug";
import {
  assertObjectId,
  bool,
  catalogArray,
  has,
  image,
  images,
  listParam,
  location,
  num,
  numOrNull,
  oneOf,
  price,
  priceOrNull,
  str,
  strArray,
  textSearch,
  videos,
} from "../utils/validate";
import { cleanupAssets, imageAssets, videoAssets } from "./upload.service";

const CODE_REGEX = /^[A-Za-z0-9_-]{1,30}$/;
const PUBLIC_UNIT_STATUSES: UnitStatus[] = ["available", "reserved"];

export const PROJECT_CARD_FIELDS =
  "code title slug summary stage propertyTypes sector locality priceFrom deliveryDate images";

export function toProjectCard(p: any, unitsAvailable = 0) {
  return {
    _id: p._id,
    code: p.code || "",
    title: p.title,
    slug: p.slug,
    summary: p.summary || "",
    stage: p.stage || "",
    propertyTypes: p.propertyTypes || [],
    sector: p.sector || "",
    locality: p.locality || "",
    priceFrom: p.priceFrom ?? null,
    deliveryDate: p.deliveryDate || "",
    cover: p.images?.[0]?.url || "",
    unitsAvailable,
  };
}

/** Unidades disponibles por proyecto, en una sola consulta para toda la página. */
async function availableCounts(ids: Types.ObjectId[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const rows = await Unit.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { project: { $in: ids }, status: "available" } },
    { $group: { _id: "$project", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

export async function toProjectCards(docs: any[]) {
  const counts = await availableCounts(docs.map((d) => d._id));
  return docs.map((d) => toProjectCard(d, counts.get(String(d._id)) || 0));
}

function buildData(body: Record<string, any>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (has(body, "code")) data.code = str(body.code, 30);
  if (has(body, "title")) data.title = str(body.title, 200);
  if (has(body, "summary")) data.summary = str(body.summary, 220);
  if (has(body, "description")) data.description = str(body.description, 50000);
  if (has(body, "stage"))
    data.stage = body.stage ? oneOf(body.stage, PROJECT_STAGE_KEYS, "etapa") : "";
  if (has(body, "propertyTypes"))
    data.propertyTypes = catalogArray(body.propertyTypes, PROPERTY_TYPE_KEYS);
  if (has(body, "developer")) data.developer = str(body.developer, 200);
  if (has(body, "sector"))
    data.sector = body.sector ? oneOf(body.sector, SECTOR_KEYS, "sector") : "";
  if (has(body, "city")) data.city = str(body.city, 80) || "Quito";
  if (has(body, "address")) data.address = str(body.address, 300);
  if (has(body, "locality")) data.locality = str(body.locality, 60);
  if (has(body, "location")) data.location = location(body.location);
  if (has(body, "priceFrom")) data.priceFrom = priceOrNull(body.priceFrom);
  if (has(body, "deliveryDate")) data.deliveryDate = str(body.deliveryDate, 60);
  if (has(body, "totalUnits")) {
    const n = numOrNull(body.totalUnits);
    data.totalUnits = n === null ? null : Math.max(0, Math.round(n));
  }
  if (has(body, "amenities")) data.amenities = catalogArray(body.amenities, AMENITY_KEYS);
  if (has(body, "highlights")) data.highlights = strArray(body.highlights, 30);
  if (has(body, "images")) data.images = images(body.images, 40);
  if (has(body, "videos")) data.videos = videos(body.videos);
  if (has(body, "brochure")) {
    const b = body.brochure && typeof body.brochure === "object" ? body.brochure : null;
    const url = b ? str(b.url, 2000) : "";
    data.brochure = url ? { url, publicId: str(b.publicId, 500), name: str(b.name, 200) } : null;
  }
  if (has(body, "status")) data.status = oneOf(body.status, PROJECT_STATUSES, "estado");
  if (has(body, "isFeatured")) data.isFeatured = bool(body.isFeatured);
  if (has(body, "featuredOrder")) data.featuredOrder = num(body.featuredOrder);
  return data;
}

async function assertCodeFree(code: string, excludeId?: string) {
  if (!CODE_REGEX.test(code)) {
    throw new CustomError("El código solo puede tener letras, números y guiones (máx. 30)", 400);
  }
  const filter: Record<string, unknown> = { code };
  if (excludeId) filter._id = { $ne: excludeId };
  if (await Project.exists(filter)) {
    throw new CustomError(`Ya existe un proyecto con el código ${code}`, 409);
  }
}

/**
 * priceFrom = precio mínimo de las unidades disponibles o reservadas. Si no
 * hay ninguna se respeta el valor manual: un proyecto en planos puede
 * anunciar "desde" sin tener inventario cargado todavía.
 */
export async function recalcPriceFrom(projectId: string | Types.ObjectId): Promise<void> {
  const [row] = await Unit.aggregate<{ min: number }>([
    {
      $match: {
        project: new Types.ObjectId(String(projectId)),
        status: { $in: PUBLIC_UNIT_STATUSES },
        price: { $gt: 0 },
      },
    },
    { $group: { _id: null, min: { $min: "$price" } } },
  ]);
  if (row && typeof row.min === "number") {
    await Project.updateOne({ _id: projectId }, { $set: { priceFrom: row.min } });
  }
}

// ─── Público ──────────────────────────────────────────────────────────

export async function listPublic(query: Record<string, any>) {
  const params = pageParams(query);
  const filter: Record<string, any> = { status: "published" };
  const stages = listParam(query.stage);
  if (stages.length) filter.stage = { $in: stages };
  const sectors = listParam(query.sector);
  if (sectors.length) filter.sector = { $in: sectors };
  const types = listParam(query.type);
  if (types.length) filter.propertyTypes = { $in: types };
  const featured = bool(query.featured);
  if (featured) filter.isFeatured = true;
  const search = textSearch(query.q, ["title", "code", "summary", "developer", "address"]);
  if (search) Object.assign(filter, search);

  const [docs, total] = await Promise.all([
    Project.find(filter)
      .select(PROJECT_CARD_FIELDS)
      .sort(featured ? { featuredOrder: 1, createdAt: -1 } : { isFeatured: -1, createdAt: -1 })
      .skip(params.skip)
      .limit(params.limit)
      .lean(),
    Project.countDocuments(filter),
  ]);
  return paginated(await toProjectCards(docs), total, params);
}

async function findPublished(slug: string) {
  const project = await Project.findOne({ slug, status: "published" }).select("-source").lean();
  if (!project) throw new CustomError("Proyecto no encontrado", 404);
  return project;
}

export async function getPublicBySlug(slug: string) {
  const project = await Project.findOneAndUpdate(
    { slug, status: "published" },
    { $inc: { views: 1 } },
    { new: true },
  )
    .select("-source")
    .lean();
  if (!project) throw new CustomError("Proyecto no encontrado", 404);

  const units = await Unit.find({ project: project._id, status: { $in: PUBLIC_UNIT_STATUSES } })
    .sort({ order: 1, createdAt: 1 })
    .lean();

  return {
    project: { ...project, location: publicLocation(String(project._id), project.location) },
    units,
  };
}

export async function relatedPublic(slug: string) {
  const current = await findPublished(slug);
  const docs = await Project.find({
    _id: { $ne: current._id },
    status: "published",
    $or: [
      ...(current.sector ? [{ sector: current.sector }] : []),
      ...(current.stage ? [{ stage: current.stage }] : []),
      { propertyTypes: { $in: current.propertyTypes || [] } },
    ],
  })
    .select(PROJECT_CARD_FIELDS)
    .sort({ isFeatured: -1, createdAt: -1 })
    .limit(4)
    .lean();
  return toProjectCards(docs);
}

export async function getPublicUnit(slug: string, unitId: string) {
  assertObjectId(unitId, "Identificador de unidad inválido");
  const project = await findPublished(slug);
  const unit = await Unit.findOne({
    _id: unitId,
    project: project._id,
    status: { $in: PUBLIC_UNIT_STATUSES },
  }).lean();
  if (!unit) throw new CustomError("Unidad no encontrada", 404);
  const [card] = await toProjectCards([project]);
  // Los renders del proyecto sirven de galería cuando la unidad aún no tiene fotos propias.
  return { project: { ...card, images: (project as any).images || [] }, unit };
}

// ─── Admin: proyectos ─────────────────────────────────────────────────

export async function adminList(query: Record<string, any>) {
  const params = pageParams(query, 20);
  const filter: Record<string, any> = {};
  if (query.status && (PROJECT_STATUSES as readonly string[]).includes(query.status)) {
    filter.status = query.status;
  }
  if (query.type) filter.propertyTypes = str(query.type, 30);
  if (query.stage) filter.stage = str(query.stage, 30);
  const search = textSearch(query.q, ["title", "code", "developer", "slug"]);
  if (search) Object.assign(filter, search);

  const [docs, total] = await Promise.all([
    Project.find(filter)
      .select(PROJECT_CARD_FIELDS + " status views isFeatured featuredOrder createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .skip(params.skip)
      .limit(params.limit)
      .lean(),
    Project.countDocuments(filter),
  ]);

  const ids = docs.map((d) => d._id);
  const unitRows = ids.length
    ? await Unit.aggregate<{ _id: Types.ObjectId; total: number; available: number }>([
        { $match: { project: { $in: ids } } },
        {
          $group: {
            _id: "$project",
            total: { $sum: 1 },
            available: { $sum: { $cond: [{ $eq: ["$status", "available"] }, 1, 0] } },
          },
        },
      ])
    : [];
  const byId = new Map(unitRows.map((r) => [String(r._id), r]));

  const items = docs.map((d) => {
    const u = byId.get(String(d._id));
    return {
      ...toProjectCard(d, u?.available || 0),
      unitsTotal: u?.total || 0,
      status: d.status,
      views: d.views ?? 0,
      isFeatured: !!d.isFeatured,
      featuredOrder: d.featuredOrder ?? 0,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  });
  return paginated(items, total, params);
}

export async function adminGet(id: string) {
  assertObjectId(id, "Identificador de proyecto inválido");
  const doc = await Project.findById(id).lean();
  if (!doc) throw new CustomError("Proyecto no encontrado", 404);
  return doc;
}

export async function create(body: Record<string, any>) {
  const data = buildData(body ?? {});
  if (!data.title) throw new CustomError("El título es obligatorio", 400);
  if (data.code) await assertCodeFree(data.code as string);
  else delete data.code;
  if (!has(body, "summary") && data.description) {
    data.summary = String(data.description).replace(/\s+/g, " ").slice(0, 220);
  }
  data.slug = await uniqueSlug(Project, str(body.slug) || (data.title as string));
  return Project.create(data);
}

export async function update(id: string, body: Record<string, any>) {
  assertObjectId(id, "Identificador de proyecto inválido");
  if (!(await Project.exists({ _id: id }))) throw new CustomError("Proyecto no encontrado", 404);

  const data = buildData(body ?? {});
  const unset: Record<string, 1> = {};
  if (has(body, "title") && !data.title) throw new CustomError("El título es obligatorio", 400);
  if (has(body, "code")) {
    if (data.code) await assertCodeFree(data.code as string, id);
    else {
      delete data.code;
      unset.code = 1;
    }
  }
  if (str(body.slug)) data.slug = await uniqueSlug(Project, str(body.slug), id);

  const ops: Record<string, unknown> = { $set: data };
  if (Object.keys(unset).length) ops.$unset = unset;
  await Project.updateOne({ _id: id }, ops, { runValidators: true });
  // Si el admin tocó priceFrom a mano pero hay inventario, manda el inventario.
  if (has(body, "priceFrom")) await recalcPriceFrom(id);
  return Project.findById(id).lean();
}

export async function setStatus(id: string, status: unknown) {
  assertObjectId(id, "Identificador de proyecto inválido");
  const value = oneOf(status, PROJECT_STATUSES, "estado") as ProjectStatus;
  const doc = await Project.findByIdAndUpdate(
    id,
    { $set: { status: value } },
    { new: true },
  ).lean();
  if (!doc) throw new CustomError("Proyecto no encontrado", 404);
  return doc;
}

export async function setFeatured(id: string, body: Record<string, any>) {
  assertObjectId(id, "Identificador de proyecto inválido");
  const set: Record<string, unknown> = { isFeatured: bool(body?.isFeatured) };
  if (has(body ?? {}, "featuredOrder")) set.featuredOrder = num(body.featuredOrder);
  const doc = await Project.findByIdAndUpdate(id, { $set: set }, { new: true }).lean();
  if (!doc) throw new CustomError("Proyecto no encontrado", 404);
  return doc;
}

export async function remove(id: string) {
  assertObjectId(id, "Identificador de proyecto inválido");
  const doc = await Project.findByIdAndDelete(id).lean();
  if (!doc) throw new CustomError("Proyecto no encontrado", 404);

  const units = await Unit.find({ project: id }).select("images floorPlan").lean();
  await Unit.deleteMany({ project: id });
  // Las propiedades sueltas del proyecto siguen existiendo; solo pierden el vínculo.
  await Property.updateMany({ project: id }, { $set: { project: null } });

  await cleanupAssets([
    ...imageAssets(doc.images),
    ...videoAssets(doc.videos),
    ...(doc.brochure ? [{ publicId: doc.brochure.publicId, resourceType: "raw" as const }] : []),
    ...units.flatMap((u) => [...imageAssets(u.images), ...imageAssets([u.floorPlan])]),
  ]);
  return { ok: true };
}

// ─── Admin: unidades ──────────────────────────────────────────────────

function buildUnitData(body: Record<string, any>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (has(body, "name")) data.name = str(body.name, 120);
  if (has(body, "type")) data.type = oneOf(body.type, PROPERTY_TYPE_KEYS, "tipo");
  if (has(body, "floor")) data.floor = str(body.floor, 30);
  for (const field of [
    "bedrooms",
    "bathrooms",
    "parking",
    "storageRooms",
    "builtM2",
    "balconyM2",
    "terraceM2",
    "gardenM2",
  ]) {
    if (has(body, field)) {
      const n = numOrNull(body[field]);
      data[field] = n === null ? null : Math.max(0, n);
    }
  }
  if (has(body, "price")) data.price = price(body.price);
  if (has(body, "description")) data.description = str(body.description, 5000);
  if (has(body, "floorPlan")) data.floorPlan = image(body.floorPlan);
  if (has(body, "images")) data.images = images(body.images, 20);
  if (has(body, "status")) data.status = oneOf(body.status, UNIT_STATUSES, "estado");
  if (has(body, "order")) data.order = num(body.order);
  return data;
}

export async function listUnits(projectId: string) {
  assertObjectId(projectId, "Identificador de proyecto inválido");
  if (!(await Project.exists({ _id: projectId })))
    throw new CustomError("Proyecto no encontrado", 404);
  return Unit.find({ project: projectId }).sort({ order: 1, createdAt: 1 }).lean();
}

export async function createUnit(projectId: string, body: Record<string, any>) {
  assertObjectId(projectId, "Identificador de proyecto inválido");
  if (!(await Project.exists({ _id: projectId })))
    throw new CustomError("Proyecto no encontrado", 404);
  const data = buildUnitData(body ?? {});
  if (!data.name) throw new CustomError("El nombre de la unidad es obligatorio", 400);
  if (!has(body, "order")) data.order = await Unit.countDocuments({ project: projectId });
  const unit = await Unit.create({ ...data, project: projectId });
  await recalcPriceFrom(projectId);
  return unit;
}

export async function updateUnit(unitId: string, body: Record<string, any>) {
  assertObjectId(unitId, "Identificador de unidad inválido");
  const data = buildUnitData(body ?? {});
  if (has(body, "name") && !data.name)
    throw new CustomError("El nombre de la unidad es obligatorio", 400);
  const unit = await Unit.findByIdAndUpdate(
    unitId,
    { $set: data },
    { new: true, runValidators: true },
  ).lean();
  if (!unit) throw new CustomError("Unidad no encontrada", 404);
  await recalcPriceFrom(unit.project);
  return unit;
}

export async function setUnitStatus(unitId: string, status: unknown) {
  assertObjectId(unitId, "Identificador de unidad inválido");
  const value = oneOf(status, UNIT_STATUSES, "estado");
  const unit = await Unit.findByIdAndUpdate(
    unitId,
    { $set: { status: value } },
    { new: true },
  ).lean();
  if (!unit) throw new CustomError("Unidad no encontrada", 404);
  await recalcPriceFrom(unit.project);
  return unit;
}

export async function removeUnit(unitId: string) {
  assertObjectId(unitId, "Identificador de unidad inválido");
  const unit = await Unit.findByIdAndDelete(unitId).lean();
  if (!unit) throw new CustomError("Unidad no encontrada", 404);
  await recalcPriceFrom(unit.project);
  await cleanupAssets([...imageAssets(unit.images), ...imageAssets([unit.floorPlan])]);
  return { ok: true };
}
