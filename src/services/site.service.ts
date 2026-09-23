import { Project } from "../models/project.model";
import { Property } from "../models/property.model";
import { activeAdvisors, activePartners, activeTestimonials } from "./content.service";
import { listSectors } from "./sector.service";
import { getSettings } from "./settings.service";

/** Todo lo que el layout público necesita en una sola llamada. */
export async function getSite() {
  const [settings, advisors, testimonials, partners, properties, projects, sectors] =
    await Promise.all([
      getSettings(),
      activeAdvisors(),
      activeTestimonials(),
      activePartners(),
      Property.countDocuments({ status: "published" }),
      Project.countDocuments({ status: "published" }),
      listSectors(true),
    ]);

  const { key: _key, ...publicSettings } = (settings ?? {}) as Record<string, any>;
  return {
    settings: publicSettings,
    advisors,
    testimonials,
    partners,
    counts: { properties, projects, sectors: sectors.length },
  };
}
