import mongoose, { Schema } from "mongoose";

export interface IFaq {
  question: string;
  answer: string;
  order: number;
  isPublished: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const faqSchema = new Schema<IFaq>(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, default: "" },
    order: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Faq =
  (mongoose.models.Faq as mongoose.Model<IFaq>) || mongoose.model<IFaq>("Faq", faqSchema);
