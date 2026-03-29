import { Redis } from '@upstash/redis'

// Connect using the specific Vercel prefix from your screenshot
const redis = new Redis({
  url: process.env.STORAGE_KV_REST_API_URL,
  token: process.env.STORAGE_KV_REST_API_TOKEN,
})

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { username, password } = req.body;

    try {
        // Look up user in the "sparky_users" hash
        const user = await redis.hget('sparky_users', username);

        if (!user || user.password !== password) {
            return res.status(401).json({ error: 'INVALID IDENTITY OR KEY' });
        }

        return res.status(200).json({ success: true, role: user.role });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'DATABASE CONNECTION ERROR' });
    }
}
