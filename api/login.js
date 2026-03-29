import { Redis } from '@upstash/redis';

// Professional-grade environment detection
const redis = new Redis({
  url: process.env.STORAGE_KV_REST_API_URL || process.env.KV_REST_API_URL,
  token: process.env.STORAGE_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  // 1. Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'System error: Invalid Method' });
  }

  try {
    const { username, password } = req.body;

    // 2. Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Credentials required for neural sync' });
    }

    // 3. Database Request
    const user = await redis.hget('sparky_users', username);

    // 4. Verification
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'ACCESS DENIED: Identity mismatch' });
    }

    // 5. Success
    return res.status(200).json({ success: true, role: user.role });

  } catch (err) {
    console.error("Vercel Runtime Crash:", err);
    return res.status(500).json({ 
      error: 'CRITICAL_FAULT', 
      msg: 'Check Vercel Environment Variables in Settings' 
    });
  }
}
