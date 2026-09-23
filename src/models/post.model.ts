import mongoose, { Schema } from "mongoose";
import { POST_STATUSES, PostStatus } from "../config/catalogs";
import { Image } from "../utils/validate";
import { imageSchema } from "./common.schema";

export interface IPost {
  title: string;
  slug: string;
  excerpt: string;
  cover: Image | null;
  content: string;
  status: PostStatus;
  publishedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const postSchema = new Schema<IPost>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    excerpt: { type: String, default: "" },
    cover: { type: imageSchema, default: null },
    content: { type: String, default: "" },
    status: { type: String, enum: POST_STATUSES, default: "draft" },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

postSchema.index({ status: 1, publishedAt: -1 });

export const Post =
  (mongoose.models.Post as mongoose.Model<IPost>) || mongoose.model<IPost>("Post", postSchema);
