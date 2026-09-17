// src/email.js
// Just builds the HTML for order confirmation emails. Actual sending is
// handled by Firebase's "Trigger Email from Firestore" extension — see
// firestore.js's queueMail(), which writes to the collection that
// extension watches.

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
