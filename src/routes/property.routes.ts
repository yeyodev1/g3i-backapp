import { Router } from "express";
import * as propertyController from "../controllers/property.controller";

const router = Router();

router.get("/", propertyController.list);
router.get("/:slug", propertyController.getBySlug);
router.get("/:slug/related", propertyController.related);

export default router;
