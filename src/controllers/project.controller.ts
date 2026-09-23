import { Request, Response, NextFunction } from "express";
import * as projectService from "../services/project.service";

type Query = Record<string, any>;

/** GET /api/projects */
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await projectService.listPublic(req.query as Query));
  } catch (error) {
    next(error);
  }
}

/** GET /api/projects/:slug */
export async function getBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await projectService.getPublicBySlug(String(req.params.slug)));
  } catch (error) {
    next(error);
  }
}

/** GET /api/projects/:slug/related */
export async function related(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await projectService.relatedPublic(String(req.params.slug)));
  } catch (error) {
    next(error);
  }
}

/** GET /api/projects/:slug/units/:unitId */
export async function getUnit(req: Request, res: Response, next: NextFunction) {
  try {
    res
      .status(200)
      .json(await projectService.getPublicUnit(String(req.params.slug), String(req.params.unitId)));
  } catch (error) {
    next(error);
  }
}

/** GET /api/admin/projects */
export async function adminList(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await projectService.adminList(req.query as Query));
  } catch (error) {
    next(error);
  }
}

/** GET /api/admin/projects/:id */
export async function adminGet(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await projectService.adminGet(String(req.params.id)));
  } catch (error) {
    next(error);
  }
}

/** POST /api/admin/projects */
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await projectService.create(req.body ?? {}));
  } catch (error) {
    next(error);
  }
}

/** PUT /api/admin/projects/:id */
export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await projectService.update(String(req.params.id), req.body ?? {}));
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/admin/projects/:id/status — body: { status } */
export async function setStatus(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await projectService.setStatus(String(req.params.id), req.body?.status));
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/admin/projects/:id/featured — body: { isFeatured, featuredOrder } */
export async function setFeatured(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await projectService.setFeatured(String(req.params.id), req.body ?? {}));
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/admin/projects/:id */
export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await projectService.remove(String(req.params.id)));
  } catch (error) {
    next(error);
  }
}

/** GET /api/admin/projects/:id/units */
export async function listUnits(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await projectService.listUnits(String(req.params.id)));
  } catch (error) {
    next(error);
  }
}

/** POST /api/admin/projects/:id/units */
export async function createUnit(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await projectService.createUnit(String(req.params.id), req.body ?? {}));
  } catch (error) {
    next(error);
  }
}

/** PUT /api/admin/units/:unitId */
export async function updateUnit(req: Request, res: Response, next: NextFunction) {
  try {
    res
      .status(200)
      .json(await projectService.updateUnit(String(req.params.unitId), req.body ?? {}));
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/admin/units/:unitId/status — body: { status } */
export async function setUnitStatus(req: Request, res: Response, next: NextFunction) {
  try {
    res
      .status(200)
      .json(await projectService.setUnitStatus(String(req.params.unitId), req.body?.status));
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/admin/units/:unitId */
export async function removeUnit(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await projectService.removeUnit(String(req.params.unitId)));
  } catch (error) {
    next(error);
  }
}
