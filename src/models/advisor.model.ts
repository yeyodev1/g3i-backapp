import mongoose, { Schema } from "mongoose";
import { Image } from "../utils/validate";
import { imageSchema } from "./common.schema";

export interface IAdvisor {
  name: string;
  role: string;
  photo: Image | null;
  bio: string;
  phone: string;
  email: string;
  order: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const advisorSchema = new Schema<IAdvisor>(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, default: "" },
    photo: { type: imageSchema, default: null },
    bio: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Advisor =
  (mongoose.models.Advisor as mongoose.Model<IAdvisor>) ||
  mongoose.model<IAdvisor>("Advisor", advisorSchema);
