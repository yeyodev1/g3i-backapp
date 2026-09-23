import { Router } from "express";
import * as mapController from "../controllers/map.controller";

const router = Router();

router.get("/", mapController.getPins);

export default router;
