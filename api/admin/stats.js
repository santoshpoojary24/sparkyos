import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
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
      cpu: Math.floor(Math.random() * 12) + 5,
      ram: 42,
      uptime: "99.9%"
    });
  } catch (error) {
    return res.status(500).json({ error: 'TELEMETRY_OFFLINE' });
  }
}
