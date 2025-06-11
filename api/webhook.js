// api/webhook.js

export default async function handler(req, res) {
  console.log('Received request:', req.method, req.headers, req.body);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const secretHeader = req.headers['x-webhook-secret'] || req.body?.secret;
  const expectedSecret = process.env.WEBHOOK_SECRET;

  console.log('Secret header:', secretHeader);
  console.log('Expected secret:', expectedSecret);

  if (secretHeader !== expectedSecret) {
    return res.status(403).json({ error: 'Forbidden: Invalid secret' });
  }

  const REAL_WEBHOOK_URL = 'https://discord.com/api/webhooks/1382254617387077703/0CXY2oWRwvH-4CY4rHQwBYxqy0nCX2aD7jY8g9st1y1O90cbeHHN69cmn0kjUF7xapd8';

  try {
    const response = await fetch(REAL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      const text = await response.text();
      console.log('Discord webhook error:', text);
      return res.status(response.status).json({ error: text });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error sending webhook:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
