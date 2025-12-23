import mongoose from "mongoose";

const licenseSchema = new mongoose.Schema({
  code: { type: String, unique: true },
  active: { type: Boolean, default: true },
  expiresAt: { type: Date, required: true },
  usedBy: { type: String, default: null }
}, { timestamps: true });

export const License = mongoose.model("License", licenseSchema);
