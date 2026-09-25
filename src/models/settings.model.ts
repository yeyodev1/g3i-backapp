import mongoose, { Schema } from "mongoose";
import { Image } from "../utils/validate";
import { imageSchema } from "./common.schema";

export interface ISettings {
  key: string;
  hero: { title: string; subtitle: string; image: Image | null; ctaLabel: string; ctaLink: string };
  popularSearches: { label: string; query: Record<string, string> }[];
  about: { title: string; text: string; image: Image | null };
  // Cifras de la banda bajo el buscador de Inicio. icon es una clave de STAT_ICONS.
  stats: { icon: string; label: string; value: string }[];
  // Usos de terreno que ofrece el buscador (los administra la clienta).
  landUses: string[];
  contact: {
    whatsapp: string;
    phone: string;
    email: string;
    instagram: string;
    facebook: string;
    address: string;
  };
  sellCta: { title: string; text: string };
  createdAt?: Date;
  updatedAt?: Date;
}

export const SETTINGS_KEY = "site";

export const SETTINGS_DEFAULTS = {
  hero: {
    title: "Encuentra tu próximo hogar en el valle",
    subtitle: "Casas, departamentos, terrenos y proyectos en Cumbayá, Tumbaco y sus alrededores.",
    image: null,
    ctaLabel: "Ver propiedades",
    ctaLink: "/propiedades",
  },
  popularSearches: [],
  about: {
    title: "Conócenos",
    text: "",
    image: null,
  },
  stats: [],
  landUses: ["Residencial", "Comercial", "Para proyecto"],
  contact: {
    whatsapp: "593995806119",
    phone: "0995806119",
    email: "",
    instagram: "",
    facebook: "",
    address: "Cumbayá, Quito",
  },
  sellCta: {
    title: "¿Quieres vender tu propiedad?",
    text: "Te ayudamos a valorarla y a encontrar al comprador indicado.",
  },
};

const settingsSchema = new Schema<ISettings>(
  {
    // Clave fija: garantiza un solo documento aunque dos requests lo creen a la vez.
    key: { type: String, default: SETTINGS_KEY, unique: true },
    hero: {
      title: { type: String, default: SETTINGS_DEFAULTS.hero.title },
      subtitle: { type: String, default: SETTINGS_DEFAULTS.hero.subtitle },
      image: { type: imageSchema, default: null },
      ctaLabel: { type: String, default: SETTINGS_DEFAULTS.hero.ctaLabel },
      ctaLink: { type: String, default: SETTINGS_DEFAULTS.hero.ctaLink },
    },
    popularSearches: {
      type: [
        new Schema(
          {
            label: { type: String, required: true },
            query: { type: Schema.Types.Mixed, default: {} },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    about: {
      title: { type: String, default: SETTINGS_DEFAULTS.about.title },
      text: { type: String, default: "" },
      image: { type: imageSchema, default: null },
    },
    stats: {
      type: [
        new Schema(
          {
            icon: { type: String, default: "" },
            label: { type: String, default: "" },
            value: { type: String, default: "" },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    landUses: { type: [String], default: SETTINGS_DEFAULTS.landUses },
    contact: {
      whatsapp: { type: String, default: SETTINGS_DEFAULTS.contact.whatsapp },
      phone: { type: String, default: SETTINGS_DEFAULTS.contact.phone },
      email: { type: String, default: "" },
      instagram: { type: String, default: "" },
      facebook: { type: String, default: "" },
      address: { type: String, default: SETTINGS_DEFAULTS.contact.address },
    },
    sellCta: {
      title: { type: String, default: SETTINGS_DEFAULTS.sellCta.title },
      text: { type: String, default: SETTINGS_DEFAULTS.sellCta.text },
    },
  },
  { timestamps: true, minimize: false },
);

export const Settings =
  (mongoose.models.Settings as mongoose.Model<ISettings>) ||
  mongoose.model<ISettings>("Settings", settingsSchema);
