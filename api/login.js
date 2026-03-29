import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.STORAGE_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.STORAGE_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const { username, password } = req.body;
    const user = await redis.hget('sparky_users', username);
    if (!user || user.password !== password) return res.status(401).json({ error: 'INVALID_ID' });
    return res.status(200).json({ success: true, role: user.role });
  } catch (err) {
    return res.status(500).json({ error: 'DB_OFFLINE', msg: err.message });
  }
}
