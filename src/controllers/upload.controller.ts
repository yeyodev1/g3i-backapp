import { Request, Response, NextFunction } from "express";
import * as uploadService from "../services/upload.service";

/** POST /api/admin/uploads?folder=properties&kind=image — multipart, campo `file`. */
export async function upload(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await uploadService.upload(req.file, req.query.folder, req.query.kind);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

/** POST /api/admin/uploads/signature — body: { folder, kind }. El archivo va directo a Cloudinary. */
export async function sign(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(201).json(uploadService.sign(req.body?.folder, req.body?.kind));
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/admin/uploads — body: { publicId, resourceType } */
export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await uploadService.remove(req.body?.publicId, req.body?.resourceType);
    res.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
}
