const Stripe = require('stripe');

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://namenlos.black');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const { product } = req.body;

  // ─── Product definitions ───
  // Replace PRICE_IDs after creating products in Stripe Dashboard
  const products = {
    standard: {
      mode: 'payment',
      price: process.env.STRIPE_PRICE_STANDARD, // $25 one-time
      metadata: { bundle: 'standard', book: 'skin-me' }
    },
    premium: {
      mode: 'payment',
      price: process.env.STRIPE_PRICE_PREMIUM, // $49 one-time
      metadata: { bundle: 'premium', book: 'skin-me' }
    },
    subscription: {
      mode: 'subscription',
      price: process.env.STRIPE_PRICE_SUBSCRIPTION, // $7.99/month recurring
      metadata: { bundle: 'subscription', book: 'skin-me' }
    }
  };

  const selected = products[product];
  if (!selected) return res.status(400).json({ error: 'Invalid product' });

  try {
    const sessionParams = {
      mode: selected.mode,
      payment_method_types: ['card'],
      line_items: [{ price: selected.price, quantity: 1 }],
      metadata: selected.metadata,
      success_url: `https://namenlos.black/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://namenlos.black/skin-me.html#buy`,
      allow_promotion_codes: true,
      // Collect email for delivery
      ...(selected.mode === 'payment'
        ? { customer_creation: 'if_required' }
        : {}),
    };

    const session = await stripe.checkout.sessions.create(sessionParams);
    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    res.status(500).json({ error: 'Could not create checkout session' });
  }
};
