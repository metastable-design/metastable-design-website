// src/create-order.js
// Creates a Razorpay order in either USD or INR. Prices live here,
// server-side — the browser only sends item IDs + a currency choice,
// so nobody can edit the cart in devtools and pay less than the real price.
//
// NOTE: UPI is an INR-only payment method (a Razorpay/NPCI restriction, not
// a config choice) — that's why this endpoint needs a real INR price table,
// not just a converted display number.

const PRICES = {
  // id: { usd, inr } — both in whole units (dollars / rupees), not cents/paise
  'dft-fundamentals': { usd: 25, inr: 2400 },
  'static-timing-analysis-part-1': { usd: 45, inr: 4300 },
  'static-timing-analysis-part-2': { usd: 45, inr: 4300 },
  'power-optimization-techniques': { usd: 40, inr: 3800 },
  'power-gating': { usd: 35, inr: 3350 },
  'special-physical-cells': { usd: 25, inr: 2400 },
  'antenna-effect': { usd: 20, inr: 1900 },
  'signal-routing': { usd: 35, inr: 3350 },
  'multi-input-switching-mis': { usd: 35, inr: 3350 }, // NOTE: catalog copy says "available on request"
  'clock-tree-synthesis-part-1': { usd: 45, inr: 4300 },
  'clock-tree-synthesis-part-2': { usd: 40, inr: 3800 },
  'placement-part-1': { usd: 45, inr: 4300 },
  'placement-part-2': { usd: 45, inr: 4300 },
  'crosstalk-analysis': { usd: 45, inr: 4300 },
  'em-ir-drop-analysis': { usd: 45, inr: 4300 },
  'power-estimation-part-1': { usd: 40, inr: 3800 },
  'power-estimation-part-2': { usd: 45, inr: 4300 },
  'synthesis-2-0-part-1': { usd: 45, inr: 4300 },
  'synthesis-2-0-part-2': { usd: 45, inr: 4300 },
  'unified-power-format-upf-part-1': { usd: 45, inr: 4300 },
  'drc-part-1': { usd: 50, inr: 4750 },
  'drc-part-2': { usd: 45, inr: 4300 },
  'physical-implementation-scripting-tcl': { usd: 40, inr: 3800 },
  'tool-independent-scripting-tcl-python': { usd: 40, inr: 3800 },
  'pnr-mock': { usd: 40, inr: 3800 },
  'rcg-comp-arch-pd-mock': { usd: 35, inr: 3350 },
  'power-analysis-mock': { usd: 35, inr: 3350 },
  'analytical-cmos-mock': { usd: 30, inr: 2850 },
};

export async function handleCreateOrder(request, env) {
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
  const priceKey = currency === 'INR' ? 'inr' : 'usd';

  let total = 0;
  for (const id of items) {
    const price = PRICES[id];
    if (price === undefined) {
      return json({ error: `Unknown item: ${id}` }, 400);
    }
    total += price[priceKey];
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
