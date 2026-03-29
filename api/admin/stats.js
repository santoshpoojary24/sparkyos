import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.STORAGE_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.STORAGE_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  try {
    const usersData = await redis.hgetall('sparky_users') || {};
    const usersArray = Object.keys(usersData).map(name => ({
      username: name,
      role: usersData[name].role,
      status: 'ACTIVE'
    }));

    return res.status(200).json({
      users: usersArray,
      cpu: Math.floor(Math.random() * 10) + 2,
      ram: 44,
      uptime: "99.9%"
    });
  } catch (err) {
    return res.status(500).json({ error: 'STATS_ERROR' });
  }
}
