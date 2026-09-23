import { Router } from "express";
import * as postController from "../../controllers/post.controller";

const router = Router();

router.get("/", postController.adminList);
router.post("/", postController.create);
router.get("/:id", postController.adminGet);
router.put("/:id", postController.update);
router.delete("/:id", postController.remove);

export default router;
