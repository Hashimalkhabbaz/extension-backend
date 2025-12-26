import mongoose from "mongoose";

const licenseSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  active: { type: Boolean, default: true },
  usedBy: { type: String, default: null }, // deviceId
  telegramChatId: { type: String, default: null },
  telegramUsername: { type: String, default: null },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const License = mongoose.model("License", licenseSchema);