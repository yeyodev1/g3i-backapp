import { Router } from "express";
import { rateLimit } from "../middlewares/rateLimit.middleware";
import * as leadController from "../controllers/lead.controller";

const router = Router();

const leadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: "Recibimos muchos mensajes desde tu conexión. Intenta de nuevo en unos minutos.",
});

router.post("/", leadLimiter, leadController.create);

export default router;
