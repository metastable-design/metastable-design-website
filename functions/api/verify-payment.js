// functions/api/verify-payment.js
// Cloudflare Pages Function — confirms a payment is genuinely from Razorpay
// by recomputing the HMAC signature server-side. Never trust the "success"
// callback in the browser alone; it can be faked in devtools.

export async function onRequestPost({ request, env }) {
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

  // At this point `verified` tells you the payment is real. This endpoint doesn't
  // yet do anything with that fact beyond reporting it back to the browser — actual
  // delivery (sharing recordings) is still the manual Discord/email step described
  // on the site. If you want this automated later, this is the place to add it:
  // e.g. write the order to KV/D1, or send yourself a notification email.

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
