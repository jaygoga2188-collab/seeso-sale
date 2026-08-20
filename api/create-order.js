const crypto = require("crypto");
const products = require("../products.json");
const { paymentMasterRequest, sendJson } = require("../lib/payment-master");

function calculateOrder(cart) {
  if (!Array.isArray(cart) || !cart.length) throw new Error("Your cart is empty.");
  const quantities = new Map();
  for (const item of cart) {
    const id = Number(item?.id), qty = Number(item?.qty);
    if (!Number.isInteger(id) || !Number.isInteger(qty) || qty < 1 || qty > 10) throw new Error("Invalid cart.");
    quantities.set(id, Math.min(10, (quantities.get(id) || 0) + qty));
  }
  let amount = 0;
  for (const [id, qty] of quantities) {
    const product = products.find((entry) => Number(entry.id) === id);
    if (!product) throw new Error("A cart item is unavailable.");
    amount += Number(product.price) * qty;
  }
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid order amount.");
  return { amount: Number(amount.toFixed(2)), amountPaise: Math.round(amount * 100) };
}

function getSiteUrl() {
  const value = String(process.env.SITE_URL || "").trim().replace(/\/$/, "");
  let parsed; try { parsed = new URL(value); } catch (_) { throw new Error("SITE_URL is not configured."); }
  if (parsed.protocol !== "https:") throw new Error("SITE_URL must use HTTPS.");
  return parsed.origin;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });
  try {
    const orderTotal = calculateOrder(req.body?.items);
    const customer = req.body?.customer || {};
    const phone = String(customer.mobile || customer.number || "").replace(/\D/g, "");
    if (!/^\d{10}$/.test(phone)) return sendJson(res, 400, { error: "Please enter a valid 10-digit mobile number." });
    const internalReference = `MSO${Date.now()}${crypto.randomBytes(3).toString("hex")}`;
    const paymentLink = await paymentMasterRequest("/api/payment/create-order", {
      amount: orderTotal.amountPaise, currency: "INR", internal_order_id: internalReference, kind: "payment_link",
      description: String(process.env.PAYMENT_DESCRIPTION || "Order Payment").trim().slice(0, 255) || "Order Payment",
      expire_by: Math.floor(Date.now() / 1000) + 1800, callback_url: `${getSiteUrl()}/payment-return.html?v=2`,
      customer: { name: String(customer.name || "Customer").trim().slice(0, 80) || "Customer", contact: phone },
    });
    const hostedUrl = new URL(paymentLink.payment_link);
    if (hostedUrl.protocol !== "https:" || hostedUrl.hostname !== "rzp.io") throw new Error("Razorpay returned an invalid hosted payment URL.");
    return sendJson(res, 200, { gateway: "razorpay_payment_link", payment_link: hostedUrl.toString(), payment_link_id: paymentLink.payment_link_id, transaction_reference: internalReference, amount: orderTotal.amount, amount_paise: paymentLink.amount, currency: paymentLink.currency, status: paymentLink.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment service is temporarily unavailable.";
    const clientError = ["Your cart is empty.", "Invalid cart.", "A cart item is unavailable.", "Invalid order amount."].includes(message);
    if (!clientError) console.error("Razorpay payment error", error);
    return sendJson(res, clientError ? 400 : 500, { error: clientError ? message : "Razorpay payment could not be started. Please try again." });
  }
};
