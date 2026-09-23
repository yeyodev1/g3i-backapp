import { Router } from "express";
import * as faqController from "../controllers/faq.controller";

const router = Router();

router.get("/", faqController.list);

export default router;
