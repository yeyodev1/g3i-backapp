import { Project } from "../models/project.model";
import { Property } from "../models/property.model";
import { activeAdvisors, activePartners, activeTestimonials } from "./content.service";
import { listSectors } from "./sector.service";
import { getSettings } from "./settings.service";

/** Todo lo que el layout público necesita en una sola llamada. */
export async function getSite() {
  const [settings, advisors, testimonials, partners, properties, projects, sectors, types] =
    await Promise.all([
      getSettings(),
      activeAdvisors(),
      activeTestimonials(),
      activePartners(),
      Property.countDocuments({ status: "published" }),
      Project.countDocuments({ status: "published" }),
      listSectors(true),
      Property.aggregate<{ _id: string; n: number }>([
        { $match: { status: "published" } },
        { $group: { _id: "$type", n: { $sum: 1 } } },
      ]),
    ]);

  const { key: _key, ...publicSettings } = (settings ?? {}) as Record<string, any>;
  return {
    settings: publicSettings,
    advisors,
    testimonials,
    partners,
    counts: {
      properties,
      projects,
      sectors: sectors.length,
      // Respaldo de las cifras de Inicio cuando el panel no define ninguna.
      byType: Object.fromEntries(types.map((t) => [t._id, t.n])),
    },
  };
}
