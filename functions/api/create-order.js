// functions/api/create-order.js
// Cloudflare Pages Function — creates a Razorpay order.
// Prices live here, server-side. The browser only ever sends item IDs,
// so nobody can edit the cart in devtools and pay less than the real price.

const PRICES_USD = {
  // Available recordings
  'dft-fundamentals': 25,
  'static-timing-analysis-part-1': 45,
  'static-timing-analysis-part-2': 45,
  'power-optimization-techniques': 40,
  'power-gating': 35,
  'special-physical-cells': 25,
  'antenna-effect': 20,
  'signal-routing': 35,
  'multi-input-switching-mis': 35, // NOTE: catalog copy says "available on request" — see caveat below
  'clock-tree-synthesis-part-1': 45,
  'clock-tree-synthesis-part-2': 40,
  'placement-part-1': 45,
  'placement-part-2': 45,
  'crosstalk-analysis': 45,
  'em-ir-drop-analysis': 45,
  'power-estimation-part-1': 40,
  'power-estimation-part-2': 45,
  'synthesis-2-0-part-1': 45,
  'synthesis-2-0-part-2': 45,
  'unified-power-format-upf-part-1': 45,
  'drc-part-1': 50,
  'drc-part-2': 45,

  // Scripting modules
  'physical-implementation-scripting-tcl': 40,
  'tool-independent-scripting-tcl-python': 40,

  // Mock interviews
  'pnr-mock': 40,
  'rcg-comp-arch-pd-mock': 35,
  'power-analysis-mock': 35,
  'analytical-cmos-mock': 30,
};

export async function onRequestPost({ request, env }) {
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

  let totalDollars = 0;
  for (const id of items) {
    const price = PRICES_USD[id];
    if (price === undefined) {
      return json({ error: `Unknown item: ${id}` }, 400);
    }
    totalDollars += price;
  }

  const amount = Math.round(totalDollars * 100); // Razorpay wants the smallest unit — cents, for USD

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
        currency: 'USD',
        receipt: `md_${Date.now()}`,
        notes: { items: items.join(',') },
      }),
    });
  } catch {
    return json({ error: 'Could not reach Razorpay' }, 502);
  }

  const order = await rzpRes.json();

  if (!rzpRes.ok) {
    // Common cause here: international payments / USD not enabled on the Razorpay account yet.
    return json({ error: order.error?.description || 'Could not create order' }, 502);
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
