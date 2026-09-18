// src/verify-payment.js
// Confirms a payment is genuinely from Razorpay by recomputing the HMAC
// signature server-side. Never trust the "success" callback in the browser
// alone; it can be faked in devtools.

import { markPurchasePaid, getPurchaseDoc } from './firestore.js';
import { sendEmail, orderSummaryHtml } from './email.js';

export async function handleVerifyPayment(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ verified: false, error: 'Invalid request body' }, 400);
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return json({ verified: false, error: 'Missing fields' }, 400);
  }

  const keySecret = env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return json({ verified: false, error: 'Payment configuration missing on server' }, 500);
  }

  const expected = await hmacSha256Hex(keySecret, `${razorpay_order_id}|${razorpay_payment_id}`);
  const verified = timingSafeEqual(expected, razorpay_signature);

  if (verified) {
    // This is the only place a purchase gets marked "paid" — it only runs
    // once the HMAC (computed with the secret key) checks out, so this
    // can't be forged from the browser.
    try {
      await markPurchasePaid(env, razorpay_order_id, {
        status: 'paid',
        paymentId: razorpay_payment_id,
        paidAt: new Date(),
      });
    } catch (err) {
      console.error('Failed to mark purchase paid:', err.message);
    }

    // Email the customer and the store owner. Pulled back from Firestore
    // (not the request body) so the summary reflects what was actually
    // recorded when the order was created, not whatever the browser sends.
    try {
      const order = await getPurchaseDoc(env, razorpay_order_id);
      const summaryArgs = {
        items: order.items || [],
        amount: order.amount,
        currency: order.currency,
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
      };

      if (order.email) {
        await sendEmail(env, {
          to: order.email,
          bcc: env.STORE_NOTIFICATION_EMAIL,
          subject: 'Your Metastable Design order',
          html: orderSummaryHtml({ ...summaryArgs, forOwner: false }),
        });
      }

      await sendEmail(env, {
        to: env.STORE_NOTIFICATION_EMAIL,
        subject: `New order — ${(order.items || []).length} item(s)`,
        html: orderSummaryHtml({ ...summaryArgs, forOwner: true, customerEmail: order.email }),
      });
    } catch (err) {
      console.error('Failed to send order emails:', err.message);
    }
  }

  return json({ verified });
}

async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
