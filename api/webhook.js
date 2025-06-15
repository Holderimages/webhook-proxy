// api/webhook.js

export default async function handler(req, res) {
console.log('Received request:', req.method, req.headers, req.body);

@@ -17,7 +15,20 @@ export default async function handler(req, res) {
return res.status(403).json({ error: 'Forbidden: Invalid secret' });
}

  const REAL_WEBHOOK_URL = 'https://discord.com/api/webhooks/1382410476356374718/rzBH0rAwrNC9geMVhXDnHgHHvT8VkVxunu2QshPUuWQhVX56uNY4MpMWtytLJCuDQkhG';
  // Define both real webhook URLs:
  const POOR_WEBHOOK_URL = 'https://discord.com/api/webhooks/1382410476356374718/rzBH0rAwrNC9geMVhXDnHgHHvT8VkVxunu2QshPUuWQhVX56uNY4MpMWtytLJCuDQkhG';
  const RICH_WEBHOOK_URL = 'https://discord.com/api/webhooks/1374032368717004950/zdM2ZT66WiE0wls1Z5CC38Awjci0f6SYwM--NuUVPwSAswUhqgdy8XJQUfykTCcfJ4Pb';

  // Decide which webhook to use:
  // Option 1: Check if client sent a "target" field in JSON body
  const target = req.body?.target || 'poor'; // default to 'poor' if missing

  let REAL_WEBHOOK_URL;
  if (target === 'rich') {
    REAL_WEBHOOK_URL = RICH_WEBHOOK_URL;
  } else {
    REAL_WEBHOOK_URL = POOR_WEBHOOK_URL;
  }

try {
const response = await fetch(REAL_WEBHOOK_URL, {
