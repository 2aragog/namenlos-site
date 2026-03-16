const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Allowed files (whitelist to prevent path traversal)
const ALLOWED_FILES = new Set([
  'skin-me.pdf',
  'skin-me.epub',
  'skin-me-soundtrack.zip',
  'skin-me-art.zip',
  'skin-me-clips.zip',
  'skin-me-audiobook.zip',
  'skin-me-ep01.pdf',
]);

const MIME_TYPES = {
  '.pdf': 'application/pdf',
  '.epub': 'application/epub+zip',
  '.zip': 'application/zip',
  '.mp3': 'audio/mpeg',
};

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { sid, exp, token, file } = req.query;

  if (!sid || !exp || !token || !file) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  // ─── Verify token ───
  const secret = process.env.DOWNLOAD_SECRET || 'namenlos-default-secret';
  const expectedToken = crypto
    .createHmac('sha256', secret)
    .update(`${sid}:${exp}`)
    .digest('hex');

  if (token !== expectedToken) {
    return res.status(403).json({ error: 'Invalid token' });
  }

  // ─── Check expiry ───
  const now = Math.floor(Date.now() / 1000);
  if (now > parseInt(exp, 10)) {
    return res.status(410).json({ error: 'Download link expired. Contact support.' });
  }

  // ─── Validate filename ───
  const filename = path.basename(file);
  if (!ALLOWED_FILES.has(filename)) {
    return res.status(404).json({ error: 'File not found' });
  }

  // ─── Serve file ───
  // Files are stored in /files/ directory (add to your repo or use external storage)
  // Option A: Local files in repo (for smaller files)
  const filePath = path.join(process.cwd(), 'files', filename);

  if (!fs.existsSync(filePath)) {
    // If file doesn't exist locally, redirect to external storage
    // Option B: Redirect to external storage (S3, Vercel Blob, etc.)
    const externalBase = process.env.FILES_BASE_URL;
    if (externalBase) {
      return res.redirect(302, `${externalBase}/${filename}`);
    }
    return res.status(404).json({ error: 'File not available yet. Contact support.' });
  }

  const ext = path.extname(filename);
  const mime = MIME_TYPES[ext] || 'application/octet-stream';

  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
};
