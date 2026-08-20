const { paymentMasterRequest, sendJson } = require("../lib/payment-master");

module.exports = async (req, res) => {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });
  try {
    const paymentId = String(req.body?.razorpay_payment_id || "").trim();
    const paymentLinkId = String(req.body?.razorpay_payment_link_id || "").trim();
    const referenceId = String(req.body?.razorpay_payment_link_reference_id || "").trim();
    const paymentLinkStatus = String(req.body?.razorpay_payment_link_status || "").trim();
    const receivedSignature = String(req.body?.razorpay_signature || "").trim();
    if (!/^pay_[A-Za-z0-9]+$/.test(paymentId) || !/^plink_[A-Za-z0-9]+$/.test(paymentLinkId) || !/^MSO[A-Za-z0-9]+$/.test(referenceId) || !/^(paid|partially_paid)$/.test(paymentLinkStatus)) return sendJson(res, 400, { verified: false, status: "failed", error: "Invalid payment response." });
    const verification = await paymentMasterRequest("/api/payment/verify", { internal_order_id: referenceId, razorpay_payment_id: paymentId, razorpay_payment_link_id: paymentLinkId, razorpay_payment_link_reference_id: referenceId, razorpay_payment_link_status: paymentLinkStatus, razorpay_signature: receivedSignature });
    if (verification.status === "paid") return sendJson(res, 200, { verified: true, status: "success", payment_link_id: paymentLinkId, reference_id: referenceId, payment_id: verification.razorpay_payment_id || paymentId, amount: Number(verification.amount) / 100, currency: verification.currency });
    return sendJson(res, 202, { verified: true, status: "pending", payment_link_status: paymentLinkStatus });
  } catch (error) {
    const upstreamStatus = Number(error?.statusCode || 0);
    const paymentCode = String(error?.paymentCode || "PAYMENT_UNAVAILABLE");
    // Razorpay can expose a signed return before its capture state is visible
    // to the verification API. Keep polling; never convert this into success.
    if (upstreamStatus === 400 || upstreamStatus === 503) {
      console.warn("Razorpay Payment Link verification is pending", { upstreamStatus, paymentCode });
      return sendJson(res, 202, { verified: false, status: "pending" });
    }
    console.error("Razorpay Payment Link verification error", error);
    return sendJson(res, 500, { error: "Payment status could not be verified. Please try again." });
  }
};
