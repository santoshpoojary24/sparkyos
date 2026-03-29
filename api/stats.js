import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    try {
        // 1. Fetch all users from your Upstash Cloud DB
        const usersData = await kv.hgetall('sparky_users') || {};

        // 2. Convert the database data into the list your frontend expects
        const usersArray = Object.keys(usersData).map(username => ({
            username: username,
            role: usersData[username].role,
            status: usersData[username].status
        }));

        // 3. Send the users to your dashboard table
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
        res.status(500).json({ error: "Failed to fetch stats" });
    }
}
