import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { CustomError } from "../errors/customError.error";

/**
 * Instancia propia para /admin/uploads con el tope del caso más grande
 * (video, 100 MB). El límite real por tipo (imagen 10 MB, PDF 20 MB) lo
 * valida upload.service, que sí sabe qué se está subiendo.
 */
const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
});

/** Campo `file`, con los errores de multer traducidos a 400 en español. */
export function mediaFileMiddleware(req: Request, res: Response, next: NextFunction) {
  mediaUpload.single("file")(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? "El archivo supera el límite de 100 MB"
          : `No se pudo leer el archivo (${error.code})`;
      next(new CustomError(message, 400));
      return;
    }
    next(error as Error | undefined);
  });
}
