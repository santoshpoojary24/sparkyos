import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.STORAGE_KV_REST_API_URL,
  token: process.env.STORAGE_KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  try {
    const usersData = await redis.hgetall('sparky_users') || {};
    const usersArray = Object.keys(usersData).map(username => ({
      username,
      role: usersData[username].role,
      status: 'ACTIVE'
    }));

    return res.status(200).json({
      users: usersArray,
      totalConversations: 1042,
      activeSessions: usersArray.length,
      cpu: Math.floor(Math.random() * 10) + 5,
      ram: 42,
      uptime: "99.9%"
    });
  } catch (error) {
    return res.status(500).json({ error: 'FAILED TO FETCH TELEMETRY' });
  }
}
