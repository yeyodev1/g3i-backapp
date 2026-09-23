import { Router } from "express";
import * as contentController from "../../controllers/content.controller";

/** FAQs, asesores, testimonios y socios: mismo CRUD bajo su propio prefijo. */
function crudRouter(handlers: typeof contentController.faqs) {
  const router = Router();
  router.get("/", handlers.list);
  router.post("/", handlers.create);
  router.put("/:id", handlers.update);
  router.delete("/:id", handlers.remove);
  return router;
}

const router = Router();

router.use("/faqs", crudRouter(contentController.faqs));
router.use("/advisors", crudRouter(contentController.advisors));
router.use("/testimonials", crudRouter(contentController.testimonials));
router.use("/partners", crudRouter(contentController.partners));

export default router;
