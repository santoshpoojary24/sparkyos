import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.STORAGE_KV_REST_API_URL,
  token: process.env.STORAGE_KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const { username, password, role } = req.body;

  try {
    const exists = await redis.hexists('sparky_users', username);
    if (exists) return res.status(400).json({ error: 'IDENTITY ALREADY REGISTERED' });

    await redis.hset('sparky_users', { [username]: { password, role } });
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'DB WRITE ERROR' });
  }
}
