import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import { env } from "../config/env";
import { CustomError } from "../errors/customError.error";

let configured = false;

export function isCloudinaryConfigured(): boolean {
  return !!(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

function ensureConfig() {
  if (configured) return;
  if (!isCloudinaryConfigured()) {
    throw new CustomError("Cloudinary no está configurado en el servidor", 503);
  }
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
  configured = true;
}

const DEFAULT_FOLDER = "g3i-backapp";

export type ResourceType = "image" | "video" | "raw";

/**
 * Sube un buffer (multer memoryStorage). Las imágenes se optimizan al vuelo;
 * video y raw (PDF) se suben tal cual porque la transformación los rompería.
 */
export function uploadBuffer(
  buffer: Buffer,
  folder = DEFAULT_FOLDER,
  resourceType: ResourceType = "image",
): Promise<{ url: string; publicId: string; resourceType: ResourceType }> {
  ensureConfig();
  const options: Record<string, unknown> = { folder, resource_type: resourceType };
  if (resourceType === "image") {
    options.transformation = [{ quality: "auto", fetch_format: "auto" }];
  }
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      options,
      (error, result?: UploadApiResponse) => {
        if (error || !result) return reject(error || new Error("Cloudinary sin respuesta"));
        resolve({ url: result.secure_url, publicId: result.public_id, resourceType });
      },
    );
    stream.end(buffer);
  });
}

/** Sube un data URI base64 o una URL remota. */
export async function uploadImage(
  source: string,
  folder = DEFAULT_FOLDER,
): Promise<{ url: string; publicId: string }> {
  ensureConfig();
  const result = await cloudinary.uploader.upload(source, {
    folder,
    resource_type: "image",
    transformation: [{ quality: "auto", fetch_format: "auto" }],
  });
  return { url: result.secure_url, publicId: result.public_id };
}

export async function deleteImage(publicId: string): Promise<void> {
  ensureConfig();
  await cloudinary.uploader.destroy(publicId);
}

export async function deleteAsset(
  publicId: string,
  resourceType: ResourceType = "image",
): Promise<void> {
  ensureConfig();
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true });
}
