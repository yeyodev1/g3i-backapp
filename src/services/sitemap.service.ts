import { env } from "../config/env";
import { Property } from "../models/property.model";
import { Project } from "../models/project.model";
import { Unit } from "../models/unit.model";
import { Post } from "../models/post.model";

// Páginas fijas del sitio público, con la prioridad que se sugiere a Google.
const STATIC_PAGES: [string, number][] = [
  ["/", 1],
  ["/propiedades", 0.9],
  ["/proyectos", 0.9],
  ["/mapa-del-valle", 0.7],
  ["/blog", 0.6],
  ["/preguntas-frecuentes", 0.6],
  ["/conocenos", 0.5],
  ["/contacto", 0.5],
];

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function entry(path: string, priority: number, lastmod?: Date): string {
  const loc = escapeXml(`${env.SITE_URL.replace(/\/+$/, "")}${path}`);
  const mod = lastmod ? `<lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>` : "";
  return `<url><loc>${loc}</loc>${mod}<priority>${priority.toFixed(1)}</priority></url>`;
}

/** sitemap.xml con todo lo publicado; se genera en cada pedido para estar siempre al día. */
export async function buildSitemap(): Promise<string> {
  const [properties, projects, posts] = await Promise.all([
    Property.find({ status: "published" }).select("slug updatedAt").lean(),
    Project.find({ status: "published" }).select("slug updatedAt").lean(),
    Post.find({ status: "published" }).select("slug updatedAt").lean(),
  ]);
  const units = await Unit.find({
    project: { $in: projects.map((p) => p._id) },
    status: { $in: ["available", "reserved"] },
  })
    .select("project updatedAt")
    .lean();
  const slugById = new Map(projects.map((p) => [String(p._id), p.slug]));

  const urls = [
    ...STATIC_PAGES.map(([path, priority]) => entry(path, priority)),
    ...properties.map((p: any) => entry(`/propiedades/${p.slug}`, 0.8, p.updatedAt)),
    ...projects.map((p: any) => entry(`/proyectos/${p.slug}`, 0.8, p.updatedAt)),
    ...units
      .filter((u: any) => slugById.has(String(u.project)))
      .map((u: any) => entry(`/proyectos/${slugById.get(String(u.project))}/unidades/${u._id}`, 0.6, u.updatedAt)),
    ...posts.map((p: any) => entry(`/blog/${p.slug}`, 0.6, p.updatedAt)),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`;
}
