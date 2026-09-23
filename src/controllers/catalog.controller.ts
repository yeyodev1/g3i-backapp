import { Request, Response, NextFunction } from "express";
import * as catalogService from "../services/catalog.service";

/** GET /api/catalogs */
export function getCatalogs(_req: Request, res: Response, next: NextFunction) {
  try {
    // Los catálogos cambian solo con un deploy: se pueden cachear.
    res.setHeader("Cache-Control", "public, max-age=300");
    res.status(200).json(catalogService.getCatalogs());
  } catch (error) {
    next(error);
  }
}
