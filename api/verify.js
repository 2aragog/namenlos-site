const Stripe = require('stripe');
const crypto = require('crypto');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://namenlos.black');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const { session_id } = req.query;

  if (!session_id) return res.status(400).json({ error: 'Missing session_id' });

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);

    // Verify payment is complete
    if (session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'Payment not completed' });
    }

    const bundle = session.metadata?.bundle;
    const customerEmail = session.customer_details?.email || '';

    // ─── Generate time-limited download token ───
    // Token expires in 24 hours
    const expiry = Math.floor(Date.now() / 1000) + 86400;
    const secret = process.env.DOWNLOAD_SECRET || 'namenlos-default-secret';
    const token = crypto
      .createHmac('sha256', secret)
      .update(`${session_id}:${expiry}`)
      .digest('hex');

    // ─── Download URLs per bundle ───
    // Files are served through /api/download with token verification
    const baseDownload = `/api/download?sid=${session_id}&exp=${expiry}&token=${token}`;

    const downloads = {
      standard: [
        { name: 'Skin Me — Ebook (PDF)', file: 'skin-me.pdf', icon: '📖' },
        { name: 'Skin Me — Ebook (EPUB)', file: 'skin-me.epub', icon: '📖' },
        { name: 'Soundtrack — 20 Tracks (ZIP)', file: 'skin-me-soundtrack.zip', icon: '♫' },
        { name: 'Character Art Collection (ZIP)', file: 'skin-me-art.zip', icon: '🎨' },
      ],
      premium: [
        { name: 'Skin Me — Ebook (PDF)', file: 'skin-me.pdf', icon: '📖' },
        { name: 'Skin Me — Ebook (EPUB)', file: 'skin-me.epub', icon: '📖' },
        { name: 'Soundtrack — 20 Tracks (ZIP)', file: 'skin-me-soundtrack.zip', icon: '♫' },
        { name: 'Character Art Collection (ZIP)', file: 'skin-me-art.zip', icon: '🎨' },
        { name: '15 Exclusive Video Clips (ZIP)', file: 'skin-me-clips.zip', icon: '▶' },
        { name: 'Full Audiobook (MP3)', file: 'skin-me-audiobook.zip', icon: '♪' },
      ],
      subscription: [
        { name: 'Episode 1', file: 'skin-me-ep01.pdf', icon: '📖' },
      ],
    };

    const files = (downloads[bundle] || []).map(f => ({
      ...f,
      url: `${baseDownload}&file=${encodeURIComponent(f.file)}`
    }));

    res.status(200).json({
      success: true,
      bundle,
      email: customerEmail,
      files,
      expires_at: new Date(expiry * 1000).toISOString(),
    });
  } catch (err) {
    console.error('Verify error:', err.message);
    if (err.type === 'StripeInvalidRequestError') {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.status(500).json({ error: 'Verification failed' });
  }
};
