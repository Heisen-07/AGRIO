/**
 * POST /api/auth/login
 * Body: { phone, password }
 */
import bcrypt from 'bcryptjs';
import { connectDB } from '../lib/db.js';
import { User, normalizePhone } from '../lib/models.js';
import { signToken } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Pre-validate server configuration
  if (!process.env.MONGODB_URI) {
    return res.status(503).json({
      error: 'Database configuration missing. MONGODB_URI environment variable is not configured.',
    });
  }
  if (!process.env.JWT_SECRET) {
    return res.status(503).json({
      error: 'Authentication configuration missing. JWT_SECRET environment variable is not configured.',
    });
  }

  const { phone, password } = req.body || {};

  if (!phone || !password) {
    return res.status(400).json({ error: 'Phone number and password are required.' });
  }

  const normalizedPhone = normalizePhone(phone);

  try {
    await connectDB();

    const user = await User.findOne({ phone: normalizedPhone });
    if (!user) {
      return res.status(401).json({ error: 'Invalid phone number or password.' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid phone number or password.' });
    }

    const cookie = signToken({ sub: user._id.toString(), phone: user.phone, name: user.name });
    res.setHeader('Set-Cookie', cookie);

    return res.status(200).json({
      id:    user._id.toString(),
      name:  user.name,
      phone: user.phone,
    });
  } catch (err) {
    console.error('[login]', err);
    if (
      err.statusCode === 503 ||
      err.name === 'MongooseServerSelectionError' ||
      err.name === 'MongoServerSelectionError' ||
      err.name === 'MongoParseError' ||
      err.message?.includes('MONGODB_URI')
    ) {
      return res.status(503).json({
        error: 'Database service is currently unreachable. Please verify MONGODB_URI configuration.',
      });
    }
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
}
