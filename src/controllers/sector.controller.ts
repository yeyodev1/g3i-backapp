import { Request, Response, NextFunction } from "express";
import * as sectorService from "../services/sector.service";

/** GET /api/sectors?active=true */
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const onlyActive = req.query.active === "true" || req.query.active === "1";
    res.status(200).json(await sectorService.listSectors(onlyActive));
  } catch (error) {
    next(error);
  }
}
