const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const os = require('os');
const path = require('path');

const app = express();

// Enable CORS with credentials (cookies)
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(cookieParser()); // Required to read the JWT cookie
app.use(express.static(__dirname));

// JWT Secret Key - Set this in Vercel Environment Variables!
const JWT_SECRET = process.env.JWT_SECRET || 'sparky-super-secret-jwt-key-change-this';

// ========== SYSTEM STATE (In-Memory) ==========
let NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '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';
const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
let isMaintenanceMode = false;

// Default Users Array
let users = [
    { username: 'admin', password: '2468', role: 'admin' },
    { username: 'sparky', password: '1111', role: 'admin' },
    { username: 'jeevan',  password: '1234',   role: 'user' },
    { username: 'disha',  password: '1234',   role: 'user' },
    { username: 'riya',  password: '1234',   role: 'user' },
    { username: 'shraddha',  password: '2006',   role: 'user' },
    { username: 'kunal',  password: '2004',   role: 'user' },
    { username: 'shubh',  password: '2006',   role: 'admin' },
    { username: 'user',  password: '1234',   role: 'user' }
];

let stats = { totalConversations: 0, totalMessages: 0 };
// We track active JWTs by decoding them on requests to simulate active sessions
const sessionActivity = new Map(); 

// Default Security Logs Array
let securityLogs = [
    { time: new Date().toLocaleTimeString(), type: 'System Boot', ip: 'localhost', details: 'Sparky OS Core Initialized (JWT Mode).' }
];

// ========== REAL-TIME CPU CALCULATOR ==========
let currentCpuLoad = 0;
function getCPUInfo() {
    const cpus = os.cpus();
    let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;
    for (let cpu in cpus) {
        user += cpus[cpu].times.user; nice += cpus[cpu].times.nice;
        sys += cpus[cpu].times.sys; idle += cpus[cpu].times.idle; irq += cpus[cpu].times.irq;
    }
    return { idle, total: user + nice + sys + idle + irq };
}
let startMeasure = getCPUInfo();
setInterval(() => {
    const endMeasure = getCPUInfo();
    const idleDifference = endMeasure.idle - startMeasure.idle;
    const totalDifference = endMeasure.total - startMeasure.total;
    currentCpuLoad = 100 - Math.floor(100 * idleDifference / totalDifference);
    startMeasure = endMeasure;
}, 1000);

// ========== HELPER FUNCTIONS ==========
function addLog(type, ip, details) {
    securityLogs.unshift({ time: new Date().toLocaleTimeString(), type, ip, details });
    if (securityLogs.length > 20) securityLogs.pop();
}

function formatUptime(seconds) {
    const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
}

function updateActiveSession(username) {
    sessionActivity.set(username, Date.now());
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (let [id, ts] of sessionActivity.entries()) { if (ts < oneHourAgo) sessionActivity.delete(id); }
}

// ========== JWT AUTH MIDDLEWARE ==========
const requireAuth = (req, res, next) => {
    const token = req.cookies.sparky_auth;
    if (!token) return res.status(401).json({ error: 'Unauthorized. Missing token.' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Attach user info to the request
        updateActiveSession(req.user.username);
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid or expired token.' });
    }
};

const requireAdmin = (req, res, next) => {
    requireAuth(req, res, () => {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden. Root access required.' });
        }
        next();
    });
};

// ========== AUTH ENDPOINTS ==========
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);
    
    if (user && user.password === password) {
        if (isMaintenanceMode && user.role !== 'admin') {
            addLog('Auth Blocked', req.ip || 'unknown', `User '${username}' blocked by Maintenance Mode.`);
            return res.status(403).json({ error: 'SYSTEM IN MAINTENANCE. ADMIN ACCESS ONLY.' });
        }

        // Generate JWT
        const token = jwt.sign(
            { username: user.username, role: user.role }, 
            JWT_SECRET, 
            { expiresIn: '1d' }
        );

        // Set JWT as an HTTP-Only Cookie
        res.cookie('sparky_auth', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // True on Vercel
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        });

        addLog('Auth Success', req.ip || 'unknown', `User '${username}' logged into system via JWT.`);
        return res.json({ success: true, role: user.role });
    }
    
    addLog('Auth Failed', req.ip || 'unknown', `Failed login attempt for ID: '${username}'.`);
    res.status(401).json({ error: 'Invalid credentials' });
});

app.get('/api/check-auth', requireAuth, (req, res) => {
    res.json({ authenticated: true });
});

app.get('/api/user', requireAuth, (req, res) => {
    res.json({ authenticated: true, user: req.user });
});

app.post('/api/logout', (req, res) => {
    // Clear the JWT cookie
    res.clearCookie('sparky_auth');
    addLog('Session Closed', req.ip || 'unknown', `User de-authorized.`);
    res.json({ success: true });
});

// ========== NVIDIA DEEPSEEK CHAT ENDPOINT ==========
app.post('/api/chat', requireAuth, async (req, res) => {
    if (isMaintenanceMode && req.user.role !== 'admin') return res.status(403).json({ error: 'System down for maintenance.' });

    stats.totalMessages++;

    try {
        const response = await fetch(NVIDIA_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${NVIDIA_API_KEY}` },
            body: JSON.stringify(req.body)
        });

        if (!response.ok) {
            const err = await response.text();
            addLog('API Error', 'Nvidia Cluster', `Status ${response.status}: ${err.substring(0,50)}`);
            return res.status(response.status).json({ error: err });
        }

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
        addLog('System Error', 'Local Node', error.message);
        res.status(500).json({ error: 'Server Error communicating with Nvidia' });
    }
});

// ========== REAL ADMIN ENDPOINTS ==========
app.post('/api/admin/maintenance', requireAdmin, (req, res) => {
    isMaintenanceMode = req.body.active === true;
    const action = isMaintenanceMode ? 'ENGAGED. Standard users locked out.' : 'LIFTED. System open.';
    addLog('System Alert', req.ip, `Maintenance Mode ${action}`);
    res.json({ success: true, maintenanceMode: isMaintenanceMode });
});

app.get('/api/admin/stats', requireAdmin, (req, res) => {
    const totalRam = os.totalmem(); const freeRam = os.freemem();
    const ramPercent = Math.round(((totalRam - freeRam) / totalRam) * 100);

    res.json({
        cpu: currentCpuLoad, ram: ramPercent, uptime: formatUptime(process.uptime()),
        totalConversations: stats.totalConversations, totalMessages: stats.totalMessages,
        activeSessions: sessionActivity.size, maintenanceMode: isMaintenanceMode,
        logs: securityLogs, 
        users: users.map(u => ({ username: u.username, role: u.role })) 
    });
});

app.post('/api/admin/user', requireAdmin, (req, res) => {
    const { username, password, role } = req.body;
    if (users.find(u => u.username === username)) return res.status(400).json({ error: 'Identity already exists.' });

    users.push({ username, password, role });
    addLog('User Created', req.ip, `Admin generated new identity: '${username}'.`);
    res.json({ success: true });
});

app.put('/api/admin/user/:username', requireAdmin, (req, res) => {
    const { username } = req.params; const { password, role } = req.body;
    if (username === 'admin' && role !== 'admin') return res.status(400).json({ error: 'Cannot demote root.' });
    
    let user = users.find(u => u.username === username);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (password) user.password = password;
    if (role) user.role = role;
    
    addLog('User Updated', req.ip, `Admin modified identity: '${username}'.`);
    res.json({ success: true });
});

app.delete('/api/admin/user/:username', requireAdmin, (req, res) => {
    const { username } = req.params;
    if (username === 'admin') return res.status(400).json({ error: 'Cannot delete root.' });
    
    users = users.filter(u => u.username !== username);
    addLog('User Deleted', req.ip, `Admin erased identity: '${username}'.`);
    res.json({ success: true });
});

app.post('/api/admin/apikey', requireAdmin, (req, res) => {
    if(req.body.newKey) {
        NVIDIA_API_KEY = req.body.newKey;
        addLog('Config Update', req.ip, 'Nvidia API Key was modified.');
        res.json({ success: true });
    } else res.status(400).json({ error: "No key provided." });
});

app.post('/api/admin/reboot', requireAdmin, (req, res) => {
    addLog('System Reboot', req.ip, 'Root Admin triggered manual core reboot.');
    res.json({ success: true, message: "Initiating kill sequence..." });
    if (process.env.NODE_ENV !== 'production') setTimeout(() => process.exit(0), 1500);
});

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🚀 Sparky Core running in JWT Mode on http://localhost:${PORT}`));
}

module.exports = app;
