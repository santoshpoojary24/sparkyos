import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.STORAGE_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.STORAGE_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  const { username } = req.query; // For DELETE/PUT
  try {
    if (req.method === 'POST') {
      const { username: newID, password, role } = req.body;
      await redis.hset('sparky_users', { [newID]: { password, role } });
      return res.status(200).json({ success: true });
    }
    
    if (req.method === 'DELETE') {
      await redis.hdel('sparky_users', username);
      return res.status(200).json({ success: true });
    }
    
    return res.status(405).end();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
