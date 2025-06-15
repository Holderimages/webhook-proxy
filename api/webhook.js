const crypto = require('crypto');

// In-memory key store (use a DB like Redis in production for persistence)
const keyStore = new Map();

// Generate a cryptographically secure key
function generateKey() {
    return crypto.randomBytes(32).toString('hex'); // 256-bit key
}

// Clean up expired keys
function cleanupKeys() {
    const now = Date.now();
    for (const [key, data] of keyStore) {
        if (now > data.expiresAt) {
            keyStore.delete(key);
        }
    }
}

// Vercel serverless function
export default async function handler(req, res) {
    console.log('Received request:', req.method, req.headers, req.body);

    // Enable CORS for Roblox HttpService
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, x-secret');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Validate secret
    const secret = req.headers['x-secret'];
    if (secret !== process.env.SECRET_KEY) {
        return res.status(403).json({ error: 'Forbidden: Invalid secret' });
    }

    const path = req.url.split('/').pop();

    if (path === 'generate-key') {
        const key = generateKey();
        const expirationTime = Date.now() + 30 * 1000; // 30 seconds

        keyStore.set(key, {
            expiresAt: expirationTime,
            used: false
        });

        cleanupKeys();

        return res.status(200).json({ key });
    }

    if (path === 'webhook') {
        const authHeader = req.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid Authorization header' });
        }

        const key = authHeader.split(' ')[1];
        const keyData = keyStore.get(key);

        if (!keyData) {
            return res.status(404).json({ error: 'Key not found or expired' });
        }

        if (keyData.used) {
            return res.status(403).json({ error: 'Key already used' });
        }

        if (Date.now() > keyData.expiresAt) {
            keyStore.delete(key);
            return res.status(403).json({ error: 'Key expired' });
        }

        // Mark key as used and delete it
        keyData.used = true;
        keyStore.delete(key);

        // Define Discord webhook URLs from environment variables
        const POOR_WEBHOOK_URL = process.env.POOR_WEBHOOK_URL;
        const RICH_WEBHOOK_URL = process.env.RICH_WEBHOOK_URL;

        // Decide which webhook to use
        const target = req.body?.target || 'poor'; // Default to 'poor'
        let REAL_WEBHOOK_URL = target === 'rich' ? RICH_WEBHOOK_URL : POOR_WEBHOOK_URL;

        try {
            const response = await fetch(REAL_WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(req.body)
            });

            if (!response.ok) {
                throw new Error(`Discord webhook failed: ${response.statusText}`);
            }

            return res.status(200).json({ message: 'Webhook processed successfully', data: req.body });
        } catch (error) {
            console.error('Error forwarding to Discord:', error);
            return res.status(500).json({ error: 'Failed to forward webhook' });
        }
    }

    return res.status(404).json({ error: 'Endpoint not found' });
}
