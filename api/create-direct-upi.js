const crypto = require("crypto");
const products = require("../products.json");

const UPI_PATTERN = /^[\w.-]+@[\w.-]+$/;

function calculateOrder(cart) {
  if (!Array.isArray(cart) || !cart.length) throw new Error("Your cart is empty.");
  const quantities = new Map();
  for (const item of cart) {
    const id = Number(item?.id);
    const qty = Number(item?.qty);
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
  return Number(amount.toFixed(2));
}

function paymentLinks({ upiId, payeeName, amount, note, reference }) {
  const params = new URLSearchParams({ pa: upiId, pn: payeeName, am: amount.toFixed(2), cu: "INR", tn: note, tr: reference });
  const query = params.toString();
  const nativePayload = {
    p2pPaymentCheckoutParams: {
      checkoutType: "COLLECT",
      initialAmount: Math.round(amount * 100),
      note: { type: "text", message: note },
      supportedInstruments: -1,
    },
    contact: { type: "EXTERNAL_MERCHANT", name: payeeName, vpa: upiId },
  };
  const encodedPayload = encodeURIComponent(Buffer.from(JSON.stringify(nativePayload), "utf8").toString("base64"));
  return {
    phonepe: `phonepe://native?data=${encodedPayload}&id=p2ppayment`,
    phonepeFallback: `phonepe:upi://pay?${query}`,
    paytm: `paytmmp://cash_wallet?${query}&featuretype=money_transfer`,
    generic: `upi://pay?${query}`,
  };
}

module.exports = (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  try {
    const upiId = String(process.env.DIRECT_UPI_ID || "").trim();
    const payeeName = String(process.env.DIRECT_UPI_PAYEE_NAME || "").trim();
    const note = String(process.env.DIRECT_UPI_TRANSACTION_NOTE || "Recharge Payment").trim() || "Recharge Payment";
    if (!UPI_PATTERN.test(upiId) || !payeeName) throw new Error("Payment configuration is unavailable.");

    const amount = calculateOrder(req.body?.items);
    const reference = `SEESO${Date.now()}${crypto.randomBytes(3).toString("hex")}`;
    return res.status(200).json({
      gateway: "direct_upi_phonepe",
      reference,
      amount,
      currency: "INR",
      links: paymentLinks({ upiId, payeeName, amount, note, reference }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment could not be started.";
    const clientError = ["Your cart is empty.", "Invalid cart.", "A cart item is unavailable.", "Invalid order amount."].includes(message);
    if (!clientError) console.error("Direct PhonePe payment error", error);
    return res.status(clientError ? 400 : 500).json({ error: message });
  }
};
