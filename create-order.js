// Cloudflare Pages Function — POST /api/create-order
// Creates a Razorpay order server-side. Prices come from this file, never
// from the browser, so nobody can tamper with the amount via dev tools.

const PRICES = {
  'dft-fundamentals': 25,
  'static-timing-analysis-part-1': 45,
  'static-timing-analysis-part-2': 45,
  'power-optimization-techniques': 40,
  'power-gating': 35,
  'special-physical-cells': 25,
  'antenna-effect': 20,
  'signal-routing': 35,
  'multi-input-switching-mis': 35,
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

// Change to 'INR' if your Razorpay account isn't approved for international payments.
const CURRENCY = 'USD';

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const ids = Array.isArray(body.items) ? body.items : [];
  if (ids.length === 0) {
    return json({ error: 'Cart is empty' }, 400);
  }

  let total = 0;
  for (const id of ids) {
    const price = PRICES[id];
    if (price === undefined) {
      return json({ error: `Unknown item: ${id}` }, 400);
    }
    total += price;
  }

  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    return json({ error: 'Razorpay keys are not configured on the server' }, 500);
  }

  const amountInSmallestUnit = Math.round(total * 100); // cents (or paise for INR)
  const auth = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);

  const razorpayRes = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      amount: amountInSmallestUnit,
      currency: CURRENCY,
      notes: { items: ids.join(', ') },
    }),
  });

  if (!razorpayRes.ok) {
    const details = await razorpayRes.text();
    return json({ error: 'Could not create Razorpay order', details }, 502);
  }

  const order = await razorpayRes.json();

  return json({
    order_id: order.id,
    amount: order.amount,
    currency: order.currency,
    key_id: env.RAZORPAY_KEY_ID,
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
