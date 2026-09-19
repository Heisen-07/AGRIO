/**
 * api/lib/models.js
 * Mongoose models for AGRIO:
 * - User (phone + password auth)
 * - FarmerProfile (farmer name, active crop, farms list)
 * - TelemetryRecord (sensor readings, ESP32/Blynk telemetry snapshots)
 * - DiagnosisRecord (leaf scan AI disease diagnoses & recommendations)
 */
import mongoose from 'mongoose';

// ── User Schema ─────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true, trim: true, maxlength: 100 },
    // Normalized digits-only phone string (e.g. "919876543210")
    phone:        { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model('User', userSchema);

// ── FarmerProfile Schema ────────────────────────────────────────────────────
const farmerProfileSchema = new mongoose.Schema(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    farmerName:  { type: String, default: '', trim: true },
    crop:        { type: String, default: '', trim: true },
    farms:       { type: Array, default: [] },
  },
  { timestamps: true }
);

export const FarmerProfile =
  mongoose.models.FarmerProfile || mongoose.model('FarmerProfile', farmerProfileSchema);

// ── TelemetryRecord Schema ──────────────────────────────────────────────────
const telemetryRecordSchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    farmId:    { type: String, default: 'demo_farm', index: true },
    timestamp: { type: Date, default: Date.now, index: true },
    data:      { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

export const TelemetryRecord =
  mongoose.models.TelemetryRecord || mongoose.model('TelemetryRecord', telemetryRecordSchema);

// ── DiagnosisRecord Schema ──────────────────────────────────────────────────
const diagnosisRecordSchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    farmId:    { type: String, default: 'demo_farm', index: true },
    timestamp: { type: Date, default: Date.now, index: true },
    data:      { type: mongoose.Schema.Types.Mixed, required: true },
    thumbnail: { type: String, default: null },
  },
  { timestamps: true }
);

export const DiagnosisRecord =
  mongoose.models.DiagnosisRecord || mongoose.model('DiagnosisRecord', diagnosisRecordSchema);

/**
 * Normalize phone number to digits-only string.
 * Strips spaces, dashes, parentheses, plus sign.
 */
export function normalizePhone(raw) {
  return String(raw || '').replace(/[^\d]/g, '');
}
