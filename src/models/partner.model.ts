import mongoose, { Schema } from "mongoose";
import { Image } from "../utils/validate";
import { imageSchema } from "./common.schema";

export interface IPartner {
  name: string;
  logo: Image | null;
  url: string;
  order: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const partnerSchema = new Schema<IPartner>(
  {
    name: { type: String, required: true, trim: true },
    logo: { type: imageSchema, default: null },
    url: { type: String, default: "" },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Partner =
  (mongoose.models.Partner as mongoose.Model<IPartner>) ||
  mongoose.model<IPartner>("Partner", partnerSchema);
