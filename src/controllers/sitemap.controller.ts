import { Request, Response, NextFunction } from "express";
import * as sitemapService from "../services/sitemap.service";

/** GET /api/sitemap.xml — el frontend lo sirve en /sitemap.xml vía rewrite de Vercel. */
export async function get(_req: Request, res: Response, next: NextFunction) {
  try {
    const xml = await sitemapService.buildSitemap();
    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Cache-Control", "public, max-age=3600");
    res.status(200).send(xml);
  } catch (error) {
    next(error);
  }
}
