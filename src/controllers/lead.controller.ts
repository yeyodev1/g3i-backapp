import { Request, Response, NextFunction } from "express";
import { clientIp } from "../middlewares/rateLimit.middleware";
import * as leadService from "../services/lead.service";

/** POST /api/leads */
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await leadService.create(req.body ?? {}, clientIp(req)));
  } catch (error) {
    next(error);
  }
}

/** GET /api/admin/leads?kind&status&page */
export async function adminList(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await leadService.adminList(req.query as Record<string, any>));
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/admin/leads/:id — body: { status } */
export async function setStatus(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await leadService.setStatus(String(req.params.id), req.body?.status));
  } catch (error) {
    next(error);
  }
}

/** POST /api/admin/leads/:id/crm-retry */
export async function retryCrm(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await leadService.retryCrm(String(req.params.id)));
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/admin/leads/:id */
export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await leadService.remove(String(req.params.id)));
  } catch (error) {
    next(error);
  }
}
