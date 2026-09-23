import { Router } from "express";
import * as sitemapController from "../controllers/sitemap.controller";

const router = Router();

router.get("/", sitemapController.get);

export default router;
