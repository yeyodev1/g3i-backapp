import mongoose, { Schema } from "mongoose";
import { Image } from "../utils/validate";
import { imageSchema } from "./common.schema";

export interface ITestimonial {
  name: string;
  text: string;
  photo: Image | null;
  rating: number;
  context: string;
  order: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const testimonialSchema = new Schema<ITestimonial>(
  {
    name: { type: String, required: true, trim: true },
    text: { type: String, default: "" },
    photo: { type: imageSchema, default: null },
    rating: { type: Number, default: 5, min: 1, max: 5 },
    context: { type: String, default: "" },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Testimonial =
  (mongoose.models.Testimonial as mongoose.Model<ITestimonial>) ||
  mongoose.model<ITestimonial>("Testimonial", testimonialSchema);
