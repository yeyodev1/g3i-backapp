import { Request, Response, NextFunction } from "express";
import * as contentService from "../services/content.service";

type Crud = typeof contentService.faqs;

/**
 * Handlers admin para los contenidos simples (FAQs, asesores, testimonios,
 * socios). Todos exponen la misma forma: list, create, update, remove.
 */
function handlers(service: Crud) {
  return {
    async list(_req: Request, res: Response, next: NextFunction) {
      try {
        res.status(200).json(await service.list());
      } catch (error) {
        next(error);
      }
    },
    async create(req: Request, res: Response, next: NextFunction) {
      try {
        res.status(201).json(await service.create(req.body ?? {}));
      } catch (error) {
        next(error);
      }
    },
    async update(req: Request, res: Response, next: NextFunction) {
      try {
        res.status(200).json(await service.update(String(req.params.id), req.body ?? {}));
      } catch (error) {
        next(error);
      }
    },
    async remove(req: Request, res: Response, next: NextFunction) {
      try {
        res.status(200).json(await service.remove(String(req.params.id)));
      } catch (error) {
        next(error);
      }
    },
  };
}

export const faqs = handlers(contentService.faqs);
export const advisors = handlers(contentService.advisors);
export const testimonials = handlers(contentService.testimonials);
export const partners = handlers(contentService.partners);
