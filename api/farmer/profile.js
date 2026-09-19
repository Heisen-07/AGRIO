/**
 * GET  /api/farmer/profile  — fetch authed farmer's profile
 * PUT  /api/farmer/profile  — upsert authed farmer's profile
 *
 * Body (PUT): { farmerName, crop, farms }
 */
import { connectDB } from '../lib/db.js';
import { FarmerProfile } from '../lib/models.js';
import { requireAuth } from '../lib/auth.js';

export default async function handler(req, res) {
  const payload = requireAuth(req, res);
  if (!payload) return;

  try {
    await connectDB();

    // ── GET ──────────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const profile = await FarmerProfile.findOne({ userId: payload.sub }).lean();
      if (!profile) {
        return res.status(200).json({ farmerName: '', crop: '', farms: [] });
      }
      return res.status(200).json({
        farmerName: profile.farmerName || '',
        crop:       profile.crop || '',
        farms:      Array.isArray(profile.farms) ? profile.farms : [],
      });
    }

    // ── PUT ──────────────────────────────────────────────────────────────────
    if (req.method === 'PUT') {
      const { farmerName, crop, farms } = req.body || {};

      const updateData = {};
      if (typeof farmerName === 'string') updateData.farmerName = farmerName.trim();
      if (typeof crop === 'string') updateData.crop = crop.trim();
      if (Array.isArray(farms)) updateData.farms = farms;

      const updated = await FarmerProfile.findOneAndUpdate(
        { userId: payload.sub },
        { $set: updateData },
        { upsert: true, returnDocument: 'after', runValidators: true }
      );

      return res.status(200).json({
        farmerName: updated.farmerName,
        crop:       updated.crop,
        farms:      updated.farms || [],
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[profile]', err);
    if (
      err.statusCode === 503 ||
      err.name === 'MongooseServerSelectionError' ||
      err.name === 'MongoServerSelectionError' ||
      err.name === 'MongoParseError' ||
      err.message?.includes('MONGODB_URI')
    ) {
      return res.status(503).json({ error: 'Database service is currently unreachable.' });
    }
    return res.status(500).json({ error: 'Failed to process farmer profile.' });
  }
}
