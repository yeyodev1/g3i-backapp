/**
 * Catálogos fijos del portal. El front los consume desde GET /api/catalogs,
 * así que cambiar un label acá cambia el sitio entero sin tocar el front.
 */

export interface CatalogItem {
  key: string;
  label: string;
}

export interface AmenityItem extends CatalogItem {
  icon: string;
  scope: "property" | "project" | "both";
}

export const PROPERTY_TYPES = [
  { key: "casa", label: "Casa" },
  { key: "departamento", label: "Departamento" },
  { key: "terreno", label: "Terreno" },
  { key: "suite", label: "Suite" },
  { key: "local", label: "Local comercial" },
  { key: "oficina", label: "Oficina" },
] as const satisfies readonly CatalogItem[];

export const PROPERTY_CONDITIONS = [
  { key: "en-planos", label: "En planos" },
  { key: "en-construccion", label: "En construcción" },
  { key: "a-estrenar", label: "A estrenar / entrega inmediata" },
  { key: "usada", label: "Usada" },
] as const satisfies readonly CatalogItem[];

export const PROJECT_STAGES = [
  { key: "en-planos", label: "En planos" },
  { key: "en-construccion", label: "En construcción" },
  { key: "por-estrenar", label: "Por estrenar" },
] as const satisfies readonly CatalogItem[];

export const SECTORS = [
  { key: "cumbaya", label: "Cumbayá" },
  { key: "tumbaco", label: "Tumbaco" },
  { key: "nayon", label: "Nayón" },
  { key: "miravalle", label: "Miravalle" },
  { key: "puembo", label: "Puembo" },
  { key: "checa", label: "Checa" },
  { key: "pifo", label: "Pifo" },
  { key: "san-patricio", label: "San Patricio" },
  { key: "lumbisi", label: "Lumbisí" },
  { key: "ruta-viva", label: "Ruta Viva" },
] as const satisfies readonly CatalogItem[];

export const AMENITIES: AmenityItem[] = [
  { key: "sala-estar", label: "Sala de estar", icon: "fa-solid fa-couch", scope: "property" },
  {
    key: "urbanizacion-privada",
    label: "Urbanización privada",
    icon: "fa-solid fa-house-lock",
    scope: "both",
  },
  {
    key: "area-eventos",
    label: "Área de eventos",
    icon: "fa-solid fa-champagne-glasses",
    scope: "both",
  },
  { key: "area-deportiva", label: "Área deportiva", icon: "fa-solid fa-futbol", scope: "both" },
  {
    key: "ingreso-independiente",
    label: "Ingreso independiente",
    icon: "fa-solid fa-door-open",
    scope: "property",
  },
  {
    key: "parqueadero-interno",
    label: "Parqueadero interno",
    icon: "fa-solid fa-square-parking",
    scope: "both",
  },
  { key: "sala-comunal", label: "Sala comunal", icon: "fa-solid fa-people-roof", scope: "both" },
  { key: "sauna", label: "Sauna", icon: "fa-solid fa-temperature-high", scope: "both" },
  { key: "turco", label: "Turco", icon: "fa-solid fa-cloud", scope: "both" },
  { key: "piscina", label: "Piscina", icon: "fa-solid fa-person-swimming", scope: "both" },
  { key: "areas-verdes", label: "Áreas verdes", icon: "fa-solid fa-tree", scope: "both" },
  {
    key: "guardiania",
    label: "Guardianía y seguridad privada",
    icon: "fa-solid fa-shield-halved",
    scope: "both",
  },
  { key: "iluminacion", label: "Iluminación", icon: "fa-solid fa-lightbulb", scope: "property" },
  {
    key: "parqueadero-visitas",
    label: "Parqueadero de visitas",
    icon: "fa-solid fa-car",
    scope: "both",
  },
  {
    key: "aire-acondicionado",
    label: "Aire acondicionado",
    icon: "fa-solid fa-snowflake",
    scope: "property",
  },
  { key: "cortinas", label: "Cortinas", icon: "fa-solid fa-person-booth", scope: "property" },
  { key: "cisterna", label: "Cisterna", icon: "fa-solid fa-droplet", scope: "both" },
  {
    key: "extractor-olores",
    label: "Extractor de olores",
    icon: "fa-solid fa-fan",
    scope: "property",
  },
  { key: "gimnasio", label: "Gimnasio", icon: "fa-solid fa-dumbbell", scope: "both" },
  {
    key: "generador-electrico",
    label: "Generador eléctrico",
    icon: "fa-solid fa-bolt",
    scope: "both",
  },
  {
    key: "puertas-electricas",
    label: "Puertas eléctricas",
    icon: "fa-solid fa-door-closed",
    scope: "both",
  },
  { key: "parrilla", label: "Parrilla", icon: "fa-solid fa-fire-burner", scope: "property" },
  {
    key: "areas-infantiles",
    label: "Áreas infantiles",
    icon: "fa-solid fa-child-reaching",
    scope: "both",
  },
  { key: "area-bbq", label: "Área BBQ", icon: "fa-solid fa-fire", scope: "both" },
  { key: "jacuzzi", label: "Jacuzzi", icon: "fa-solid fa-hot-tub-person", scope: "both" },
  {
    key: "frente-parque",
    label: "Frente a parque",
    icon: "fa-solid fa-tree-city",
    scope: "property",
  },
  { key: "jardin", label: "Jardín", icon: "fa-solid fa-seedling", scope: "property" },
  { key: "vista", label: "Vista", icon: "fa-solid fa-mountain-sun", scope: "both" },
  { key: "ascensor", label: "Ascensor", icon: "fa-solid fa-elevator", scope: "both" },
  { key: "balcon", label: "Balcón", icon: "fa-solid fa-building", scope: "property" },
  { key: "terraza", label: "Terraza", icon: "fa-solid fa-umbrella-beach", scope: "property" },
  { key: "bodega", label: "Bodega", icon: "fa-solid fa-box-archive", scope: "property" },
  // Propios de proyectos
  {
    key: "cancha-padel",
    label: "Cancha de pádel",
    icon: "fa-solid fa-table-tennis-paddle-ball",
    scope: "project",
  },
  { key: "zonas-humedas", label: "Zonas húmedas", icon: "fa-solid fa-water", scope: "project" },
  { key: "parque-interno", label: "Parque interno", icon: "fa-solid fa-tree", scope: "project" },
  { key: "coworking", label: "Coworking", icon: "fa-solid fa-laptop", scope: "project" },
  { key: "pet-friendly", label: "Pet friendly", icon: "fa-solid fa-paw", scope: "project" },
  { key: "rooftop", label: "Rooftop", icon: "fa-solid fa-city", scope: "project" },
  {
    key: "ubicacion-estrategica",
    label: "Ubicación estratégica",
    icon: "fa-solid fa-location-dot",
    scope: "project",
  },
  { key: "lobby", label: "Lobby", icon: "fa-solid fa-bell-concierge", scope: "project" },
  {
    key: "salon-comunal",
    label: "Salón comunal",
    icon: "fa-solid fa-people-group",
    scope: "project",
  },
];

export type PropertyType = (typeof PROPERTY_TYPES)[number]["key"];
export type PropertyCondition = (typeof PROPERTY_CONDITIONS)[number]["key"];
export type ProjectStage = (typeof PROJECT_STAGES)[number]["key"];

export const PROPERTY_TYPE_KEYS = PROPERTY_TYPES.map((t) => t.key) as PropertyType[];
export const PROPERTY_CONDITION_KEYS = PROPERTY_CONDITIONS.map((c) => c.key) as PropertyCondition[];
export const PROJECT_STAGE_KEYS = PROJECT_STAGES.map((s) => s.key) as ProjectStage[];
export const SECTOR_KEYS: string[] = SECTORS.map((s) => s.key);
export const AMENITY_KEYS: string[] = AMENITIES.map((a) => a.key);

export const PROPERTY_STATUSES = ["draft", "published", "sold", "hidden"] as const;
export const PROJECT_STATUSES = ["draft", "published", "sold-out", "hidden"] as const;
export const UNIT_STATUSES = ["available", "reserved", "sold"] as const;
export const LEAD_KINDS = [
  "property",
  "project",
  "unit",
  "sell",
  "general",
  "work-with-us",
  "interested",
] as const;
export const LEAD_STATUSES = ["new", "contacted", "closed"] as const;
export const CRM_STATUSES = ["pending", "sent", "failed", "skipped"] as const;
export const POST_STATUSES = ["draft", "published"] as const;

export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type UnitStatus = (typeof UNIT_STATUSES)[number];
export type LeadKind = (typeof LEAD_KINDS)[number];
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type CrmStatus = (typeof CRM_STATUSES)[number];
export type PostStatus = (typeof POST_STATUSES)[number];

export const DEFAULT_CITY = "Quito";

export function sectorLabel(key: string): string {
  return SECTORS.find((s) => s.key === key)?.label ?? key;
}

export function propertyTypeLabel(key: string): string {
  return PROPERTY_TYPES.find((t) => t.key === key)?.label ?? key;
}
