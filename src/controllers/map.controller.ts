import { Request, Response, NextFunction } from "express";
import * as mapService from "../services/map.service";

/** GET /api/map */
export async function getPins(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await mapService.getPins(req.query as Record<string, any>));
  } catch (error) {
    next(error);
  }
}
