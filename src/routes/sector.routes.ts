import { Router } from "express";
import * as sectorController from "../controllers/sector.controller";

const router = Router();

router.get("/", sectorController.list);

export default router;
