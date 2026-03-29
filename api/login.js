import { Redis } from '@upstash/redis';

export default async function handler(req, res) {
  // Quality Check 1: Ensure only POST is allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ status: "error", message: "Invalid method" });
  }

  try {
    // Quality Check 2: Environment Variable Detection
    // Vercel integrations often use different prefixes. We check all of them.
    const url = process.env.STORAGE_KV_REST_API_URL || process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.STORAGE_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      return res.status(500).json({ 
        status: "crash", 
        error: "DATABASE_KEYS_MISSING",
        hint: "Go to Vercel Settings -> Environment Variables and ensure your Upstash keys are present."
      });
    }

    const redis = new Redis({ url, token });
    const { username, password } = req.body;

    // Quality Check 3: Database Connection
    const user = await redis.hget('sparky_users', username);

    if (!user || user.password !== password) {
      return res.status(401).json({ status: "denied", message: "Unauthorized Identity" });
    }

    return res.status(200).json({ status: "success", role: user.role });

  } catch (err) {
    // This blocks the generic 500 error and shows the real issue
    console.error("Critical Runtime Error:", err.message);
    return res.status(500).json({ 
      status: "internal_error", 
      error_type: err.name,
      message: err.message 
    });
  }
}
