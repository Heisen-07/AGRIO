/**
 * POST /api/auth/register
 * Body: { name, phone, password }
 */
import bcrypt from 'bcryptjs';
import { connectDB } from '../lib/db.js';
import { User, FarmerProfile, normalizePhone } from '../lib/models.js';
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

  const { name, phone, password } = req.body || {};

  // Input validation
  if (!name || typeof name !== 'string' || name.trim().length < 1) {
    return res.status(400).json({ error: 'Name is required.' });
  }
  const normalizedPhone = normalizePhone(phone);
  if (normalizedPhone.length < 7 || normalizedPhone.length > 15) {
    return res.status(400).json({ error: 'A valid phone number is required (7–15 digits).' });
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  try {
    await connectDB();

    // Duplicate check
    const existing = await User.findOne({ phone: normalizedPhone }).lean();
    if (existing) {
      return res.status(409).json({ error: 'An account with that phone number already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name: name.trim(),
      phone: normalizedPhone,
      passwordHash,
    });

    // Create initial farmer profile stub
    await FarmerProfile.create({
      userId: user._id,
      farmerName: name.trim(),
      crop: '',
      farms: [],
    });

    const cookie = signToken({ sub: user._id.toString(), phone: user.phone, name: user.name });
    res.setHeader('Set-Cookie', cookie);

    return res.status(201).json({
      id:    user._id.toString(),
      name:  user.name,
      phone: user.phone,
    });
  } catch (err) {
    console.error('[register]', err);
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
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
}
