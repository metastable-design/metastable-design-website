// src/email.js
// Sends order confirmation emails via Resend (https://resend.com) — a
// plain HTTPS API, so it works from a Worker with just fetch(). No SMTP,
// no Firebase billing/extension required.

export async function sendEmail(env, { to, subject, html }) {
  if (!env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY not set — skipping email:', subject);
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.ORDER_EMAIL_FROM, // e.g. "Metastable Design <orders@yourdomain.com>"
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    // Don't throw — a failed email shouldn't undo a verified payment. Just
    // make sure it's visible in `wrangler tail` so it can be noticed.
    console.error('Resend API error:', await res.text());
  }
}

export function orderSummaryHtml({ items, amount, currency, orderId, paymentId, forOwner }) {
  const symbol = currency === 'INR' ? '₹' : '$';
  const amountStr = `${symbol}${(amount / 100).toLocaleString()}`;
  const itemsHtml = items.map((i) => `<li>${escapeHtml(slugToName(i))}</li>`).join('');

  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="margin-bottom: 4px;">${forOwner ? 'New order received' : 'Thanks for your purchase!'}</h2>
      <p style="color: #555;">${forOwner ? 'A new order just came in.' : "Here's a summary of your order from Metastable Design."}</p>
      <ul>${itemsHtml}</ul>
      <p><strong>Total:</strong> ${amountStr}</p>
      <p style="font-size: 0.85em; color: #888;">Order ID: ${escapeHtml(orderId)}<br>Payment ID: ${escapeHtml(paymentId)}</p>
    </div>
  `;
}

function slugToName(slug) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
