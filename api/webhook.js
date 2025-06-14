export default async function handler(req, res) {
  const ACCEPTED_USER_AGENTS = [
    "codex android",
    "vega x android",
    "appleware ios",
    "delta android",
    "fluxus",
    "arceus x android",
    "trigon android",
    "evon android",
    "alysse android",
    "delta/v1.0",
    "roblox/darwinrobloxapp/0.626.1.6260363 (globaldist; robloxdirectdownload)",
    "hydrogen/v1.0",
    "hydrogen/v3.0",
    "roblox/wininet"
  ];

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const userAgent = req.headers['user-agent']?.toLowerCase() || '';
  const isAllowedUA = ACCEPTED_USER_AGENTS.includes(userAgent);

  const secretHeader = req.headers['x-webhook-secret'] || req.body?.secret || '';
  const expectedSecret = process.env.WEBHOOK_SECRET;

  const POOR_WEBHOOK_URL = process.env.POOR_WEBHOOK_URL;
  const RICH_WEBHOOK_URL = process.env.RICH_WEBHOOK_URL;

  if (!POOR_WEBHOOK_URL || !RICH_WEBHOOK_URL || !expectedSecret) {
    return res.status(500).json({ error: 'Webhook environment variables not set properly' });
  }

  // ✅ Validate secret
  if (secretHeader !== expectedSecret) {
    return res.status(403).json({ error: 'Forbidden: Invalid secret' });
  }

  // ✅ Validate user-agent
  if (!isAllowedUA) {
    return res.status(403).json({ error: 'Forbidden: Unauthorized user-agent' });
  }

  // Optional: Basic anti-mention check
  const containsMention = Object.values(req.body || {}).some(val =>
    typeof val === 'string' && val.includes('@')
  );
  if (containsMention) {
    return res.status(403).json({ error: 'Forbidden: Mention detected' });
  }

  // Pick webhook URL
  const target = req.body?.target === 'rich' ? 'rich' : 'poor';
  const REAL_WEBHOOK_URL = target === 'rich' ? RICH_WEBHOOK_URL : POOR_WEBHOOK_URL;

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

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error sending webhook:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
