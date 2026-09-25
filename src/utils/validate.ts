import mongoose from "mongoose";
import { CustomError } from "../errors/customError.error";

/**
 * Normalizadores de payload. No hay zod en el proyecto: cada service arma su
 * objeto a partir de una whitelist usando estas funciones, así nada que no
 * esté previsto (views, _id, createdAt) llega a Mongo desde el cliente.
 */

export interface Image {
  url: string;
  publicId: string;
  alt?: string;
}

export interface Video {
  url: string;
  publicId: string;
}

export interface Location {
  lat: number | null;
  lng: number | null;
  exact: boolean;
  radiusMeters: number;
}

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function has(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

export function str(value: unknown, max = 20000): string {
  if (value === null || value === undefined) return "";
  return String(value).trim().slice(0, max);
}

export function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function num(value: unknown, fallback = 0): number {
  const n = numOrNull(value);
  return n === null ? fallback : n;
}

/** Precio en USD enteros, nunca negativo. */
export function price(value: unknown): number {
  return Math.max(0, Math.round(num(value, 0)));
}

export function priceOrNull(value: unknown): number | null {
  const n = numOrNull(value);
  return n === null ? null : Math.max(0, Math.round(n));
}

export function bool(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  const v = str(value) as T;
  if (!allowed.includes(v)) {
    throw new CustomError(`Valor inválido para ${field}: "${v}"`, 400);
  }
  return v;
}

export function strArray(value: unknown, max = 100): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => str(v, 500))
    .filter(Boolean)
    .slice(0, max);
}

/** Como strArray pero solo con valores del catálogo; lo desconocido se descarta. */
export function catalogArray(value: unknown, allowed: readonly string[]): string[] {
  return Array.from(new Set(strArray(value).filter((v) => allowed.includes(v))));
}

export function image(value: unknown): Image | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const url = str(v.url, 2000);
  if (!url) return null;
  const result: Image = { url, publicId: str(v.publicId, 500) };
  const alt = str(v.alt, 300);
  if (alt) result.alt = alt;
  return result;
}

export function images(value: unknown, max = 50): Image[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(image)
    .filter((i): i is Image => i !== null)
    .slice(0, max);
}

export function videos(value: unknown, max = 10): Video[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      if (!v || typeof v !== "object") return null;
      const url = str((v as any).url, 2000);
      if (!url) return null;
      return { url, publicId: str((v as any).publicId, 500) };
    })
    .filter((v): v is Video => v !== null)
    .slice(0, max);
}

export function location(value: unknown): Location {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  let lat = numOrNull(v.lat);
  let lng = numOrNull(v.lng);
  if (lat !== null && (lat < -90 || lat > 90)) lat = null;
  if (lng !== null && (lng < -180 || lng > 180)) lng = null;
  // Una coordenada sin su par no sirve para el mapa.
  if (lat === null || lng === null) {
    lat = null;
    lng = null;
  }
  const radius = numOrNull(v.radiusMeters);
  return {
    lat,
    lng,
    exact: bool(v.exact),
    radiusMeters: radius && radius > 0 ? Math.min(Math.round(radius), 5000) : 400,
  };
}

export function isObjectId(value: unknown): boolean {
  return (
    typeof value === "string" && mongoose.isValidObjectId(value) && /^[a-f0-9]{24}$/i.test(value)
  );
}

export function assertObjectId(value: unknown, message = "Identificador inválido"): string {
  if (!isObjectId(value)) throw new CustomError(message, 400);
  return value as string;
}

export function objectIdOrNull(value: unknown): string | null {
  return isObjectId(value) ? (value as string) : null;
}

export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Búsqueda insensible a mayúsculas y tildes básicas sobre varios campos. */
export function textSearch(q: unknown, fields: string[]): Record<string, unknown> | null {
  const term = str(q, 100);
  if (!term) return null;
  const pattern = escapeRegex(term)
    .replace(/a/gi, "[aá]")
    .replace(/e/gi, "[eé]")
    .replace(/i/gi, "[ií]")
    .replace(/o/gi, "[oó]")
    .replace(/u/gi, "[uú]");
  const regex = new RegExp(pattern, "i");
  return { $or: fields.map((f) => ({ [f]: regex })) };
}

/** "casa,departamento" → ["casa", "departamento"] (acepta también arrays del query). */
export function listParam(value: unknown): string[] {
  const raw = Array.isArray(value) ? value.join(",") : str(value, 500);
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * Posición entre las destacadas (1 = primera). Sin número va al final (999):
 * así las que la inmobiliaria ordena salen antes que las que solo marcó.
 */
export function featuredOrder(value: unknown): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 999) : 999;
}
