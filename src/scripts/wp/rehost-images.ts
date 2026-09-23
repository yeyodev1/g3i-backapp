/**
 * Sube a Cloudinary las imágenes que siguen apuntando a g3i.ec (las que el
 * import dejó con `publicId: ""` porque Cloudinary no estaba configurado) y
 * reemplaza la URL en el documento.
 *
 * Idempotente: solo toca imágenes con publicId vacío y URL de g3i.ec, así que
 * correrlo de nuevo continúa donde quedó (útil si se corta a la mitad).
 *
 * Uso: pnpm migrate:images [--dry-run]
 */
import "dotenv/config";
import mongoose from "mongoose";
import { dbConnect } from "../../config/mongo";
import { Advisor } from "../../models/advisor.model";
import { Post } from "../../models/post.model";
import { Project } from "../../models/project.model";
import { Property } from "../../models/property.model";
import { Testimonial } from "../../models/testimonial.model";
import { Unit } from "../../models/unit.model";
import { isCloudinaryConfigured, uploadImage } from "../../services/cloudinary.service";

const DRY_RUN = process.argv.includes("--dry-run");

type Img = { url: string; publicId?: string; alt?: string };

let uploaded = 0;
let failed = 0;
let pending = 0;

function needsRehost(img: Img | null | undefined): img is Img {
  return !!img && !img.publicId && /^https?:\/\/(www\.)?g3i\.ec\//i.test(img.url);
}

/** Devuelve la imagen subida, o la misma si falla (se reintenta en la próxima corrida). */
async function rehost(img: Img, folder: string): Promise<Img> {
  pending++;
  if (DRY_RUN) return img;
  try {
    const up = await uploadImage(img.url, folder);
    uploaded++;
    return { url: up.url, publicId: up.publicId, alt: img.alt ?? "" };
  } catch (error) {
    failed++;
    console.warn(`  ! ${img.url}: ${(error as Error).message}`);
    return img;
  }
}

async function rehostList(list: Img[], folder: string): Promise<{ list: Img[]; changed: boolean }> {
  let changed = false;
  const out: Img[] = [];
  for (const img of list) {
    if (needsRehost(img)) {
      const next = await rehost(img, folder);
      changed ||= next.url !== img.url;
      out.push(next);
    } else {
      out.push(img);
    }
  }
  return { list: out, changed };
}

async function main() {
  if (!isCloudinaryConfigured()) {
    console.error(
      "✖ Cloudinary no está configurado. Define CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en .env y vuelve a correr pnpm migrate:images.",
    );
    process.exit(1);
  }
  await dbConnect();

  // Se guarda documento por documento: si el proceso se corta, lo subido no se pierde.
  for (const doc of await Property.find({ "images.publicId": "" })) {
    const { list, changed } = await rehostList(doc.images, `g3i/properties/${doc.slug}`);
    const plans = await rehostList(doc.floorPlans, `g3i/properties/${doc.slug}/planos`);
    if (changed || plans.changed) {
      doc.set({ images: list, floorPlans: plans.list });
      await doc.save();
      console.log(`  ✔ propiedad ${doc.code ?? ""} ${doc.title}`);
    }
  }

  for (const doc of await Project.find({ "images.publicId": "" })) {
    const { list, changed } = await rehostList(doc.images, `g3i/projects/${doc.slug}`);
    if (changed) {
      doc.set({ images: list });
      await doc.save();
      console.log(`  ✔ proyecto ${doc.code ?? ""} ${doc.title}`);
    }
  }

  for (const doc of await Unit.find({ $or: [{ "images.publicId": "" }, { "floorPlan.publicId": "" }] })) {
    const folder = `g3i/projects/units/${doc._id}`;
    const { list, changed } = await rehostList(doc.images, folder);
    const plan = needsRehost(doc.floorPlan) ? await rehost(doc.floorPlan, folder) : doc.floorPlan;
    if (changed || plan !== doc.floorPlan) {
      doc.set({ images: list, floorPlan: plan });
      await doc.save();
      console.log(`  ✔ unidad ${doc.name}`);
    }
  }

  for (const doc of await Advisor.find({ "photo.publicId": "" })) {
    if (!needsRehost(doc.photo)) continue;
    const photo = await rehost(doc.photo, "g3i/team");
    if (photo.url !== doc.photo.url) {
      doc.set({ photo });
      await doc.save();
      console.log(`  ✔ asesor ${doc.name}`);
    }
  }

  for (const doc of await Testimonial.find({ "photo.publicId": "" })) {
    if (!needsRehost(doc.photo)) continue;
    const photo = await rehost(doc.photo, "g3i/team");
    if (photo.url !== doc.photo.url) {
      doc.set({ photo });
      await doc.save();
      console.log(`  ✔ testimonio ${doc.name}`);
    }
  }

  for (const doc of await Post.find({ "cover.publicId": "" })) {
    if (!needsRehost(doc.cover)) continue;
    const cover = await rehost(doc.cover, `g3i/posts/${doc.slug}`);
    if (cover.url !== doc.cover.url) {
      doc.set({ cover });
      await doc.save();
      console.log(`  ✔ post ${doc.title}`);
    }
  }

  console.log(
    DRY_RUN
      ? `\nDRY RUN: ${pending} imágenes por subir.`
      : `\nListo: ${uploaded} subidas, ${failed} fallidas (vuelve a correrlo para reintentar las fallidas).`,
  );
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("✖ Falló el rehost de imágenes:", error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
