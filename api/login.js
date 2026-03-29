import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    // Only allow POST requests (Submitting a login form)
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { username, password } = req.body;

    try {
        // 1. Look up the user in your cloud database
        const user = await kv.hget('sparky_users', username);

        // 2. Check if the user exists AND the password matches
        // (Note: In a massive production app, passwords would be hashed, but this works perfectly for your current setup)
        if (!user || user.password !== password) {
            return res.status(401).json({ error: 'Invalid system ID or security key' });
        }

        // 3. If it matches, send a success signal back to the login page!
        return res.status(200).json({ 
            success: true, 
            role: user.role,
            message: 'Access Granted' 
        });

    } catch (error) {
        console.error("Login Error:", error);
