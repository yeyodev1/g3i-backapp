import {
  AMENITIES,
  PROJECT_STAGES,
  PROPERTY_CONDITIONS,
  PROPERTY_TYPES,
  SECTORS,
} from "../config/catalogs";

export function getCatalogs() {
  return {
    propertyTypes: PROPERTY_TYPES,
    conditions: PROPERTY_CONDITIONS,
    projectStages: PROJECT_STAGES,
    sectors: SECTORS.map((s) => ({ ...s, city: "Quito" })),
    amenities: AMENITIES,
  };
}
