/**
 * GET /api/auth/me
 * Returns the authenticated user's basic profile from the JWT.
 * Unauthenticated requests return 401.
 * Missing JWT_SECRET returns 503.
 */
import { requireAuth } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!process.env.JWT_SECRET) {
      return res.status(503).json({ error: 'Authentication service is unconfigured. JWT_SECRET is missing.' });
    }

    const payload = requireAuth(req, res);
    if (!payload) return; // requireAuth already sent 401

    return res.status(200).json({
      id:    payload.sub,
      name:  payload.name,
      phone: payload.phone,
    });
  } catch (err) {
    console.error('[me]', err);
    return res.status(500).json({ error: 'Authentication verification failed.' });
  }
}
