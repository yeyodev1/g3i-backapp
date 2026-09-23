import { Router } from "express";
import * as projectController from "../controllers/project.controller";

const router = Router();

router.get("/", projectController.list);
router.get("/:slug", projectController.getBySlug);
router.get("/:slug/related", projectController.related);
router.get("/:slug/units/:unitId", projectController.getUnit);

export default router;
