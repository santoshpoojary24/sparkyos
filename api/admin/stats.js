import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.STORAGE_KV_REST_API_URL,
  token: process.env.STORAGE_KV_REST_API_TOKEN,
})

export default async function handler(req, res) {
    try {
        const usersData = await redis.hgetall('sparky_users') || {};

        const usersArray = Object.keys(usersData).map(username => ({
            username: username,
            role: usersData[username].role,
            status: 'Active'
        }));

        res.status(200).json({
            users: usersArray,
            totalConversations: 1042,
            totalMessages: 8900,
            activeSessions: usersArray.length,
            maintenanceMode: false,
            cpu: Math.floor(Math.random() * 15) + 10,
            ram: Math.floor(Math.random() * 20) + 40,
            uptime: "24h 12m",
            logs: []
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch neural links" });
    }
}
