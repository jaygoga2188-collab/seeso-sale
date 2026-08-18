const { paymentMasterRequest, sendJson } = require("../lib/payment-master");

module.exports = async (req, res) => {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed." });
  try {
    const result = await paymentMasterRequest("/api/tracking/pixels", {});
    return sendJson(res, 200, { pixels: Array.isArray(result.pixels) ? result.pixels : [] });
  } catch (_) {
    return sendJson(res, 200, { pixels: [] });
  }
};
