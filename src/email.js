// src/email.js
// Sends order confirmation emails via Resend (https://resend.com) — a
// plain HTTPS API, so it works from a Worker with just fetch(). No SMTP,
// no Firebase billing/extension required.

export async function sendEmail(env, { to, bcc, subject, html }) {
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
      ...(bcc ? { bcc } : {}),
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

// Brand colors — tweak these to match your site.
const BRAND = {
  dark: '#111111',
  accent: '#4f46e5',
  bg: '#f5f5f7',
  card: '#ffffff',
  border: '#e5e5ea',
  muted: '#6b6b70',
};

export function orderSummaryHtml({ items, amount, currency, orderId, paymentId, forOwner, customerEmail }) {
  const symbol = currency === 'INR' ? '₹' : '$';
  const amountStr = `${symbol}${(amount / 100).toLocaleString()}`;

  const itemsRows = items
    .map(
      (i) => `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid ${BRAND.border}; font-size: 15px; color: ${BRAND.dark};">
            ${escapeHtml(slugToName(i))}
          </td>
        </tr>`
    )
    .join('');

  const heading = forOwner ? 'New order received' : 'Thank you for your purchase!';
  const subheading = forOwner
    ? 'A new order just came in.'
    : "We're glad to have you with us — here's a quick summary of what you bought.";

  const ownerCustomerRow = forOwner && customerEmail
    ? `
        <tr>
          <td style="padding: 4px 0; font-size: 13px; color: ${BRAND.muted};">
            Customer: <span style="color: ${BRAND.dark};">${escapeHtml(customerEmail)}</span>
          </td>
        </tr>`
    : '';

  // Extra warm closing note, customer emails only.
  const closingNote = !forOwner
    ? `
              <p style="margin: 24px 0 0; font-size: 14px; color: ${BRAND.muted}; line-height: 1.6;">
                You'll find access details for your webinar(s) here shortly, or you can check your
                <a href="https://metastable-design.org/purchases.html" style="color: ${BRAND.accent}; text-decoration: none;">purchase history</a> anytime.
                If anything looks off, just reply to this email — we're happy to help.
              </p>
              <p style="margin: 20px 0 0; font-size: 14px; color: ${BRAND.dark};">
                Thanks again for learning with us,<br>
                <strong>Team Metastable Design</strong>
              </p>`
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND.bg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BRAND.bg}; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: ${BRAND.card}; border-radius: 12px; overflow: hidden; border: 1px solid ${BRAND.border};">

          <!-- Header band -->
          <tr>
            <td style="background-color: ${BRAND.dark}; padding: 28px 32px;">
              <p style="margin: 0; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #ffffff; opacity: 0.7;">
                Metastable Design
              </p>
              <h1 style="margin: 6px 0 0; font-size: 20px; color: #ffffff; font-weight: 600;">
                ${escapeHtml(heading)}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 28px 32px;">
              <p style="margin: 0 0 20px; font-size: 15px; color: ${BRAND.muted}; line-height: 1.5;">
                ${escapeHtml(subheading)}
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
                ${itemsRows}
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="padding-top: 8px; font-size: 15px; font-weight: 600; color: ${BRAND.dark};">
                    Total
                  </td>
                  <td align="right" style="padding-top: 8px; font-size: 18px; font-weight: 700; color: ${BRAND.accent};">
                    ${amountStr}
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BRAND.bg}; border-radius: 8px; padding: 14px 16px;">
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: ${BRAND.muted};">
                    Order ID: <span style="color: ${BRAND.dark};">${escapeHtml(orderId)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: ${BRAND.muted};">
                    Payment ID: <span style="color: ${BRAND.dark};">${escapeHtml(paymentId)}</span>
                  </td>
                </tr>
                ${ownerCustomerRow}
              </table>

              ${closingNote}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; border-top: 1px solid ${BRAND.border};">
              <p style="margin: 0; font-size: 12px; color: ${BRAND.muted}; text-align: center;">
                ${forOwner ? 'Metastable Design — order notifications' : 'Metastable Design · metastable@metastable-design.org'}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
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
