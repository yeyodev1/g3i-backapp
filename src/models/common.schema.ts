import { Schema } from "mongoose";

/** Subdocumentos compartidos. `_id: false` para no ensuciar el JSON con ids que nadie usa. */

export const imageSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: "" },
    alt: { type: String, default: "" },
  },
  { _id: false },
);

export const videoSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: "" },
  },
  { _id: false },
);

export const locationSchema = new Schema(
  {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    exact: { type: Boolean, default: false },
    radiusMeters: { type: Number, default: 400 },
  },
  { _id: false },
);

export const sourceSchema = new Schema(
  {
    wpUrl: { type: String, default: "" },
  },
  { _id: false },
);
