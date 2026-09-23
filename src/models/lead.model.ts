import mongoose, { Schema, Types } from "mongoose";
import {
  CRM_STATUSES,
  CrmStatus,
  LEAD_KINDS,
  LEAD_STATUSES,
  LeadKind,
  LeadStatus,
} from "../config/catalogs";

export interface ILead {
  kind: LeadKind;
  name: string;
  email: string;
  phone: string;
  message: string;
  sellSector: string;
  sellPropertyType: string;
  property: Types.ObjectId | null;
  project: Types.ObjectId | null;
  unit: Types.ObjectId | null;
  refCode: string;
  sourceUrl: string;
  status: LeadStatus;
  crm: { status: CrmStatus; error: string; externalId: string; sentAt: Date | null };
  ip: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const leadSchema = new Schema<ILead>(
  {
    kind: { type: String, enum: LEAD_KINDS, default: "general", index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, default: "", lowercase: true, trim: true },
    phone: { type: String, default: "", trim: true },
    message: { type: String, default: "" },
    sellSector: { type: String, default: "" },
    sellPropertyType: { type: String, default: "" },
    property: { type: Schema.Types.ObjectId, ref: "Property", default: null },
    project: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    unit: { type: Schema.Types.ObjectId, ref: "Unit", default: null },
    refCode: { type: String, default: "" },
    sourceUrl: { type: String, default: "" },
    status: { type: String, enum: LEAD_STATUSES, default: "new", index: true },
    crm: {
      status: { type: String, enum: CRM_STATUSES, default: "pending" },
      error: { type: String, default: "" },
      externalId: { type: String, default: "" },
      sentAt: { type: Date, default: null },
    },
    // Solo para auditar abuso; no se expone en el público.
    ip: { type: String, default: "" },
  },
  { timestamps: true },
);

leadSchema.index({ createdAt: -1 });

export const Lead =
  (mongoose.models.Lead as mongoose.Model<ILead>) || mongoose.model<ILead>("Lead", leadSchema);
