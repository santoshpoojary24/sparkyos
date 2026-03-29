import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    // Vercel extracts the username from the URL automatically
    const { username } = req.query;

    try {
        if (req.method === 'DELETE') {
            // Delete the user from the database
            await kv.hdel('sparky_users', username);
            return res.status(200).json({ success: true });
        } 
        
        else if (req.method === 'PUT') {
            // Edit the user's role or password
            const { password, role } = req.body;
            
            // Get their current data first
            const currentUserData = await kv.hget('sparky_users', username);
            if (!currentUserData) {
                return res.status(404).json({ error: "User not found" });
            }

            // Update with new data
            const updatedData = {
                password: password || currentUserData.password, // Keep old password if blank
                role: role,
                status: currentUserData.status
            };

            await kv.hset('sparky_users', { [username]: updatedData });
            return res.status(200).json({ success: true });
        }

        // If it's not a DELETE or PUT request
        return res.status(405).json({ error: 'Method Not Allowed' });

    } catch (error) {
        console.error("Database Error:", error);
        return res.status(500).json({ error: "Database operation failed" });
    }
}