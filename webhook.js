import fetch from 'node-fetch';

const REAL_WEBHOOK_URL = 'https://discord.com/api/webhooks/your-real-webhook-id'; // Replace this with your actual webhook URL

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Check secret key to protect your webhook
  const secret = req.headers['x-webhook-secret'] || req.body?.secret;
  if (secret !== process.env.WEBHOOK_SECRET) {
    return res.status(403).json({ error: 'Forbidden: Invalid secret' });
  }

  try {
    const response = await fetch(REAL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: text });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
