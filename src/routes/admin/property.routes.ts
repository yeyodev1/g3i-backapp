import { Router } from "express";
import * as propertyController from "../../controllers/property.controller";

const router = Router();

router.get("/", propertyController.adminList);
router.post("/", propertyController.create);
router.get("/:id", propertyController.adminGet);
router.put("/:id", propertyController.update);
router.patch("/:id/status", propertyController.setStatus);
router.patch("/:id/featured", propertyController.setFeatured);
router.delete("/:id", propertyController.remove);

export default router;
