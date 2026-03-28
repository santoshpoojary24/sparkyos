const express = require('express');
const cors = require('cors');
const session = require('express-session');
const os = require('os'); // Hardware reading module

const app = express();

// Enable CORS with credentials (cookies)
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(express.static(__dirname));

// Session configuration
app.use(session({
    secret: 'sparky-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,      // set to true if using HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
}));

// ========== SYSTEM STATE & DATABASES (in memory) ==========

let NVIDIA_API_KEY = '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';
const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

// Users stored as an array so the Admin Dashboard can easily read them
let users = [
    { username: 'admin', password: 'sparky123', role: 'admin' },
    { username: 'user',  password: 'user123',   role: 'user' }
];

let stats = {
    totalConversations: 0,
    totalMessages: 0
};
const sessionActivity = new Map(); // sessionId -> last activity timestamp

let securityLogs = [
    { time: new Date().toLocaleTimeString(), type: 'System Boot', ip: 'localhost', details: 'Sparky OS Core Initialized.' }
];

// ========== REAL-TIME CPU CALCULATOR ==========
let currentCpuLoad = 0;

function getCPUInfo() {
    const cpus = os.cpus();
    let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;
    for (let cpu in cpus) {
        user += cpus[cpu].times.user;
        nice += cpus[cpu].times.nice;
        sys += cpus[cpu].times.sys;
        idle += cpus[cpu].times.idle;
        irq += cpus[cpu].times.irq;
    }
    return { idle, total: user + nice + sys + idle + irq };
}

let startMeasure = getCPUInfo();
setInterval(() => {
    const endMeasure = getCPUInfo();
    const idleDifference = endMeasure.idle - startMeasure.idle;
    const totalDifference = endMeasure.total - startMeasure.total;
    // Calculate percentage
    currentCpuLoad = 100 - Math.floor(100 * idleDifference / totalDifference);
    startMeasure = endMeasure;
}, 1000); // Recalculates true CPU load every 1 second


// ========== HELPER FUNCTIONS ==========

function addLog(type, ip, details) {
    securityLogs.unshift({ time: new Date().toLocaleTimeString(), type, ip, details });
    if (securityLogs.length > 20) securityLogs.pop(); // Keep only the last 20 logs
}

function formatUptime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
}

function updateActiveSession(sessionId) {
    sessionActivity.set(sessionId, Date.now());
    // prune sessions older than 1 hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (let [id, ts] of sessionActivity.entries()) {
        if (ts < oneHourAgo) sessionActivity.delete(id);
    }
}


// ========== AUTH ENDPOINTS ==========

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);
    
    if (user && user.password === password) {
        req.session.user = { username, role: user.role };
        addLog('Auth Success', req.ip || 'unknown', `User '${username}' logged into system.`);
        return res.json({ success: true, role: user.role });
    }
    
    addLog('Auth Failed', req.ip || 'unknown', `Failed login attempt for ID: '${username}'.`);
    res.status(401).json({ error: 'Invalid credentials' });
});

app.get('/api/check-auth', (req, res) => {
    if (req.session.user) {
        res.json({ authenticated: true });
    } else {
        res.status(401).json({ authenticated: false });
    }
});

app.get('/api/user', (req, res) => {
    if (req.session.user) {
        res.json({ authenticated: true, user: req.session.user });
    } else {
        res.status(401).json({ authenticated: false });
    }
});

app.post('/api/logout', (req, res) => {
    const user = req.session.user ? req.session.user.username : 'Unknown';
    req.session.destroy(err => {
        if (err) return res.status(500).json({ error: 'Logout failed' });
        addLog('Session Closed', req.ip || 'unknown', `User '${user}' de-authorized.`);
        res.json({ success: true });
    });
});


// ========== CONVERSATION TRACKING ==========

app.post('/api/conversation/new', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    stats.totalConversations++;
    updateActiveSession(req.sessionID);
    res.json({ success: true });
});


// ========== NVIDIA DEEPSEEK CHAT ENDPOINT ==========

app.post('/api/chat', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    stats.totalMessages++;
    updateActiveSession(req.sessionID);

    try {
        const response = await fetch(NVIDIA_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${NVIDIA_API_KEY}`
            },
            body: JSON.stringify(req.body)
        });

        if (!response.ok) {
            const err = await response.text();
            addLog('API Error', 'Nvidia Cluster', `Status ${response.status}: ${err.substring(0,50)}`);
            return res.status(response.status).json({ error: err });
        }

        // Stream the response back to the client
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const reader = response.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
        }
        res.end();

    } catch (error) {
        console.error(error);
        addLog('System Error', 'Local Node', error.message);
        res.status(500).json({ error: 'Server Error communicating with Nvidia' });
    }
});


// ========== REAL ADMIN ENDPOINTS ==========

// Middleware to protect admin routes
const requireAdmin = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden. Root access required.' });
    }
    next();
};

// 1. Fetch Real Hardware & System Stats
app.get('/api/admin/stats', requireAdmin, (req, res) => {
    // Calculate REAL RAM
    const totalRam = os.totalmem();
    const freeRam = os.freemem();
    const ramPercent = Math.round(((totalRam - freeRam) / totalRam) * 100);

    res.json({
        cpu: currentCpuLoad, // Uses our background 1-second interval calculator
        ram: ramPercent,
        uptime: formatUptime(process.uptime()),
        totalConversations: stats.totalConversations,
        totalMessages: stats.totalMessages,
        activeSessions: sessionActivity.size,
        logs: securityLogs,
        users: users.map(u => ({ username: u.username, role: u.role })) // Hide passwords from API
    });
});

// 2. Add New User
app.post('/api/admin/user', requireAdmin, (req, res) => {
    const { username, password, role } = req.body;
    
    // Prevent duplicate users
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'User identity already exists.' });
    }

    users.push({ username, password, role });
    addLog('User Created', req.ip, `Admin generated new identity: '${username}'.`);
    res.json({ success: true });
});

// 3. Edit User
app.put('/api/admin/user/:username', requireAdmin, (req, res) => {
    const { username } = req.params;
    const { password, role } = req.body;
    
    if (username === 'admin' && role !== 'admin') {
        return res.status(400).json({ error: 'Cannot demote root admin account.' });
    }
    
    let user = users.find(u => u.username === username);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    
    if (password) user.password = password;
    if (role) user.role = role;
    
    addLog('User Updated', req.ip, `Admin modified identity: '${username}'.`);
    res.json({ success: true });
});

// 4. Delete User
app.delete('/api/admin/user/:username', requireAdmin, (req, res) => {
    const { username } = req.params;
    
    if (username === 'admin') {
        return res.status(400).json({ error: 'Cannot delete root admin account.' });
    }
    
    users = users.filter(u => u.username !== username);
    addLog('User Deleted', req.ip, `Admin erased identity: '${username}'.`);
    res.json({ success: true });
});

// 5. Update Nvidia API Key
app.post('/api/admin/apikey', requireAdmin, (req, res) => {
    const { newKey } = req.body;
    if(newKey) {
        NVIDIA_API_KEY = newKey;
        addLog('Config Update', req.ip, 'Nvidia API Key was modified.');
        res.json({ success: true });
    } else {
        res.status(400).json({ error: "No key provided." });
    }
});

// 6. Kill/Reboot Node Server
app.post('/api/admin/reboot', requireAdmin, (req, res) => {
    addLog('System Reboot', req.ip, 'Root Admin triggered manual core reboot.');
    res.json({ success: true, message: "Initiating kill sequence..." });
    
    setTimeout(() => {
        console.log("Shutting down node per Admin UI request...");
        process.exit(0); 
    }, 1500);
});

// ========== START SERVER ==========
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 REAL Sparky Backend Server is running on http://localhost:${PORT}`);
});