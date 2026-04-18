// Vercel serverless function — Social API proxy (LinkedIn + X/Twitter)
// Routes browser requests through Node.js to avoid CORS restrictions.

const ALLOWED_ORIGINS = [
  'https://api.linkedin.com/',
  'https://www.linkedin.com/oauth/',
  'https://api.twitter.com/',
  'https://api.x.com/',
  'https://upload.twitter.com/',
  'https://upload.x.com/'
];

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { liUrl, method = 'POST', liHeaders = {}, liBody, blobBase64 } = req.body;

    // Security: only proxy to allowed social API domains
    const allowed = ALLOWED_ORIGINS.some(o => liUrl && liUrl.startsWith(o));
    if (!allowed) {
      return res.status(403).json({ error: 'URL not allowed' });
    }

    let fetchBody;
    let fetchHeaders = { ...liHeaders };

    if (blobBase64) {
      fetchBody = Buffer.from(blobBase64, 'base64');
    } else if (liBody !== undefined) {
      const ct = (fetchHeaders['Content-Type'] || '').toLowerCase();
      if (ct.includes('x-www-form-urlencoded')) {
        fetchBody = typeof liBody === 'string' ? liBody : new URLSearchParams(liBody).toString();
      } else {
        fetchBody = JSON.stringify(liBody);
        if (!fetchHeaders['Content-Type']) fetchHeaders['Content-Type'] = 'application/json';
      }
    }

    const upstream = await fetch(liUrl, {
      method,
      headers: fetchHeaders,
      body: fetchBody
    });

    const resText = await upstream.text();
    const contentType = upstream.headers.get('content-type') || 'application/json';

    res.setHeader('Content-Type', contentType);
    return res.status(upstream.status).send(resText);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
