import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { adminMiddleware } from "../middlewares/admin.middleware";
import * as dashboardController from "../controllers/dashboard.controller";
import * as siteController from "../controllers/site.controller";
import adminPropertyRoutes from "./admin/property.routes";
import adminProjectRoutes from "./admin/project.routes";
import adminUnitRoutes from "./admin/unit.routes";
import adminPostRoutes from "./admin/post.routes";
import adminContentRoutes from "./admin/content.routes";
import adminLeadRoutes from "./admin/lead.routes";
import adminUploadRoutes from "./admin/upload.routes";

const router = Router();

router.use(authMiddleware, adminMiddleware);

router.get("/dashboard", dashboardController.get);
router.get("/settings", siteController.getSettings);
router.put("/settings", siteController.updateSettings);

router.use("/properties", adminPropertyRoutes);
router.use("/projects", adminProjectRoutes);
router.use("/units", adminUnitRoutes);
router.use("/posts", adminPostRoutes);
router.use("/leads", adminLeadRoutes);
router.use("/uploads", adminUploadRoutes);
router.use("/", adminContentRoutes);

export default router;
