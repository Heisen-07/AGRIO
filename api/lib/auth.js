/**
 * api/lib/auth.js
 * JWT sign/verify helpers + HttpOnly cookie utilities.
 */
import jwt from 'jsonwebtoken';

const COOKIE_NAME = 'agrio_token';
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const err = new Error('Authentication configuration missing. JWT_SECRET is not configured.');
    err.statusCode = 503;
    throw err;
  }
  return secret;
}

/** Safely extract cookie value from Cookie header */
export function getCookieValue(cookieHeader, name) {
  if (!cookieHeader || typeof cookieHeader !== 'string') return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Sign a JWT and return the Set-Cookie string. */
export function signToken(payload) {
  const secret = getJwtSecret();
  const token = jwt.sign(payload, secret, { expiresIn: TOKEN_TTL_SECONDS });
  const isProd = process.env.NODE_ENV === 'production';
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${TOKEN_TTL_SECONDS}; SameSite=Lax${
    isProd ? '; Secure' : ''
  }`;
}

/** Clear the auth cookie (logout). */
export function clearToken() {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}

/**
 * Verify the JWT from the incoming request cookie.
 * Returns the decoded payload or null if missing/invalid.
 */
export function verifyToken(req) {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    const cookieHeader = req?.headers?.cookie || req?.headers?.['cookie'] || '';
    const token = getCookieValue(cookieHeader, COOKIE_NAME);
    if (!token) return null;
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

/** Middleware helper: respond 401 if not authed, else return decoded payload. */
export function requireAuth(req, res) {
  const payload = verifyToken(req);
  if (!payload) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return payload;
}
