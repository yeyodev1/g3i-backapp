import type { PipelineStage } from "mongoose";

/**
 * Posición efectiva entre destacadas: 0 (datos anteriores al campo de posición)
 * cuenta como «sin número» y va después de las que la inmobiliaria numeró.
 */
const featuredRank = { $cond: [{ $gt: ["$featuredOrder", 0] }, "$featuredOrder", 999] };

/** Pipeline de listado público: filtra, ordena por `featuredRank` si hace falta y pagina. */
export function listingPipeline(
  filter: Record<string, unknown>,
  sort: Record<string, 1 | -1>,
  fields: string,
  page: { skip: number; limit: number },
): PipelineStage[] {
  return [
    { $match: filter },
    { $addFields: { featuredRank } },
    { $sort: sort },
    { $skip: page.skip },
    { $limit: page.limit },
    {
      $project: Object.fromEntries(
        fields
          .split(/\s+/)
          .filter(Boolean)
          .map((f) => [f, 1]),
      ),
    },
  ];
}
