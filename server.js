require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');

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
    secret: process.env.SESSION_SECRET || 'sparky-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
}));

// ========== DATABASE CONNECTION (MONGODB) ==========
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sparkyos';

mongoose.connect(MONGO_URI)
    .then(() => console.log('Neural Link Database: CONNECTED'))
    .catch(err => console.error('Database Connection Failed:', err));

// --- Schemas ---
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user' }
});
const User = mongoose.model('User', UserSchema);

const LogSchema = new mongoose.Schema({
    time: String,
    type: String,
    ip: String,
    details: String,
    createdAt: { type: Date, default: Date.now, expires: 604800 } // Auto-delete logs after 7 days
});
const Log = mongoose.model('Log', LogSchema);

// Initial DB Seed (Creates root admin if database is empty)
User.findOne({ username: 'admin' }).then(admin => {
    if (!admin) User.create({ username: 'admin', password: 'sparky123', role: 'admin' });
});


// ========== SYSTEM STATE (In-Memory) ==========
let NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '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';
const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
let isMaintenanceMode = false;
let stats = { totalConversations: 0, totalMessages: 0 };
const sessionActivity = new Map();

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
async function addLog(logType, ip, details) {
    try {
        await Log.create({ time: new Date().toLocaleTimeString(), type: logType, ip, details });
    } catch (err) { console.error("Log failed:", err); }
}

function formatUptime(seconds) {
    const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
}

function updateActiveSession(sessionId) {
    sessionActivity.set(sessionId, Date.now());
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (let [id, ts] of sessionActivity.entries()) { if (ts < oneHourAgo) sessionActivity.delete(id); }
}


// ========== AUTH ENDPOINTS ==========
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        const user = await User.findOne({ username });
        
        if (user && user.password === password) {
            if (isMaintenanceMode && user.role !== 'admin') {
                addLog('Auth Blocked', req.ip || 'unknown', `User '${username}' blocked by Maintenance Mode.`);
                return res.status(403).json({ error: 'SYSTEM IN MAINTENANCE. ADMIN ACCESS ONLY.' });
            }

            req.session.user = { username, role: user.role };
            addLog('Auth Success', req.ip || 'unknown', `User '${username}' logged into system.`);
            return res.json({ success: true, role: user.role });
        }
        
        addLog('Auth Failed', req.ip || 'unknown', `Failed login attempt for ID: '${username}'.`);
        res.status(401).json({ error: 'Invalid credentials' });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/check-auth', (req, res) => {
    if (req.session.user) res.json({ authenticated: true });
    else res.status(401).json({ authenticated: false });
});

app.get('/api/user', (req, res) => {
    if (req.session.user) res.json({ authenticated: true, user: req.session.user });
    else res.status(401).json({ authenticated: false });
});

app.post('/api/logout', (req, res) => {
    const user = req.session.user ? req.session.user.username : 'Unknown';
    req.session.destroy(err => {
        if (err) return res.status(500).json({ error: 'Logout failed' });
        addLog('Session Closed', req.ip || 'unknown', `User '${user}' de-authorized.`);
        res.json({ success: true });
    });
});


// ========== NVIDIA DEEPSEEK CHAT ENDPOINT ==========
app.post('/api/chat', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    if (isMaintenanceMode && req.session.user.role !== 'admin') return res.status(403).json({ error: 'System down for maintenance.' });

    stats.totalMessages++;
    updateActiveSession(req.sessionID);

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
const requireAdmin = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden. Root access required.' });
    next();
};

app.post('/api/admin/maintenance', requireAdmin, (req, res) => {
    isMaintenanceMode = req.body.active === true;
    const action = isMaintenanceMode ? 'ENGAGED. Standard users locked out.' : 'LIFTED. System open.';
    addLog('System Alert', req.ip, `Maintenance Mode ${action}`);
    res.json({ success: true, maintenanceMode: isMaintenanceMode });
});

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
    const totalRam = os.totalmem(); const freeRam = os.freemem();
    const ramPercent = Math.round(((totalRam - freeRam) / totalRam) * 100);

    try {
        const dbUsers = await User.find({}, '-password');
        const dbLogs = await Log.find().sort({ createdAt: -1 }).limit(20);

        res.json({
            cpu: currentCpuLoad, ram: ramPercent, uptime: formatUptime(process.uptime()),
            totalConversations: stats.totalConversations, totalMessages: stats.totalMessages,
            activeSessions: sessionActivity.size, maintenanceMode: isMaintenanceMode,
            logs: dbLogs, users: dbUsers
        });
    } catch (err) { res.status(500).json({ error: "Failed to fetch stats" }); }
});

app.post('/api/admin/user', requireAdmin, async (req, res) => {
    const { username, password, role } = req.body;
    try {
        const existing = await User.findOne({ username });
        if (existing) return res.status(400).json({ error: 'Identity already exists.' });

        await User.create({ username, password, role });
        addLog('User Created', req.ip, `Admin generated new identity: '${username}'.`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

app.put('/api/admin/user/:username', requireAdmin, async (req, res) => {
    const { username } = req.params; const { password, role } = req.body;
    if (username === 'admin' && role !== 'admin') return res.status(400).json({ error: 'Cannot demote root.' });
    
    try {
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ error: 'User not found.' });

        if (password) user.password = password;
        if (role) user.role = role;
        await user.save();
        
        addLog('User Updated', req.ip, `Admin modified identity: '${username}'.`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

app.delete('/api/admin/user/:username', requireAdmin, async (req, res) => {
    const { username } = req.params;
    if (username === 'admin') return res.status(400).json({ error: 'Cannot delete root.' });
    
    try {
        await User.deleteOne({ username });
        addLog('User Deleted', req.ip, `Admin erased identity: '${username}'.`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
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
    app.listen(PORT, () => console.log(`🚀 Sparky DB Node running on http://localhost:${PORT}`));
}

module.exports = app;