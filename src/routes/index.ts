import express, { Application } from "express";
import authRoutes from "./auth.routes";
import healthRoutes from "./health.routes";
import catalogRoutes from "./catalog.routes";
import sectorRoutes from "./sector.routes";
import siteRoutes from "./site.routes";
import propertyRoutes from "./property.routes";
import projectRoutes from "./project.routes";
import mapRoutes from "./map.routes";
import postRoutes from "./post.routes";
import faqRoutes from "./faq.routes";
import leadRoutes from "./lead.routes";
import adminRoutes from "./admin.routes";
import sitemapRoutes from "./sitemap.routes";

function routerApi(app: Application) {
  const router = express.Router();
  app.use("/api", router);

  router.use("/health", healthRoutes);
  router.use("/auth", authRoutes);

  // Público
  router.use("/catalogs", catalogRoutes);
  router.use("/sectors", sectorRoutes);
  router.use("/site", siteRoutes);
  router.use("/properties", propertyRoutes);
  router.use("/projects", projectRoutes);
  router.use("/map", mapRoutes);
  router.use("/posts", postRoutes);
  router.use("/faqs", faqRoutes);
  router.use("/leads", leadRoutes);
  router.use("/sitemap.xml", sitemapRoutes);

  // Portal de administración (auth + admin dentro del router)
  router.use("/admin", adminRoutes);
}

export default routerApi;
