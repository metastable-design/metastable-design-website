// Cloudflare Pages Function — POST /api/verify-payment
// Confirms a Razorpay payment is genuine by recomputing the HMAC signature
// server-side with the secret key. Never trust the "success" callback alone.

export async function onRequestPost(context) {
  const { request, env } = context;

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

  if (!env.RAZORPAY_KEY_SECRET) {
    return json({ verified: false, error: 'Razorpay secret not configured on the server' }, 500);
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(env.RAZORPAY_KEY_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBytes = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${razorpay_order_id}|${razorpay_payment_id}`)
  );

  const expectedSignature = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const verified = expectedSignature === razorpay_signature;

  return json({ verified });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
