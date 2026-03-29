import { Redis } from '@upstash/redis';

// High-quality connection handler
const getRedisClient = () => {
  const url = process.env.STORAGE_KV_REST_API_URL || process.env.KV_REST_API_URL;
  const token = process.env.STORAGE_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN;
  
  if (!url || !token) throw new Error("DATABASE_KEYS_MISSING");
  return new Redis({ url, token });
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const redis = getRedisClient();
    const { username, password } = req.body;

    const user = await redis.hget('sparky_users', username);

    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    }

    return res.status(200).json({ success: true, role: user.role });
  } catch (err) {
    console.error("Critical Runtime Error:", err.message);
    return res.status(500).json({ 
      error: 'SERVER_FAULT', 
      details: err.message === "DATABASE_KEYS_MISSING" ? "Check Vercel Environment Variables" : "Database Connection Failed" 
    });
  }
}
