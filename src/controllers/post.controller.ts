import { Request, Response, NextFunction } from "express";
import * as postService from "../services/post.service";

type Query = Record<string, any>;

/** GET /api/posts */
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await postService.listPublic(req.query as Query));
  } catch (error) {
    next(error);
  }
}

/** GET /api/posts/:slug */
export async function getBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await postService.getPublicBySlug(String(req.params.slug)));
  } catch (error) {
    next(error);
  }
}

/** GET /api/admin/posts */
export async function adminList(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await postService.adminList(req.query as Query));
  } catch (error) {
    next(error);
  }
}

/** GET /api/admin/posts/:id */
export async function adminGet(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await postService.adminGet(String(req.params.id)));
  } catch (error) {
    next(error);
  }
}

/** POST /api/admin/posts */
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await postService.create(req.body ?? {}));
  } catch (error) {
    next(error);
  }
}

/** PUT /api/admin/posts/:id */
export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await postService.update(String(req.params.id), req.body ?? {}));
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/admin/posts/:id */
export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await postService.remove(String(req.params.id)));
  } catch (error) {
    next(error);
  }
}
