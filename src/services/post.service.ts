import { CustomError } from "../errors/customError.error";
import { POST_STATUSES } from "../config/catalogs";
import { Post } from "../models/post.model";
import { pageParams, paginated } from "../utils/pagination";
import { uniqueSlug } from "../utils/uniqueSlug";
import { assertObjectId, has, image, oneOf, str, textSearch } from "../utils/validate";
import { cleanupAssets, imageAssets } from "./upload.service";

function toPostCard(p: any) {
  return {
    _id: p._id,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt || "",
    cover: p.cover ?? null,
  };
}

function buildData(body: Record<string, any>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (has(body, "title")) data.title = str(body.title, 200);
  if (has(body, "excerpt")) data.excerpt = str(body.excerpt, 400);
  if (has(body, "cover")) data.cover = image(body.cover);
  if (has(body, "content")) data.content = str(body.content, 100000);
  if (has(body, "status")) data.status = oneOf(body.status, POST_STATUSES, "estado");
  if (has(body, "publishedAt")) {
    const d = body.publishedAt ? new Date(body.publishedAt) : null;
    data.publishedAt = d && !Number.isNaN(d.getTime()) ? d : null;
  }
  return data;
}

// ─── Público ──────────────────────────────────────────────────────────

export async function listPublic(query: Record<string, any>) {
  const params = pageParams(query, 9);
  const filter = { status: "published" };
  const [docs, total] = await Promise.all([
    Post.find(filter)
      .select("title slug excerpt cover publishedAt")
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip(params.skip)
      .limit(params.limit)
      .lean(),
    Post.countDocuments(filter),
  ]);
  return paginated(docs.map(toPostCard), total, params);
}

export async function getPublicBySlug(slug: string) {
  const doc = await Post.findOne({ slug, status: "published" }).lean();
  if (!doc) throw new CustomError("Artículo no encontrado", 404);
  return doc;
}

// ─── Admin ────────────────────────────────────────────────────────────

export async function adminList(query: Record<string, any>) {
  const params = pageParams(query, 20);
  const filter: Record<string, any> = {};
  if (query.status && (POST_STATUSES as readonly string[]).includes(query.status))
    filter.status = query.status;
  const search = textSearch(query.q, ["title", "excerpt"]);
  if (search) Object.assign(filter, search);
  const [items, total] = await Promise.all([
    Post.find(filter)
      .select("title slug excerpt cover status publishedAt createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .skip(params.skip)
      .limit(params.limit)
      .lean(),
    Post.countDocuments(filter),
  ]);
  return paginated(items, total, params);
}

export async function adminGet(id: string) {
  assertObjectId(id, "Identificador de artículo inválido");
  const doc = await Post.findById(id).lean();
  if (!doc) throw new CustomError("Artículo no encontrado", 404);
  return doc;
}

export async function create(body: Record<string, any>) {
  const data = buildData(body ?? {});
  if (!data.title) throw new CustomError("El título es obligatorio", 400);
  if (data.status === "published" && !data.publishedAt) data.publishedAt = new Date();
  data.slug = await uniqueSlug(Post, str(body.slug) || (data.title as string));
  return Post.create(data);
}

export async function update(id: string, body: Record<string, any>) {
  assertObjectId(id, "Identificador de artículo inválido");
  const current = await Post.findById(id).select("publishedAt").lean();
  if (!current) throw new CustomError("Artículo no encontrado", 404);
  const data = buildData(body ?? {});
  if (has(body, "title") && !data.title) throw new CustomError("El título es obligatorio", 400);
  // La primera publicación fija la fecha; republicar no la mueve.
  if (data.status === "published" && !current.publishedAt && !data.publishedAt)
    data.publishedAt = new Date();
  if (str(body.slug)) data.slug = await uniqueSlug(Post, str(body.slug), id);
  return Post.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true }).lean();
}

export async function remove(id: string) {
  assertObjectId(id, "Identificador de artículo inválido");
  const doc = await Post.findByIdAndDelete(id).lean();
  if (!doc) throw new CustomError("Artículo no encontrado", 404);
  await cleanupAssets(imageAssets([doc.cover]));
  return { ok: true };
}
