import { Model } from "mongoose";
import { slugify } from "./slugify";

/**
 * Slug libre en la colección: "casa-en-cumbaya", luego "casa-en-cumbaya-2"...
 * `excludeId` evita que un documento choque consigo mismo al editarse.
 */
export async function uniqueSlug(
  model: Model<any>,
  source: string,
  excludeId?: string,
): Promise<string> {
  const base = slugify(source).slice(0, 90).replace(/-+$/, "") || "item";
  let candidate = base;
  let n = 2;
  for (;;) {
    const filter: Record<string, unknown> = { slug: candidate };
    if (excludeId) filter._id = { $ne: excludeId };
    const exists = await model.exists(filter);
    if (!exists) return candidate;
    candidate = `${base}-${n++}`;
  }
}
