/**
 * api/lib/db.js
 * Singleton Mongoose connection — reused across Vercel serverless cold/warm starts.
 * Import `connectDB` at the top of every API handler.
 */
import mongoose from 'mongoose';

/** Cached connection state across serverless invocations. */
let cached = global._mongooseCache;
if (!cached) {
  cached = global._mongooseCache = { conn: null, promise: null };
}

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    const err = new Error('Database configuration missing. MONGODB_URI is not configured.');
    err.statusCode = 503;
    throw err;
  }

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, {
        bufferCommands: false,
        // serverSelectionTimeoutMS keeps cold-start failures fast
        serverSelectionTimeoutMS: 8000,
      })
      .then((m) => m);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
