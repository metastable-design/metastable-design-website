// src/worker.js
// Entry point for the Worker. Because wrangler.jsonc sets
// run_worker_first: ["/api/*"], this script only runs for /api/* requests —
// every other request (index.html, style.css, script.js, images, etc.) is
// served directly from static assets without touching this code at all.

import { handleCreateOrder } from './create-order.js';
import { handleVerifyPayment } from './verify-payment.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/create-order' && request.method === 'POST') {
      return handleCreateOrder(request, env);
    }

    if (url.pathname === '/api/verify-payment' && request.method === 'POST') {
      return handleVerifyPayment(request, env);
    }

    // Fallback — shouldn't normally be reached given run_worker_first above,
    // but keeps behavior correct if that config ever changes.
    return env.ASSETS.fetch(request);
  },
};
