import "dotenv/config";

/**
 * Único lugar que lee process.env. Leerlo en otro archivo a nivel de módulo
 * es el bug clásico de "la variable está en .env pero llega undefined".
 */

function required(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key]?.trim() || fallback;
}

function list(key: string): string[] {
  return optional(key, "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

export const env = {
  PORT: Number(optional("PORT", "8100")),
  NODE_ENV: optional("NODE_ENV", "development"),
  IS_VERCEL: Boolean(process.env.VERCEL),
  DB_URI: required("DB_URI"),
  JWT_SECRET: required("JWT_SECRET"),
  CORS_ORIGINS: list("CORS_ORIGINS"),
  FRONTEND_URL: optional("FRONTEND_URL", "http://localhost:5173"),
  SLACK_ERROR_WEBHOOK: optional("SLACK_ERROR_WEBHOOK", ""),
  ADMIN_EMAIL: optional("ADMIN_EMAIL", "admin@g3i.ec").toLowerCase(),
  ADMIN_PASSWORD: optional("ADMIN_PASSWORD", ""),
  ADMIN_NAME: optional("ADMIN_NAME", "Administración"),
  RESEND_API_KEY: optional("RESEND_API_KEY", ""),
  RESEND_FROM_EMAIL: optional("RESEND_FROM_EMAIL", "G3i <onboarding@resend.dev>"),
  CLOUDINARY_CLOUD_NAME: optional("CLOUDINARY_CLOUD_NAME", ""),
  CLOUDINARY_API_KEY: optional("CLOUDINARY_API_KEY", ""),
  CLOUDINARY_API_SECRET: optional("CLOUDINARY_API_SECRET", ""),
  CRON_SECRET: optional("CRON_SECRET", ""),
  SITE_URL: optional("SITE_URL", "https://g3i.ec"),
  // A quién se avisa por correo cuando entra un formulario.
  NOTIFY_EMAIL: optional("NOTIFY_EMAIL", ""),
  // CRM: "kommo" usa la API v4; si hay CRM_WEBHOOK_URL se hace POST del lead.
  CRM_PROVIDER: optional("CRM_PROVIDER", ""),
  KOMMO_SUBDOMAIN: optional("KOMMO_SUBDOMAIN", ""),
  KOMMO_ACCESS_TOKEN: optional("KOMMO_ACCESS_TOKEN", ""),
  KOMMO_PIPELINE_ID: optional("KOMMO_PIPELINE_ID", ""),
  CRM_WEBHOOK_URL: optional("CRM_WEBHOOK_URL", ""),
} as const;
