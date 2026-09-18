// src/create-order.js
// Creates a Razorpay order in either USD or INR. Prices are imported from
// prices.js (repo root) — the single source of truth shared with script.js
// — so the browser's displayed price and the amount actually charged here
// can never drift apart. The browser only ever sends item IDs + a currency
// choice; nobody can edit the cart in devtools and pay less than the real
// price, since this function looks the price up itself.

import { PRICES, usdToInr } from '../prices.js';
import { verifyFirebaseToken } from './verify-firebase-token.js';
import { createPurchaseDoc } from './firestore.js';

export async function handleCreateOrder(request, env) {
  // Require login: purchases must be attached to a real, verified account,
  // not just whatever uid the browser claims to be.
  const authHeader = request.headers.get('Authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) {
    return json({ error: 'Please sign in before checking out.' }, 401);
  }

  let uid, email;
  try {
    ({ uid, email } = await verifyFirebaseToken(idToken, env.FIREBASE_PROJECT_ID));
  } catch {
    return json({ error: 'Your session has expired. Please sign in again.' }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const items = Array.isArray(body.items) ? [...new Set(body.items)] : [];
  if (items.length === 0) {
    return json({ error: 'Cart is empty' }, 400);
  }

  const currency = body.currency === 'INR' ? 'INR' : 'USD';

  let total = 0;
  for (const id of items) {
    const usd = PRICES[id];
    if (usd === undefined) {
      return json({ error: `Unknown item: ${id}` }, 400);
    }
    total += currency === 'INR' ? usdToInr(usd) : usd;
  }

  const amount = Math.round(total * 100); // smallest unit — cents or paise, both x100

  const keyId = env.RAZORPAY_KEY_ID;
  const keySecret = env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return json({ error: 'Payment configuration missing on server' }, 500);
  }

  const auth = btoa(`${keyId}:${keySecret}`);

  let rzpRes;
  try {
    rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount,
        currency,
        receipt: `md_${Date.now()}`,
        notes: { items: items.join(',') },
      }),
    });
  } catch {
    return json({ error: 'Could not reach Razorpay' }, 502);
  }

  const order = await rzpRes.json();

  if (!rzpRes.ok) {
    // Common causes here: international payments not enabled for USD, or
    // (much less likely) INR not enabled on a non-Indian-registered account.
    return json({ error: order.error?.description || 'Could not create order' }, 502);
  }

  // Record the order right away (status "created") so there's a trail even
  // if the user closes the checkout modal before paying. verify-payment.js
  // flips this to "paid" once the signature checks out.
  try {
    await createPurchaseDoc(env, order.id, {
      uid,
      email: email || '',
      items,
      amount,
      currency,
      status: 'created',
      createdAt: new Date(),
    });
  } catch (err) {
    // Don't block checkout on a Firestore hiccup — the payment itself is
    // what matters. Surface it so it's visible in `wrangler tail`, though.
    console.error('Failed to record pending purchase:', err.message);
  }

  return json({
    order_id: order.id,
    amount: order.amount,
    currency: order.currency,
    key_id: keyId,
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
