// Vercel Serverless Function — Comments API
// Storage: GitHub Gist (private, no redeployments)
// Env vars needed: GH_TOKEN, COMMENTS_GIST_ID

const GIST_FILE = 'comments-skinme.json';
const MAX_COMMENTS = 500;
const MAX_NAME = 60;
const MAX_BODY = 1000;
const MIN_BODY = 3;
const RATE_LIMIT_MS = 60000; // 1 comment per minute per IP

// In-memory rate limit (per-instance, resets on cold start — good enough)
const rateLimits = new Map();

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://namenlos.black');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function sanitize(str) {
  return str.replace(/[<>]/g, '').trim();
}

async function getComments(token, gistId) {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'namenlos-comments'
    }
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const data = await res.json();
  const content = data.files[GIST_FILE]?.content || '[]';
  return JSON.parse(content);
}

async function saveComments(token, gistId, comments) {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'namenlos-comments'
    },
    body: JSON.stringify({
      files: {
        [GIST_FILE]: {
          content: JSON.stringify(comments, null, 2)
        }
      }
    })
  });
  if (!res.ok) throw new Error(`GitHub API save ${res.status}`);
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const token = process.env.GH_TOKEN;
  const gistId = process.env.COMMENTS_GIST_ID;

  if (!token || !gistId) {
    return res.status(500).json({ error: 'Comments not configured' });
  }

  try {
    // GET — read comments
    if (req.method === 'GET') {
      const comments = await getComments(token, gistId);
      res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
      return res.status(200).json({ comments });
    }

    // POST — add comment
    if (req.method === 'POST') {
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';

      // Rate limit
      const lastPost = rateLimits.get(ip);
      if (lastPost && Date.now() - lastPost < RATE_LIMIT_MS) {
        return res.status(429).json({ error: 'Please wait before posting again' });
      }

      const { name, body } = req.body || {};

      // Validate
      if (!name || typeof name !== 'string' || name.trim().length < 1 || name.trim().length > MAX_NAME) {
        return res.status(400).json({ error: 'Name required (1-60 chars)' });
      }
      if (!body || typeof body !== 'string' || body.trim().length < MIN_BODY || body.trim().length > MAX_BODY) {
        return res.status(400).json({ error: `Comment required (${MIN_BODY}-${MAX_BODY} chars)` });
      }

      const comment = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: sanitize(name).slice(0, MAX_NAME),
        body: sanitize(body).slice(0, MAX_BODY),
        ts: Date.now()
      };

      const comments = await getComments(token, gistId);
      comments.push(comment);

      // Keep only latest MAX_COMMENTS
      const trimmed = comments.slice(-MAX_COMMENTS);

      await saveComments(token, gistId, trimmed);

      rateLimits.set(ip, Date.now());

      return res.status(201).json({ comment });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('Comments API error:', err.message);
    return res.status(500).json({ error: 'Internal error' });
  }
}
