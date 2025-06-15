// api/webhook.js
export default async function handler(req, res) {
  return res.status(200).json({ 
    working: true,
    message: "API is online!",
    time: new Date().toISOString()
  });
}
