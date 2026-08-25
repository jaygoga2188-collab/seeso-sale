(() => {
  async function pay(button) {
    let cart = [];
    let customer = {};
    try {
      cart = JSON.parse(localStorage.getItem("nexshop_cart") || "[]");
      customer = JSON.parse(sessionStorage.getItem("address") || "{}");
    } catch (_) {
      return alert("Your cart details could not be read. Please try again.");
    }
    const items = cart.map(({ id, qty }) => ({ id, qty }));
    if (!items.length) return alert("Your cart is empty.");
    const previousText = button ? button.textContent : "";
    if (button) {
      button.disabled = true;
      button.textContent = "Opening secure payment…";
    }
    try {
      const response = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, customer }),
      });
      const result = await response.json();
      if (!response.ok || !result.payment_link || !result.payment_link_id || !result.transaction_reference) throw new Error(result.error || "Unable to start payment.");
      sessionStorage.setItem("upi_payment_attempt", JSON.stringify({ reference: result.transaction_reference, paymentLinkId: result.payment_link_id, amount: Number(result.amount) || 0, currency: result.currency || "INR", startedAt: Date.now() }));
      window.location.assign(result.payment_link);
    } catch (error) {
      alert(error.message || "Unable to start payment. Please try again.");
      if (button) {
        button.disabled = false;
        button.textContent = previousText;
      }
    }
  }

  function showCashfreeCheckout() {
    if (location.pathname !== "/payment") return;
    const page = document.querySelector(".pm-main");
    if (!page || page.dataset.cashfreeReady) return;
    page.dataset.cashfreeReady = "true";
    const style = document.createElement("style");
    style.textContent = `.pm-main > *{display:none!important}.cashfree-hosted-checkout{display:block!important;padding:32px 18px 48px;min-height:58vh;background:#f5f5f5}.cashfree-card{max-width:440px;margin:0 auto;padding:28px 22px;border-radius:14px;background:#fff;text-align:center;box-shadow:0 2px 12px #00000017;font-family:Arial,sans-serif}.cashfree-lock{width:48px;height:48px;margin:0 auto 14px;border-radius:50%;display:grid;place-items:center;background:#f3e8f7;color:#9f2089;font-size:24px}.cashfree-card h2{margin:0 0 10px;font-size:21px;color:#222}.cashfree-card p{margin:0 0 22px;color:#667085;line-height:1.55;font-size:14px}.cashfree-start-button{width:100%;border:0;border-radius:8px;padding:15px;background:#9f2089;color:#fff;font-size:16px;font-weight:700;cursor:pointer}.cashfree-start-button:disabled{opacity:.7;cursor:wait}.cashfree-note{margin-top:14px!important;font-size:12px!important}`;
    document.head.appendChild(style);
    const card = document.createElement("section");
    card.className = "cashfree-hosted-checkout";
    card.innerHTML = `<div class="cashfree-card"><div class="cashfree-lock">🔒</div><h2>Secure payment</h2><p>Choose UPI, card, net banking, or wallet securely on Razorpay's payment page.</p><button class="cashfree-start-button">Proceed to secure payment</button><p class="cashfree-note">Payments are processed securely by Razorpay.</p></div>`;
    page.appendChild(card);
    card.querySelector("button").addEventListener("click", (event) => pay(event.currentTarget));
  }

  window.startCashfreeCheckout = pay;

  document.addEventListener("click", (event) => {
    const button = event.target.closest(".pm-pay-btn");
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    pay(button);
  }, true);
  new MutationObserver(showCashfreeCheckout).observe(document.documentElement, { childList: true, subtree: true });
  showCashfreeCheckout();
})();
