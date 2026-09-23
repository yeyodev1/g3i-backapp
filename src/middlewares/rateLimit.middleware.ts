import { Request, Response, NextFunction } from "express";

/**
 * Rate limit en memoria por IP, ventana fija.
 *
 * En Vercel cada instancia tiene su propio contador, así que el tope es
 * aproximado; alcanza para frenar un bot que martilla el formulario.
 */
export function rateLimit(options: { windowMs: number; max: number; message?: string }) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const ip = clientIp(req);

    // Limpieza perezosa para que el Map no crezca sin fin.
    if (hits.size > 5000) {
      for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
    }

    const entry = hits.get(ip);
    if (!entry || entry.resetAt <= now) {
      hits.set(ip, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    entry.count += 1;
    if (entry.count > options.max) {
      res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
      res.status(429).json({
        message: options.message || "Demasiadas solicitudes, intenta de nuevo en unos minutos",
      });
      return;
    }
    next();
  };
}

export function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  return (first || req.ip || req.socket.remoteAddress || "unknown").trim();
}
