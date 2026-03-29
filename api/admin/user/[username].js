import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.STORAGE_KV_REST_API_URL,
  token: process.env.STORAGE_KV_REST_API_TOKEN,
})

export default async function handler(req, res) {
    const { username } = req.query;

    try {
        if (req.method === 'DELETE') {
            await redis.hdel('sparky_users', username);
            return res.status(200).json({ success: true });
        } 
        
        if (req.method === 'PUT') {
            const { password, role } = req.body;
            const current = await redis.hget('sparky_users', username);
            
            await redis.hset('sparky_users', {
                [username]: { 
                    password: password || current.password, 
                    role: role 
                }
            });
            return res.status(200).json({ success: true });
        }
    } catch (error) {
        res.status(500).json({ error: "Operation failed" });
    }
}
