/* ---------------------------------------------------------
   Metastable Design — cart
   Cart state lives in localStorage so it persists across
   index.html <-> webinars.html and across page reloads.
   Each webinar is a one-off purchase, so "adding to cart"
   just toggles membership — there's no quantity picker.
--------------------------------------------------------- */

(function () {
  var CART_KEY = "metastable-cart-v1";

  function getCart() {
    try {
      var raw = localStorage.getItem(CART_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function setCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    render();
  }

  function addItem(id, name, price) {
    var cart = getCart();
    if (!cart.some(function (i) { return i.id === id; })) {
      cart.push({ id: id, name: name, price: price });
      setCart(cart);
    }
  }

  function removeItem(id) {
    setCart(getCart().filter(function (i) { return i.id !== id; }));
  }

  function fmt(n) {
    return "$" + n.toFixed(0);
  }

  function render() {
    var cart = getCart();

    // header badge(s)
    document.querySelectorAll(".cart-count").forEach(function (el) {
      el.textContent = cart.length;
      el.style.display = cart.length ? "inline-flex" : "none";
    });

    // per-course button state
    document.querySelectorAll(".add-cart-btn").forEach(function (btn) {
      var inCart = cart.some(function (i) { return i.id === btn.dataset.id; });
      btn.classList.toggle("in-cart", inCart);
      btn.textContent = inCart ? "✓ In cart" : "Add to cart";
    });

    // drawer contents
    var list = document.getElementById("cart-items");
    if (list) {
      list.innerHTML = "";
      if (cart.length === 0) {
        list.innerHTML = '<p class="cart-empty">Your cart is empty. Add a webinar to get started.</p>';
      } else {
        cart.forEach(function (item) {
          var row = document.createElement("div");
          row.className = "cart-item";
          row.innerHTML =
            '<span class="cart-item-name">' + item.name + '</span>' +
            '<span class="cart-item-price">' + fmt(item.price) + '</span>' +
            '<button class="cart-item-remove" data-id="' + item.id + '" aria-label="Remove ' + item.name + '">×</button>';
          list.appendChild(row);
        });
      }
    }

    var subtotal = cart.reduce(function (s, i) { return s + i.price; }, 0);
    var subtotalEl = document.getElementById("cart-subtotal");
    if (subtotalEl) subtotalEl.textContent = fmt(subtotal);

    var checkoutBtn = document.getElementById("cart-checkout");
    if (checkoutBtn) checkoutBtn.disabled = cart.length === 0;
  }

  function openDrawer() {
    var drawer = document.getElementById("cart-drawer");
    var overlay = document.getElementById("cart-overlay");
    if (drawer) drawer.classList.add("open");
    if (overlay) overlay.classList.add("open");
  }

  function closeDrawer() {
    var drawer = document.getElementById("cart-drawer");
    var overlay = document.getElementById("cart-overlay");
    if (drawer) drawer.classList.remove("open");
    if (overlay) overlay.classList.remove("open");
  }

  function checkout() {
    var cart = getCart();
    if (cart.length === 0) return;
    var subtotal = cart.reduce(function (s, i) { return s + i.price; }, 0);

    // ---------------------------------------------------------------
    // RAZORPAY INTEGRATION POINT
    // Swap this block for a real Checkout call. Typical flow:
    //   1. POST `cart` to your backend to create a Razorpay Order
    //      (amount is in the smallest currency unit, e.g. paise for INR).
    //   2. Open Razorpay Checkout with the order_id it returns:
    //
    //   var options = {
    //     key: "YOUR_RAZORPAY_KEY_ID",
    //     amount: subtotal * 100,           // paise, if charging in INR
    //     currency: "INR",
    //     name: "Metastable Design",
    //     description: cart.map(function(i){ return i.name; }).join(", "),
    //     order_id: orderIdFromYourServer,
    //     handler: function (response) {
    //       // verify response.razorpay_payment_id on your backend, then:
    //       localStorage.removeItem(CART_KEY);
    //       render();
    //     },
    //     prefill: { email: "", contact: "" },
    //     theme: { color: "#33448a" }
    //   };
    //   var rzp = new Razorpay(options);
    //   rzp.open();
    // ---------------------------------------------------------------
    alert(
      "Cart total: " + fmt(subtotal) + " for " + cart.length + " item(s).\n\n" +
      "Wire this button up to Razorpay Checkout — see the comment above checkout() in script.js."
    );
  }

  document.addEventListener("click", function (e) {
    var addBtn = e.target.closest(".add-cart-btn");
    if (addBtn) {
      e.preventDefault();
      e.stopPropagation();
      var id = addBtn.dataset.id;
      if (getCart().some(function (i) { return i.id === id; })) {
        removeItem(id);
      } else {
        addItem(id, addBtn.dataset.name, parseFloat(addBtn.dataset.price));
      }
      return;
    }

    var removeBtn = e.target.closest(".cart-item-remove");
    if (removeBtn) {
      removeItem(removeBtn.dataset.id);
      return;
    }

    if (e.target.closest("#cart-toggle")) {
      openDrawer();
      return;
    }

    if (e.target.closest("#cart-close") || e.target === document.getElementById("cart-overlay")) {
      closeDrawer();
      return;
    }

    if (e.target.closest("#cart-checkout")) {
      checkout();
      return;
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeDrawer();
  });

  document.addEventListener("DOMContentLoaded", render);
})();
