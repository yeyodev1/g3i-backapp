import { Router } from "express";
import * as projectController from "../../controllers/project.controller";

const router = Router();

router.put("/:unitId", projectController.updateUnit);
router.patch("/:unitId/status", projectController.setUnitStatus);
router.delete("/:unitId", projectController.removeUnit);

export default router;
