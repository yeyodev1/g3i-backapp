import mongoose, { Schema } from "mongoose";
import {
  DEFAULT_CITY,
  PROJECT_STAGE_KEYS,
  PROJECT_STATUSES,
  PROPERTY_TYPE_KEYS,
  ProjectStage,
  ProjectStatus,
  PropertyType,
} from "../config/catalogs";
import { Image, Location, Video } from "../utils/validate";
import { imageSchema, locationSchema, sourceSchema, videoSchema } from "./common.schema";

export interface IProject {
  code?: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  stage: ProjectStage | "";
  propertyTypes: PropertyType[];
  developer: string;
  sector: string;
  city: string;
  address: string;
  locality: string;
  location: Location;
  priceFrom: number | null;
  deliveryDate: string;
  totalUnits: number | null;
  amenities: string[];
  highlights: string[];
  images: Image[];
  videos: Video[];
  brochure: { url: string; publicId: string; name: string } | null;
  status: ProjectStatus;
  isFeatured: boolean;
  featuredOrder: number;
  source: { wpUrl: string };
  views: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const brochureSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: "" },
    name: { type: String, default: "" },
  },
  { _id: false },
);

const projectSchema = new Schema<IProject>(
  {
    code: { type: String, trim: true },
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    summary: { type: String, default: "", maxlength: 220 },
    description: { type: String, default: "" },
    stage: { type: String, enum: [...PROJECT_STAGE_KEYS, ""], default: "" },
    propertyTypes: { type: [String], enum: PROPERTY_TYPE_KEYS, default: [] },
    developer: { type: String, default: "" },
    sector: { type: String, default: "", index: true },
    city: { type: String, default: DEFAULT_CITY },
    address: { type: String, default: "" },
    locality: { type: String, default: "", trim: true, maxlength: 60 },
    location: { type: locationSchema, default: () => ({}) },
    priceFrom: { type: Number, default: null },
    deliveryDate: { type: String, default: "" },
    totalUnits: { type: Number, default: null },
    amenities: { type: [String], default: [] },
    highlights: { type: [String], default: [] },
    images: { type: [imageSchema], default: [] },
    videos: { type: [videoSchema], default: [] },
    brochure: { type: brochureSchema, default: null },
    status: { type: String, enum: PROJECT_STATUSES, default: "draft" },
    isFeatured: { type: Boolean, default: false },
    featuredOrder: { type: Number, default: 0 },
    source: { type: sourceSchema, default: () => ({}) },
    views: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Un código vacío chocaría en el índice único (sparse solo ignora el campo ausente).
projectSchema.pre("validate", function (next) {
  if (!this.code) this.code = undefined;
  next();
});

projectSchema.index({ code: 1 }, { unique: true, sparse: true });
projectSchema.index({ status: 1, stage: 1, sector: 1 });
projectSchema.index({ status: 1, isFeatured: 1, featuredOrder: 1 });
projectSchema.index({ "source.wpUrl": 1 });

export const Project =
  (mongoose.models.Project as mongoose.Model<IProject>) ||
  mongoose.model<IProject>("Project", projectSchema);
