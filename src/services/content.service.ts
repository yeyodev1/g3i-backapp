import { Model } from "mongoose";
import { CustomError } from "../errors/customError.error";
import { Advisor } from "../models/advisor.model";
import { Faq } from "../models/faq.model";
import { Partner } from "../models/partner.model";
import { Testimonial } from "../models/testimonial.model";
import { assertObjectId, bool, EMAIL_REGEX, has, image, num, str } from "../utils/validate";

/**
 * CRUD de los contenidos simples del sitio (FAQs, asesores, testimonios,
 * socios). Todos comparten forma: lista ordenada por `order`, whitelist de
 * campos y un campo requerido.
 */
interface ContentConfig {
  model: Model<any>;
  label: string;
  required: string;
  build: (body: Record<string, any>) => Record<string, unknown>;
}

function makeCrud({ model, label, required, build }: ContentConfig) {
  return {
    async list() {
      return model.find().sort({ order: 1, createdAt: 1 }).lean();
    },
    async create(body: Record<string, any>) {
      const data = build(body ?? {});
      if (!data[required]) throw new CustomError(`Falta el campo obligatorio (${required})`, 400);
      if (!has(body ?? {}, "order")) data.order = await model.countDocuments();
      return model.create(data);
    },
    async update(id: string, body: Record<string, any>) {
      assertObjectId(id);
      const data = build(body ?? {});
      if (has(body ?? {}, required) && !data[required]) {
        throw new CustomError(`El campo ${required} no puede quedar vacío`, 400);
      }
      const doc = await model
        .findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true })
        .lean();
      if (!doc) throw new CustomError(`${label} no encontrado`, 404);
      return doc;
    },
    async remove(id: string) {
      assertObjectId(id);
      const doc = await model.findByIdAndDelete(id).lean();
      if (!doc) throw new CustomError(`${label} no encontrado`, 404);
      return { ok: true };
    },
  };
}

function pick(body: Record<string, any>, spec: Record<string, (v: unknown) => unknown>) {
  const data: Record<string, unknown> = {};
  for (const [key, fn] of Object.entries(spec)) if (has(body, key)) data[key] = fn(body[key]);
  return data;
}

const text = (max: number) => (v: unknown) => str(v, max);
const order = (v: unknown) => num(v);

export const faqs = makeCrud({
  model: Faq,
  label: "Pregunta",
  required: "question",
  build: (b) => pick(b, { question: text(300), answer: text(5000), order, isPublished: bool }),
});

export const advisors = makeCrud({
  model: Advisor,
  label: "Asesor",
  required: "name",
  build: (b) => {
    const data = pick(b, {
      name: text(120),
      role: text(120),
      photo: image,
      bio: text(2000),
      phone: text(40),
      email: (v) => str(v, 200).toLowerCase(),
      order,
      isActive: bool,
    });
    if (data.email && !EMAIL_REGEX.test(data.email as string)) {
      throw new CustomError("El correo del asesor no es válido", 400);
    }
    return data;
  },
});

export const testimonials = makeCrud({
  model: Testimonial,
  label: "Testimonio",
  required: "name",
  build: (b) =>
    pick(b, {
      name: text(120),
      text: text(2000),
      photo: image,
      rating: (v) => Math.min(5, Math.max(1, Math.round(num(v, 5)))),
      context: text(160),
      order,
      isActive: bool,
    }),
});

export const partners = makeCrud({
  model: Partner,
  label: "Socio",
  required: "name",
  build: (b) => pick(b, { name: text(120), logo: image, url: text(500), order, isActive: bool }),
});

// ─── Público ──────────────────────────────────────────────────────────

export function publishedFaqs() {
  return Faq.find({ isPublished: true })
    .sort({ order: 1, createdAt: 1 })
    .select("question answer order")
    .lean();
}

export function activeAdvisors() {
  return Advisor.find({ isActive: true }).sort({ order: 1 }).select("-__v").lean();
}

export function activeTestimonials() {
  return Testimonial.find({ isActive: true }).sort({ order: 1 }).select("-__v").lean();
}

export function activePartners() {
  return Partner.find({ isActive: true }).sort({ order: 1 }).select("-__v").lean();
}
