import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    // Only allow POST requests (Adding a user)
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { username, password, role } = req.body;

    try {
        // 1. Check if the user already exists in the database
        const existingUser = await kv.hget('sparky_users', username);
        if (existingUser) {
            return res.status(400).json({ error: "User already exists!" });
        }

        // 2. Save the new user to Upstash KV
        await kv.hset('sparky_users', {
            [username]: { password: password, role: role, status: 'Active' }
        });

        // 3. Tell the frontend the save was successful
        return res.status(200).json({ success: true });

    } catch (error) {
        console.error("Database Error:", error);
        return res.status(500).json({ error: "Failed to connect to cloud database" });
    }
}
