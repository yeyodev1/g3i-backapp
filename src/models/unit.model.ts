import mongoose, { Schema, Types } from "mongoose";
import { PROPERTY_TYPE_KEYS, PropertyType, UNIT_STATUSES, UnitStatus } from "../config/catalogs";
import { Image } from "../utils/validate";
import { imageSchema } from "./common.schema";

export interface IUnit {
  project: Types.ObjectId;
  name: string;
  type: PropertyType;
  floor: string;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  storageRooms: number | null;
  builtM2: number | null;
  balconyM2: number | null;
  terraceM2: number | null;
  gardenM2: number | null;
  price: number;
  description: string;
  floorPlan: Image | null;
  images: Image[];
  status: UnitStatus;
  order: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const nullableNumber = { type: Number, default: null };

const unitSchema = new Schema<IUnit>(
  {
    project: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: PROPERTY_TYPE_KEYS, default: "departamento" },
    floor: { type: String, default: "" },
    bedrooms: nullableNumber,
    bathrooms: nullableNumber,
    parking: nullableNumber,
    storageRooms: nullableNumber,
    builtM2: nullableNumber,
    balconyM2: nullableNumber,
    terraceM2: nullableNumber,
    gardenM2: nullableNumber,
    price: { type: Number, default: 0, min: 0 },
    description: { type: String, default: "" },
    floorPlan: { type: imageSchema, default: null },
    images: { type: [imageSchema], default: [] },
    status: { type: String, enum: UNIT_STATUSES, default: "available" },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

unitSchema.index({ project: 1, status: 1, order: 1 });

export const Unit =
  (mongoose.models.Unit as mongoose.Model<IUnit>) || mongoose.model<IUnit>("Unit", unitSchema);
