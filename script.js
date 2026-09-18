// Metastable Design — cart + Razorpay checkout
// Cart and currency choice persist in localStorage so they survive
// navigation between pages.

(function () {
  const CART_KEY = 'md_cart_v1';
  const CURRENCY_KEY = 'md_currency_v1';

  // Prices come from prices.js (repo root) — the same file create-order.js
  // imports server-side — via a dynamic import, since this file is loaded
  // as a classic <script>, not a module. This is what's actually displayed
  // AND what decides the subtotal shown before checkout; the real charge
  // is still always computed server-side in create-order.js independently,
  // but both sides now read the same numbers, so they can't drift apart.
  let PRICES = {};
  let usdToInr = (usd) => usd;
  const pricesReady = import('./prices.js').then((mod) => {
    PRICES = mod.PRICES;
    usdToInr = mod.usdToInr;
  });

  function loadCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }

  function loadCurrency() {
    const saved = localStorage.getItem(CURRENCY_KEY);
    return saved === 'INR' ? 'INR' : 'USD';
  }

  function saveCurrency() {
    localStorage.setItem(CURRENCY_KEY, currency);
  }

  let cart = loadCart(); // [{ id, name }] — price is looked up live, never stored
  let currency = loadCurrency(); // 'USD' | 'INR'

  function priceFor(id) {
    const usd = PRICES[id];
    if (usd === undefined) return null;
    return currency === 'INR' ? usdToInr(usd) : usd;
  }

  function formatPrice(n) {
    if (currency === 'INR') {
      return '₹' + n.toLocaleString('en-IN');
    }
    return '$' + n.toFixed(0);
  }

  function updateCurrencyToggleUI() {
    document.querySelectorAll('.currency-toggle').forEach((toggle) => {
      toggle.querySelectorAll('button').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.currency === currency);
      });
    });
  }

  // Rewrites every product card's displayed price and the matching
  // add-to-cart button's data-price, based on the current currency.
  function renderProductPrices() {
    document.querySelectorAll('.product-summary').forEach((summary) => {
      const btn = summary.querySelector('.add-cart-btn');
      const priceEl = summary.querySelector('.product-price');
      if (!btn || !priceEl) return;
      const id = btn.dataset.id;
      const amount = priceFor(id);
      if (amount === null) return;
      priceEl.textContent = formatPrice(amount);
      btn.dataset.price = amount;
    });
  }

  function updateCartUI() {
    const countEl = document.querySelector('.cart-count');
    const itemsEl = document.getElementById('cart-items');
    const subtotalEl = document.getElementById('cart-subtotal');
    const checkoutBtn = document.getElementById('cart-checkout');

    if (countEl) {
      countEl.textContent = String(cart.length);
      countEl.style.display = cart.length > 0 ? 'flex' : 'none';
    }

    if (itemsEl) {
      itemsEl.innerHTML = '';
      if (cart.length === 0) {
        itemsEl.innerHTML = '<p class="cart-empty">Your cart is empty.</p>';
      } else {
        cart.forEach((item) => {
          const amount = priceFor(item.id);
          const row = document.createElement('div');
          row.className = 'cart-item';
          row.innerHTML =
            '<span class="cart-item-name"></span>' +
            '<span class="cart-item-price"></span>' +
            '<button class="cart-item-remove" aria-label="Remove">&times;</button>';
          row.querySelector('.cart-item-name').textContent = item.name;
          row.querySelector('.cart-item-price').textContent = amount === null ? '—' : formatPrice(amount);
          row.querySelector('.cart-item-remove').dataset.id = item.id;
          itemsEl.appendChild(row);
        });
      }
    }

    const subtotal = cart.reduce((sum, item) => {
      const amount = priceFor(item.id);
      return sum + (amount === null ? 0 : amount);
    }, 0);
    if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
    if (checkoutBtn) checkoutBtn.disabled = cart.length === 0;

    document.querySelectorAll('.add-cart-btn').forEach((btn) => {
      const id = btn.dataset.id;
      const inCart = cart.some((item) => item.id === id);
      btn.classList.toggle('in-cart', inCart);
      btn.textContent = inCart ? 'Remove from cart' : 'Add to cart';
    });
  }

  function renderAll() {
    renderProductPrices();
    updateCartUI();
    updateCurrencyToggleUI();
  }

  function addOrRemove(id, name) {
    const idx = cart.findIndex((item) => item.id === id);
    if (idx > -1) {
      cart.splice(idx, 1);
    } else {
      cart.push({ id, name });
    }
    saveCart();
    updateCartUI();
  }

  function removeFromCart(id) {
    cart = cart.filter((item) => item.id !== id);
    saveCart();
    updateCartUI();
  }

  function setCurrency(next) {
    if (next !== 'USD' && next !== 'INR') return;
    if (next === currency) return;
    currency = next;
    saveCurrency();
    renderAll();
  }

  function openCart() {
    document.getElementById('cart-drawer')?.classList.add('open');
    document.getElementById('cart-overlay')?.classList.add('open');
  }

  function closeCart() {
    document.getElementById('cart-drawer')?.classList.remove('open');
    document.getElementById('cart-overlay')?.classList.remove('open');
  }

  function showNotice(message) {
    let notice = document.getElementById('md-notice');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'md-notice';
      notice.className = 'md-notice';
      document.body.appendChild(notice);
    }
    notice.textContent = message;
    notice.classList.add('visible');
    clearTimeout(notice._timer);
    notice._timer = setTimeout(() => notice.classList.remove('visible'), 6000);
  }

  document.addEventListener('click', function (e) {
    const addBtn = e.target.closest('.add-cart-btn');
    if (addBtn) {
      e.preventDefault();
      e.stopPropagation();
      addOrRemove(addBtn.dataset.id, addBtn.dataset.name);
      return;
    }

    const removeBtn = e.target.closest('.cart-item-remove');
    if (removeBtn) {
      e.preventDefault();
      removeFromCart(removeBtn.dataset.id);
      return;
    }

    const currencyBtn = e.target.closest('.currency-toggle button');
    if (currencyBtn) {
      e.preventDefault();
      setCurrency(currencyBtn.dataset.currency);
      return;
    }

    if (e.target.closest('#cart-toggle')) {
      openCart();
      return;
    }

    if (e.target.closest('#cart-close') || e.target.id === 'cart-overlay') {
      closeCart();
      return;
    }
  });

  async function startCheckout() {
    const checkoutBtn = document.getElementById('cart-checkout');
    if (!checkoutBtn || cart.length === 0) return;

    if (typeof Razorpay === 'undefined') {
      showNotice('Payment library failed to load. Check your connection and try again.');
      return;
    }

    // Purchases are tied to an account so people can see them later under
    // "My Purchases" — auth.js exposes these globals once it's loaded.
    const user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
    if (!user) {
      showNotice('Please sign in first so we can save this purchase to your account.');
      if (typeof window.openAuthModal === 'function') window.openAuthModal('signin');
      return;
    }

    checkoutBtn.disabled = true;
    const originalLabel = checkoutBtn.textContent;
    checkoutBtn.textContent = 'Preparing checkout…';

    try {
      const idToken = await window.getIdToken();
      const res = await fetch('/api/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ items: cart.map((i) => i.id), currency }),
      });
      const order = await res.json();
      if (!res.ok) throw new Error(order.error || 'Could not start checkout');

      const rzp = new Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        order_id: order.order_id,
        name: 'Metastable Design',
        description: cart.map((i) => i.name).join(', '),
        handler: async function (response) {
          try {
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(response),
            });
            const verify = await verifyRes.json();

            if (verify.verified) {
              cart = [];
              saveCart();
              updateCartUI();
              closeCart();
              showNotice('Payment successful! We\u2019ll share access over Discord or email within 24 hours.');
            } else {
              showNotice(
                'Payment went through but could not be verified. Email metastable01@gmail.com with payment ID ' +
                  response.razorpay_payment_id
              );
            }
          } catch {
            showNotice(
              'Payment went through but verification failed. Email metastable01@gmail.com with payment ID ' +
                response.razorpay_payment_id
            );
          }
        },
        modal: {
          ondismiss: function () {
            checkoutBtn.disabled = cart.length === 0;
            checkoutBtn.textContent = originalLabel;
          },
        },
        theme: { color: '#0056d2' },
      });

      rzp.on('payment.failed', function (response) {
        showNotice('Payment failed: ' + (response.error?.description || 'please try again.'));
      });

      rzp.open();
    } catch (err) {
      showNotice(err.message || 'Something went wrong starting checkout.');
    } finally {
      checkoutBtn.disabled = cart.length === 0;
      checkoutBtn.textContent = originalLabel;
    }
  }

  document.addEventListener('DOMContentLoaded', async function () {
    await pricesReady;
    renderAll();
    const checkoutBtn = document.getElementById('cart-checkout');
    if (checkoutBtn) checkoutBtn.addEventListener('click', startCheckout);
  });
})();
