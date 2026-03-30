const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const os = require('os');
const path = require('path');

const app = express();

// CRITICAL FOR VERCEL
app.set('trust proxy', 1);

app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(__dirname));

const JWT_SECRET = process.env.JWT_SECRET || 'sparky-super-secret-jwt-key-change-this';

let NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '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';
const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
let isMaintenanceMode = false;

let users = [
    { username: 'admin', password: '2468', role: 'admin' },
    { username: 'sparky', password: '1111', role: 'admin' },
    { username: 'jeevan',  password: '1234',   role: 'user' },
    { username: 'disha',  password: '1234',   role: 'user' },
    { username: 'riya',  password: '1234',   role: 'user' },
    { username: 'shraddha',  password: '2006',   role: 'user' },
    { username: 'shubh',  password: '2006',   role: 'admin' },
    { username: 'user',  password: '1234',   role: 'user' }
];

let stats = { totalConversations: 0, totalMessages: 0 };
const sessionActivity = new Map(); 

let securityLogs = [
    { time: new Date().toLocaleTimeString(), type: 'System Boot', ip: '127.0.0.1', details: 'Sparky OS Core Initialized (JWT Mode).' }
];

function getCPULoad() {
    const cpus = os.cpus();
    if (!cpus || cpus.length === 0) return 0;
    const load = os.loadavg()[0];
    return Math.min(100, Math.round((load / cpus.length) * 100));
}

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

const requireAuth = (req, res, next) => {
    const token = req.cookies.sparky_auth;
    if (!token) return res.status(401).json({ error: 'Unauthorized. Missing token.' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
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

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);
    
    if (user && user.password === password) {
        if (isMaintenanceMode && user.role !== 'admin') {
            addLog('Auth Blocked', req.ip || 'unknown', `User '${username}' blocked by Maintenance Mode.`);
            return res.status(403).json({ error: 'SYSTEM IN MAINTENANCE. ADMIN ACCESS ONLY.' });
        }

        const token = jwt.sign(
            { username: user.username, role: user.role }, 
            JWT_SECRET, 
            { expiresIn: '1d' }
        );

        // --- CRITICAL COOKIE FIX HERE ---
        res.cookie('sparky_auth', token, {
            httpOnly: true,
            secure: true, 
            sameSite: 'none', 
            path: '/', 
            maxAge: 24 * 60 * 60 * 1000
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
    // --- CRITICAL LOGOUT COOKIE FIX HERE ---
    res.clearCookie('sparky_auth', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/'
    });
    addLog('Session Closed', req.ip || 'unknown', `User de-authorized.`);
    res.json({ success: true });
});

app.post('/api/conversation/new', requireAuth, (req, res) => {
    res.json({ success: true });
});

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

        req.on('close', () => {
            reader.cancel().catch(() => {});
        });

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
        }
        res.end();
    } catch (error) {
        addLog('System Error', 'Local Node', error.message);
        res.status(500).json({ error: 'Server Error communicating with Nvidia' });
    }
});

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
        cpu: getCPULoad(), ram: ramPercent, uptime: formatUptime(process.uptime()),
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

// CRITICAL FOR VERCEL
module.exports = app;
