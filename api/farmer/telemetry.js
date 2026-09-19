/**
 * GET  /api/farmer/telemetry — get authenticated farmer's telemetry snapshots
 * POST /api/farmer/telemetry — save telemetry snapshot for authenticated farmer
 */
import { connectDB } from '../lib/db.js';
import { TelemetryRecord } from '../lib/models.js';
import { requireAuth } from '../lib/auth.js';

export default async function handler(req, res) {
  const payload = requireAuth(req, res);
  if (!payload) return;

  try {
    await connectDB();

    if (req.method === 'GET') {
      const { farmId, limit = 50 } = req.query || {};
      const query = { userId: payload.sub };
      if (farmId) query.farmId = farmId;

      const records = await TelemetryRecord.find(query)
        .sort({ timestamp: -1 })
        .limit(Math.min(Number(limit) || 50, 200))
        .lean();

      return res.status(200).json({ records });
    }

    if (req.method === 'POST') {
      const { farmId = 'demo_farm', data, timestamp } = req.body || {};
      if (!data) {
        return res.status(400).json({ error: 'Telemetry data is required.' });
      }

      const record = await TelemetryRecord.create({
        userId: payload.sub,
        farmId,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        data,
      });

      return res.status(201).json({ id: record._id, timestamp: record.timestamp });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[telemetry]', err);
    if (
      err.statusCode === 503 ||
      err.name === 'MongooseServerSelectionError' ||
      err.name === 'MongoServerSelectionError' ||
      err.name === 'MongoParseError' ||
      err.message?.includes('MONGODB_URI')
    ) {
      return res.status(503).json({ error: 'Database service is currently unreachable.' });
    }
    return res.status(500).json({ error: 'Failed to process telemetry record.' });
  }
}
