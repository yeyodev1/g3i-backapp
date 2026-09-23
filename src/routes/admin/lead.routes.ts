import { Router } from "express";
import * as leadController from "../../controllers/lead.controller";

const router = Router();

router.get("/", leadController.adminList);
router.patch("/:id", leadController.setStatus);
router.post("/:id/crm-retry", leadController.retryCrm);
router.delete("/:id", leadController.remove);

export default router;
