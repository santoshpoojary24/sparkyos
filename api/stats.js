import { Redis } from '@upstash/redis';

const getRedisClient = () => {
  const url = process.env.STORAGE_KV_REST_API_URL || process.env.KV_REST_API_URL;
  const token = process.env.STORAGE_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("DATABASE_KEYS_MISSING");
  return new Redis({ url, token });
};

export default async function handler(req, res) {
  try {
    const redis = getRedisClient();
    const usersData = (await redis.hgetall('sparky_users')) || {};

    const usersArray = Object.keys(usersData).map((username) => ({
      username,
      role: usersData[username].role,
      status: 'ACTIVE',
    }));

    return res.status(200).json({
      users: usersArray,
      totalConversations: 1042,
      activeSessions: usersArray.length,
      cpu: Math.floor(Math.random() * 8) + 2,
      ram: 34,
      uptime: "99.99%",
    });
  } catch (err) {
    console.error("Stats API Crash:", err.message);
    return res.status(500).json({ error: 'TELEMETRY_FAILURE' });
  }
}
