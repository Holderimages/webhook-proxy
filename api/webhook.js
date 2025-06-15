// api/webhook.js
const crypto = require('crypto');

// In-memory storage for keys (for production, consider using a database or Vercel KV)
const usedKeys = new Set();
const activeKeys = new Map();

export default async function handler(req, res) {
  console.log('Received request:', req.method);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify secret if needed
  const AUTH_SECRET = process.env.AUTH_SECRET;
  if (AUTH_SECRET && req.headers['x-auth-secret'] !== AUTH_SECRET) {
    return res.status(403).json({ error: 'Forbidden: Invalid secret' });
  }

  // Handle key generation
  if (req.body?.action === 'generate_key') {
    try {
      const key = crypto.randomBytes(32).toString('hex');
      const timestamp = Date.now();
      
      const timeout = setTimeout(() => {
        activeKeys.delete(key);
      }, 30000); // 30 seconds
      
      activeKeys.set(key, { 
        generatedAt: timestamp,
        timeout 
      });
      
      return res.status(200).json({ 
        key,
        expires_in: 30000,
        generated_at: timestamp 
      });
    } catch (error) {
      console.error('Key generation error:', error);
      return res.status(500).json({ error: 'Failed to generate key' });
    }
  }

  // Handle webhook forwarding
  if (req.body?.key) {
    const { key } = req.body;
    
    if (!activeKeys.has(key)) {
      return res.status(400).json({ 
        error: 'Invalid key or key expired' 
      });
    }
    
    // Clean up key
    const keyData = activeKeys.get(key);
    clearTimeout(keyData.timeout);
    activeKeys.delete(key);
    usedKeys.add(key);
    
    // Get webhook URLs from environment
    const POOR_WEBHOOK_URL = process.env.POOR_WEBHOOK_URL;
    const RICH_WEBHOOK_URL = process.env.RICH_WEBHOOK_URL;
    
    if (!POOR_WEBHOOK_URL || !RICH_WEBHOOK_URL) {
      return res.status(500).json({ error: 'Server misconfigured' });
    }

    const target = req.body?.target || 'poor';
    const webhookUrl = target === 'rich' ? RICH_WEBHOOK_URL : POOR_WEBHOOK_URL;

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body.payload || {}),
      });

      if (!response.ok) {
        throw new Error(`Webhook error: ${response.status}`);
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Webhook forwarding error:', error);
      return res.status(502).json({ error: 'Failed to forward to webhook' });
    }
  }

  return res.status(400).json({ error: 'Invalid request' });
}
