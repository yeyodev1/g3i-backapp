import { Router } from "express";
import * as postController from "../controllers/post.controller";

const router = Router();

router.get("/", postController.list);
router.get("/:slug", postController.getBySlug);

export default router;
