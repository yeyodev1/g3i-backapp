import { Request, Response, NextFunction } from "express";
import * as siteService from "../services/site.service";
import * as settingsService from "../services/settings.service";

/** GET /api/site */
export async function getSite(_req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await siteService.getSite());
  } catch (error) {
    next(error);
  }
}

/** GET /api/admin/settings */
export async function getSettings(_req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await settingsService.getSettings());
  } catch (error) {
    next(error);
  }
}

/** PUT /api/admin/settings */
export async function updateSettings(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await settingsService.updateSettings(req.body ?? {}));
  } catch (error) {
    next(error);
  }
}
