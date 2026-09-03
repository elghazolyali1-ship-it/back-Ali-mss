const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'wedding';
const collectionName = 'rsvps';

let cachedClient = null;

async function getClient() {
  if (cachedClient) return cachedClient;
  if (!uri) throw new Error('MONGODB_URI is not set');
  const client = new MongoClient(uri);
  await client.connect();
  cachedClient = client;
  return client;
}

module.exports = async (req, res) => {
  // Allow the invitation page (hosted anywhere) to call this API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const client = await getClient();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    if (req.method === 'POST') {
      const body = req.body || {};
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const attending = typeof body.attending === 'string' ? body.attending.trim() : '';
      const message = typeof body.message === 'string' ? body.message.trim() : '';

      if (!name || !attending) {
        return res.status(400).json({ ok: false, error: 'الاسم وتأكيد الحضور مطلوبان' });
      }

      const doc = {
        name,
        attending,
        message,
        createdAt: new Date(),
      };

      await collection.insertOne(doc);
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'GET') {
      // Simple protection: /api/rsvp?key=YOUR_ADMIN_KEY
      const key = req.query.key;
      if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
        return res.status(401).json({ ok: false, error: 'unauthorized' });
      }
      const results = await collection.find({}).sort({ createdAt: -1 }).toArray();
      return res.status(200).json({ ok: true, count: results.length, results });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'خطأ في الخادم' });
  }
};
