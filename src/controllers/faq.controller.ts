import { Request, Response, NextFunction } from "express";
import * as contentService from "../services/content.service";

/** GET /api/faqs — solo publicadas. */
export async function list(_req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await contentService.publishedFaqs());
  } catch (error) {
    next(error);
  }
}
