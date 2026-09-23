import { SECTORS, sectorLabel } from "../config/catalogs";
import { Project } from "../models/project.model";
import { Property } from "../models/property.model";

async function countBySector(
  model: typeof Property | typeof Project,
): Promise<Map<string, number>> {
  const rows = await (model as any).aggregate([
    { $match: { status: "published", sector: { $nin: ["", null] } } },
    { $group: { _id: "$sector", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r: { _id: string; count: number }) => [r._id, r.count]));
}

/**
 * Sectores con su conteo de inmuebles publicados (propiedades + proyectos).
 * Con `onlyActive` se ocultan los vacíos: acordado con la clienta para no
 * mostrar filtros que llevan a una página sin resultados.
 */
export async function listSectors(onlyActive: boolean) {
  const [properties, projects] = await Promise.all([
    countBySector(Property),
    countBySector(Project),
  ]);

  const keys: string[] = SECTORS.map((s) => s.key);
  // Sectores que existen en datos (migración) pero no en el catálogo semilla.
  for (const key of [...properties.keys(), ...projects.keys()]) {
    if (!keys.includes(key)) keys.push(key);
  }

  return keys
    .map((key) => ({
      key,
      label: sectorLabel(key),
      count: (properties.get(key) || 0) + (projects.get(key) || 0),
    }))
    .filter((s) => !onlyActive || s.count > 0);
}
