import { CustomError } from "../errors/customError.error";
import {
  deleteAsset,
  isCloudinaryConfigured,
  ResourceType,
  uploadBuffer,
} from "./cloudinary.service";

const MB = 1024 * 1024;

const RULES: Record<ResourceType, { maxBytes: number; mimes: RegExp; label: string }> = {
  image: {
    maxBytes: 10 * MB,
    mimes: /^image\/(jpeg|png|webp|gif|avif|svg\+xml)$/,
    label: "imagen",
  },
  video: { maxBytes: 100 * MB, mimes: /^video\//, label: "video" },
  raw: { maxBytes: 20 * MB, mimes: /^application\/pdf$/, label: "PDF" },
};

const ROOT_FOLDER = "g3i";
const RESOURCE_TYPES: ResourceType[] = ["image", "video", "raw"];

export interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname?: string;
}

function requireCloudinary() {
  if (!isCloudinaryConfigured()) {
    throw new CustomError(
      "La subida de archivos no está disponible: falta configurar Cloudinary en el servidor",
      503,
    );
  }
}

export function parseResourceType(value: unknown): ResourceType {
  const kind = String(value || "image");
  if (!RESOURCE_TYPES.includes(kind as ResourceType)) {
    throw new CustomError("El tipo de archivo debe ser image, video o raw", 400);
  }
  return kind as ResourceType;
}

/** Carpeta dentro de g3i/: solo letras, números y guiones para no crear rutas raras. */
function safeFolder(value: unknown): string {
  const folder = String(value || "misc")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 40);
  return `${ROOT_FOLDER}/${folder || "misc"}`;
}

export async function upload(
  file: UploadedFile | undefined,
  folder: unknown,
  kind: unknown,
): Promise<{ url: string; publicId: string; resourceType: ResourceType }> {
  requireCloudinary();
  if (!file || !file.buffer)
    throw new CustomError("No se recibió ningún archivo (campo file)", 400);

  const resourceType = parseResourceType(kind);
  const rule = RULES[resourceType];
  if (!rule.mimes.test(file.mimetype)) {
    throw new CustomError(`El archivo no es un ${rule.label} válido (${file.mimetype})`, 400);
  }
  if (file.size > rule.maxBytes) {
    throw new CustomError(
      `El ${rule.label} supera el límite de ${Math.round(rule.maxBytes / MB)} MB`,
      400,
    );
  }

  try {
    return await uploadBuffer(file.buffer, safeFolder(folder), resourceType);
  } catch (error: any) {
    console.error("[upload] Cloudinary rechazó el archivo:", error?.message || error);
    throw new CustomError("No se pudo subir el archivo, intenta de nuevo", 502);
  }
}

export async function remove(publicId: unknown, kind: unknown): Promise<void> {
  requireCloudinary();
  const id = String(publicId || "").trim();
  if (!id) throw new CustomError("Falta el publicId del archivo", 400);
  await deleteAsset(id, parseResourceType(kind));
}

export interface AssetRef {
  publicId?: string;
  resourceType: ResourceType;
}

/**
 * Borra en lote los archivos de un inmueble eliminado. Nunca lanza: el
 * documento ya se borró y un archivo huérfano en Cloudinary es preferible a
 * un error al usuario. Las URLs migradas llegan con publicId vacío y se saltan.
 */
export async function cleanupAssets(assets: AssetRef[]): Promise<void> {
  const targets = assets.filter((a) => a.publicId && a.publicId.trim());
  if (!targets.length) return;
  if (!isCloudinaryConfigured()) {
    console.warn(
      `[upload] Cloudinary no configurado — ${targets.length} archivo(s) quedan sin borrar`,
    );
    return;
  }
  await Promise.all(
    targets.map(async (a) => {
      try {
        await deleteAsset(a.publicId as string, a.resourceType);
      } catch (error: any) {
        console.error(`[upload] no se pudo borrar ${a.publicId}:`, error?.message || error);
      }
    }),
  );
}

/** Tipo de recurso de un video guardado: los de YouTube no tienen publicId y se ignoran. */
export function videoAssets(list: { publicId?: string }[] = []): AssetRef[] {
  return list.map((v) => ({ publicId: v.publicId, resourceType: "video" as const }));
}

export function imageAssets(list: ({ publicId?: string } | null | undefined)[] = []): AssetRef[] {
  return list
    .filter((i): i is { publicId?: string } => !!i)
    .map((i) => ({ publicId: i.publicId, resourceType: "image" as const }));
}
