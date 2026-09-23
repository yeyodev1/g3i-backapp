import mongoose, { Schema, Types } from "mongoose";
import {
  DEFAULT_CITY,
  PROPERTY_CONDITION_KEYS,
  PROPERTY_STATUSES,
  PROPERTY_TYPE_KEYS,
  PropertyCondition,
  PropertyStatus,
  PropertyType,
} from "../config/catalogs";
import { Image, Location, Video } from "../utils/validate";
import { imageSchema, locationSchema, sourceSchema, videoSchema } from "./common.schema";

export interface IProperty {
  code?: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  type: PropertyType;
  transaction: "venta";
  condition: PropertyCondition | "";
  ageYears: number | null;
  sector: string;
  city: string;
  address: string;
  location: Location;
  price: number;
  hoa: { enabled: boolean; amount: number };
  totalM2: number | null;
  builtM2: number | null;
  gardenM2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  halfBathrooms: number | null;
  parking: number | null;
  storageRooms: number | null;
  elevators: number | null;
  floors: number | null;
  serviceBathroom: boolean;
  frontMeters: number | null;
  depthMeters: number | null;
  buildableFloors: number | null;
  amenities: string[];
  images: Image[];
  videos: Video[];
  floorPlans: Image[];
  status: PropertyStatus;
  isFeatured: boolean;
  featuredOrder: number;
  project: Types.ObjectId | null;
  source: { wpUrl: string };
  views: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const nullableNumber = { type: Number, default: null };

const propertySchema = new Schema<IProperty>(
  {
    // Sin default: con sparse, los documentos sin código no chocan entre sí.
    code: { type: String, trim: true },
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    summary: { type: String, default: "", maxlength: 220 },
    description: { type: String, default: "" },
    type: { type: String, enum: PROPERTY_TYPE_KEYS, required: true },
    transaction: { type: String, enum: ["venta"], default: "venta" },
    condition: { type: String, enum: [...PROPERTY_CONDITION_KEYS, ""], default: "" },
    ageYears: nullableNumber,
    sector: { type: String, default: "", index: true },
    city: { type: String, default: DEFAULT_CITY },
    address: { type: String, default: "" },
    location: { type: locationSchema, default: () => ({}) },
    price: { type: Number, default: 0, min: 0 },
    hoa: {
      enabled: { type: Boolean, default: false },
      amount: { type: Number, default: 0 },
    },
    totalM2: nullableNumber,
    builtM2: nullableNumber,
    gardenM2: nullableNumber,
    bedrooms: nullableNumber,
    bathrooms: nullableNumber,
    halfBathrooms: nullableNumber,
    parking: nullableNumber,
    storageRooms: nullableNumber,
    elevators: nullableNumber,
    floors: nullableNumber,
    serviceBathroom: { type: Boolean, default: false },
    frontMeters: nullableNumber,
    depthMeters: nullableNumber,
    buildableFloors: nullableNumber,
    amenities: { type: [String], default: [] },
    images: { type: [imageSchema], default: [] },
    videos: { type: [videoSchema], default: [] },
    floorPlans: { type: [imageSchema], default: [] },
    status: { type: String, enum: PROPERTY_STATUSES, default: "draft" },
    isFeatured: { type: Boolean, default: false },
    featuredOrder: { type: Number, default: 0 },
    project: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    source: { type: sourceSchema, default: () => ({}) },
    views: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Un código vacío chocaría en el índice único (sparse solo ignora el campo ausente).
propertySchema.pre("validate", function (next) {
  if (!this.code) this.code = undefined;
  next();
});

propertySchema.index({ code: 1 }, { unique: true, sparse: true });
propertySchema.index({ status: 1, type: 1, sector: 1 });
propertySchema.index({ status: 1, isFeatured: 1, featuredOrder: 1 });
propertySchema.index({ "source.wpUrl": 1 });

export const Property =
  (mongoose.models.Property as mongoose.Model<IProperty>) ||
  mongoose.model<IProperty>("Property", propertySchema);
