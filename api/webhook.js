// api/webhook.js
export default async function handler(req, res) {
  // Immediate response for all requests
  return res.status(200).json({
    status: 'online',
    path: req.url,
    method: req.method,
    time: new Date().toISOString()
  });
}
