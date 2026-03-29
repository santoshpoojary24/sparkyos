import { Redis } from '@upstash/redis';

export default async function handler(req, res) {
  // 1. Safety check for the method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 2. High-quality environment detection
    const url = process.env.STORAGE_KV_REST_API_URL || process.env.KV_REST_API_URL;
    const token = process.env.STORAGE_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN;

    // 3. If keys are missing, don't crash—just report it
    if (!url || !token) {
      return res.status(500).json({ 
        error: "DATABASE_UNLINKED", 
        details: "Keys not found in Vercel Environment Variables." 
      });
    }

    const redis = new Redis({ url, token });
    const { username, password } = req.body;

    // 4. Database Query
    const user = await redis.hget('sparky_users', username);

    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'UNAUTHORIZED_ID' });
    }

    return res.status(200).json({ success: true, role: user.role });

  } catch (error) {
    // 5. Catch any other weird errors
    console.error("System Fault:", error.message);
    return res.status(500).json({ error: "NEURAL_LINK_FAILURE", msg: error.message });
  }
}
