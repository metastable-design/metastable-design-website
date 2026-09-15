// Metastable Design — cart + Razorpay checkout
// Cart persists in localStorage so it survives navigation between pages.

(function () {
  const CART_KEY = 'md_cart_v1';

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

  let cart = loadCart();

  function formatPrice(n) {
    return '$' + n.toFixed(0);
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
          const row = document.createElement('div');
          row.className = 'cart-item';
          row.innerHTML =
            '<span class="cart-item-name"></span>' +
            '<span class="cart-item-price"></span>' +
            '<button class="cart-item-remove" aria-label="Remove">&times;</button>';
          row.querySelector('.cart-item-name').textContent = item.name;
          row.querySelector('.cart-item-price').textContent = formatPrice(item.price);
          row.querySelector('.cart-item-remove').dataset.id = item.id;
          itemsEl.appendChild(row);
        });
      }
    }

    const subtotal = cart.reduce((sum, item) => sum + item.price, 0);
    if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
    if (checkoutBtn) checkoutBtn.disabled = cart.length === 0;

    document.querySelectorAll('.add-cart-btn').forEach((btn) => {
      const id = btn.dataset.id;
      const inCart = cart.some((item) => item.id === id);
      btn.classList.toggle('in-cart', inCart);
      btn.textContent = inCart ? 'Remove from cart' : 'Add to cart';
    });
  }

  function addOrRemove(id, name, price) {
    const idx = cart.findIndex((item) => item.id === id);
    if (idx > -1) {
      cart.splice(idx, 1);
    } else {
      cart.push({ id, name, price });
    }
    saveCart();
    updateCartUI();
  }

  function removeFromCart(id) {
    cart = cart.filter((item) => item.id !== id);
    saveCart();
    updateCartUI();
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
      addOrRemove(addBtn.dataset.id, addBtn.dataset.name, parseFloat(addBtn.dataset.price));
      return;
    }

    const removeBtn = e.target.closest('.cart-item-remove');
    if (removeBtn) {
      e.preventDefault();
      removeFromCart(removeBtn.dataset.id);
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

    checkoutBtn.disabled = true;
    const originalLabel = checkoutBtn.textContent;
    checkoutBtn.textContent = 'Preparing checkout…';

    try {
      const res = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart.map((i) => i.id) }),
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

  document.addEventListener('DOMContentLoaded', function () {
    updateCartUI();
    const checkoutBtn = document.getElementById('cart-checkout');
    if (checkoutBtn) checkoutBtn.addEventListener('click', startCheckout);
  });
})();
