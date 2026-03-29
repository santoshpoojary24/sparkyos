export default function handler(req, res) {
    // This tells your frontend: "Yes, this person is a root admin, let them stay on the page!"
    res.status(200).json({ 
        user: { 
            role: 'admin',
            username: 'Root_Admin'
        } 
    });
}
