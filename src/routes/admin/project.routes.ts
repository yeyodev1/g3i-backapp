import { Router } from "express";
import * as projectController from "../../controllers/project.controller";

const router = Router();

router.get("/", projectController.adminList);
router.post("/", projectController.create);
router.get("/:id", projectController.adminGet);
router.put("/:id", projectController.update);
router.patch("/:id/status", projectController.setStatus);
router.patch("/:id/featured", projectController.setFeatured);
router.delete("/:id", projectController.remove);
router.get("/:id/units", projectController.listUnits);
router.post("/:id/units", projectController.createUnit);

export default router;
