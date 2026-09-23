import { Router } from "express";
import { mediaFileMiddleware } from "../../middlewares/mediaUpload.middleware";
import * as uploadController from "../../controllers/upload.controller";

const router = Router();

router.post("/", mediaFileMiddleware, uploadController.upload);
router.delete("/", uploadController.remove);

export default router;
