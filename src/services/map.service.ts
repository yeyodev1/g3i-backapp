import {
  PROJECT_STAGE_KEYS,
  PROPERTY_CONDITION_KEYS,
  PROPERTY_TYPE_KEYS,
} from "../config/catalogs";
import { Project } from "../models/project.model";
import { Property } from "../models/property.model";
import { publicLocation } from "../utils/geo";
import { listParam } from "../utils/validate";

const withCoords = { "location.lat": { $ne: null }, "location.lng": { $ne: null } };

/**
 * Pines del mapa. `condition` solo aplica a propiedades y `stage` solo a
 * proyectos; `kind=property|project` permite pedir una sola capa.
 */
export async function getPins(query: Record<string, any>) {
  const types = listParam(query.type).filter((t) => (PROPERTY_TYPE_KEYS as string[]).includes(t));
  const sectors = listParam(query.sector);
  const conditions = listParam(query.condition).filter((c) =>
    (PROPERTY_CONDITION_KEYS as string[]).includes(c),
  );
  const stages = listParam(query.stage).filter((s) => (PROJECT_STAGE_KEYS as string[]).includes(s));
  const kind = String(query.kind || "");

  const propertyFilter: Record<string, unknown> = { status: "published", ...withCoords };
  if (types.length) propertyFilter.type = { $in: types };
  if (sectors.length) propertyFilter.sector = { $in: sectors };
  if (conditions.length) propertyFilter.condition = { $in: conditions };

  const projectFilter: Record<string, unknown> = { status: "published", ...withCoords };
  if (types.length) projectFilter.propertyTypes = { $in: types };
  if (sectors.length) projectFilter.sector = { $in: sectors };
  if (stages.length) projectFilter.stage = { $in: stages };

  const [properties, projects] = await Promise.all([
    kind === "project"
      ? []
      : Property.find(propertyFilter)
          .select("slug title type price sector images location bedrooms builtM2 totalM2 landUse")
          .lean(),
    kind === "property"
      ? []
      : Project.find(projectFilter)
          .select("slug title propertyTypes priceFrom sector images location")
          .lean(),
  ]);

  return {
    properties: properties.map((p) => {
      const loc = publicLocation(String(p._id), p.location);
      return {
        id: p._id,
        kind: "property" as const,
        slug: p.slug,
        title: p.title,
        type: p.type,
        price: p.price ?? 0,
        sector: p.sector || "",
        cover: p.images?.[0]?.url || "",
        lat: loc.lat,
        lng: loc.lng,
        exact: loc.exact,
        radiusMeters: loc.radiusMeters,
        bedrooms: p.bedrooms ?? null,
        builtM2: p.builtM2 ?? null,
        totalM2: p.totalM2 ?? null,
        landUse: p.landUse || "",
      };
    }),
    projects: projects.map((p) => {
      const loc = publicLocation(String(p._id), p.location);
      return {
        id: p._id,
        kind: "project" as const,
        slug: p.slug,
        title: p.title,
        type: p.propertyTypes?.[0] || "",
        price: p.priceFrom ?? null,
        sector: p.sector || "",
        cover: p.images?.[0]?.url || "",
        lat: loc.lat,
        lng: loc.lng,
        exact: loc.exact,
        radiusMeters: loc.radiusMeters,
        bedrooms: null,
        builtM2: null,
        totalM2: null,
        landUse: "",
      };
    }),
  };
}
