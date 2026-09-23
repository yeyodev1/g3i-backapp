import { Request, Response, NextFunction } from "express";
import * as propertyService from "../services/property.service";

type Query = Record<string, any>;

/** GET /api/properties */
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await propertyService.listPublic(req.query as Query));
  } catch (error) {
    next(error);
  }
}

/** GET /api/properties/:slug */
export async function getBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await propertyService.getPublicBySlug(String(req.params.slug)));
  } catch (error) {
    next(error);
  }
}

/** GET /api/properties/:slug/related */
export async function related(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await propertyService.relatedPublic(String(req.params.slug)));
  } catch (error) {
    next(error);
  }
}

/** GET /api/admin/properties */
export async function adminList(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await propertyService.adminList(req.query as Query));
  } catch (error) {
    next(error);
  }
}

/** GET /api/admin/properties/:id */
export async function adminGet(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await propertyService.adminGet(String(req.params.id)));
  } catch (error) {
    next(error);
  }
}

/** POST /api/admin/properties */
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await propertyService.create(req.body ?? {}));
  } catch (error) {
    next(error);
  }
}

/** PUT /api/admin/properties/:id */
export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await propertyService.update(String(req.params.id), req.body ?? {}));
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/admin/properties/:id/status — body: { status } */
export async function setStatus(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await propertyService.setStatus(String(req.params.id), req.body?.status));
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/admin/properties/:id/featured — body: { isFeatured, featuredOrder } */
export async function setFeatured(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await propertyService.setFeatured(String(req.params.id), req.body ?? {}));
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/admin/properties/:id */
export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await propertyService.remove(String(req.params.id)));
  } catch (error) {
    next(error);
  }
}
