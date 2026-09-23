import { Router } from "express";
import * as siteController from "../controllers/site.controller";

const router = Router();

router.get("/", siteController.getSite);

export default router;
