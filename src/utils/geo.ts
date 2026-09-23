import crypto from "crypto";

const METERS_PER_DEGREE_LAT = 111320;

/**
 * Desplaza una coordenada entre 150 y 350 m en una dirección derivada del id.
 *
 * Es determinista a propósito: si fuera aleatorio, recargar el mapa varias
 * veces y promediar revelaría la ubicación real.
 */
export function obfuscateCoords(
  id: string,
  lat: number,
  lng: number,
): { lat: number; lng: number } {
  const hash = crypto.createHash("sha256").update(`g3i:${id}`).digest();
  const angle = (hash.readUInt16BE(0) / 65535) * 2 * Math.PI;
  const distance = 150 + (hash.readUInt16BE(2) / 65535) * 200;

  const dLat = (distance * Math.cos(angle)) / METERS_PER_DEGREE_LAT;
  const cosLat = Math.cos((lat * Math.PI) / 180) || 1;
  const dLng = (distance * Math.sin(angle)) / (METERS_PER_DEGREE_LAT * cosLat);

  return {
    lat: Number((lat + dLat).toFixed(6)),
    lng: Number((lng + dLng).toFixed(6)),
  };
}

/** Location tal como la ve el público. */
export function publicLocation(
  id: string,
  location:
    { lat: number | null; lng: number | null; exact: boolean; radiusMeters: number } | undefined,
) {
  const loc = location ?? { lat: null, lng: null, exact: false, radiusMeters: 400 };
  if (loc.lat === null || loc.lng === null || loc.lat === undefined || loc.lng === undefined) {
    return { lat: null, lng: null, exact: !!loc.exact, radiusMeters: loc.radiusMeters || 400 };
  }
  if (loc.exact) {
    return { lat: loc.lat, lng: loc.lng, exact: true, radiusMeters: loc.radiusMeters || 400 };
  }
  const shifted = obfuscateCoords(id, loc.lat, loc.lng);
  return { ...shifted, exact: false, radiusMeters: loc.radiusMeters || 400 };
}
