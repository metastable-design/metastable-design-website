// src/create-order.js
// Creates a Razorpay order in either USD or INR. Prices live here,
// server-side — the browser only sends item IDs + a currency choice,
// so nobody can edit the cart in devtools and pay less than the real price.
//
// src/create-order.js

// USD is now the single source of truth. INR is derived via a multiplier
// and rounded to a clean denomination, matching how you've been pricing manually.
const INR_MULTIPLIER = 96;   // rupees per dollar, for pricing purposes (not a live FX rate)
const INR_ROUND_TO = 50;     // round INR prices to the nearest 50

function usdToInr(usd) {
  return Math.round((usd * INR_MULTIPLIER) / INR_ROUND_TO) * INR_ROUND_TO;
}

const PRICES = {
  // id: usd (whole dollars) — INR is derived, see usdToInr()
  'dft-fundamentals': 0.001,
  'static-timing-analysis-part-1': 45,
  'static-timing-analysis-part-2': 45,
  'power-optimization-techniques': 40,
  'power-gating': 35,
  'special-physical-cells': 25,
  'antenna-effect': 20,
  'signal-routing': 35,
  'multi-input-switching-mis': 35, // NOTE: catalog copy says "available on request"
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
  'physical-implementation-scripting-tcl': 40,
  'tool-independent-scripting-tcl-python': 40,
  'pnr-mock': 40,
  'rcg-comp-arch-pd-mock': 35,
  'power-analysis-mock': 35,
  'analytical-cmos-mock': 30,
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

  let total = 0;
  for (const id of items) {
    const usd = PRICES[id];
    if (usd === undefined) {
      return json({ error: `Unknown item: ${id}` }, 400);
    }
    total += currency === 'INR' ? usdToInr(usd) : usd;
  }

  const amount = Math.round(total * 100); // smallest unit — cents or paise, both x100

  // ...rest (Razorpay call, response) unchanged

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
