import { Redis } from '@upstash/redis';

// Matches your exact Vercel Environment Variables from Screenshot (23)
const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'System Error: Method Not Allowed' });

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Neural link requires identity credentials' });
    }

    const user = await redis.hget('sparky_users', username);

    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'ACCESS DENIED: Unauthorized Identity' });
    }

    return res.status(200).json({ success: true, role: user.role });
  } catch (error) {
    console.error("Neural Link Crash:", error.message);
    return res.status(500).json({ error: 'DATABASE_CONNECTION_FAILED', details: error.message });
  }
}
