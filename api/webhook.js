const Stripe = require('stripe');

// Vercel needs raw body for webhook signature verification
// Set in vercel.json: "api/webhook": { "bodyParser": false }
const getRawBody = (req) =>
  new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ─── Handle events ───
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      console.log(`✅ Payment complete: ${session.metadata?.bundle} — ${session.customer_details?.email}`);
      // Future: send confirmation email, log to database, etc.
      break;
    }
    case 'customer.subscription.created': {
      const sub = event.data.object;
      console.log(`✅ New subscription: ${sub.id}`);
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      console.log(`❌ Subscription cancelled: ${sub.id}`);
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      console.log(`⚠ Payment failed: ${invoice.customer_email}`);
      break;
    }
    default:
      // Unhandled event type
      break;
  }

  res.status(200).json({ received: true });
};
