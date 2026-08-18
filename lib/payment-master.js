const crypto = require("crypto");

function requiredEnvironment(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function getPaymentMasterConfig() {
  const rawUrl = requiredEnvironment("CENTRAL_PAYMENT_API_URL").replace(/\/$/, "");
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash) throw new Error("CENTRAL_PAYMENT_API_URL must be an HTTPS origin.");
  const siteCode = requiredEnvironment("CENTRAL_SITE_CODE").toUpperCase();
  if (!/^[A-Z0-9_-]{3,64}$/.test(siteCode)) throw new Error("CENTRAL_SITE_CODE is invalid.");
  const siteSecret = requiredEnvironment("CENTRAL_SITE_AUTH_SECRET");
  if (siteSecret.length < 32) throw new Error("CENTRAL_SITE_AUTH_SECRET is invalid.");
  return { origin: url.origin, siteCode, siteSecret };
}

function sha256(value) { return crypto.createHash("sha256").update(value, "utf8").digest("hex"); }

async function paymentMasterRequest(path, payload) {
  const config = getPaymentMasterConfig();
  const body = JSON.stringify({ ...payload, site_code: config.siteCode });
  const timestamp = String(Date.now());
  const canonical = `${timestamp}.POST.${path}.${sha256(body)}`;
  const signature = crypto.createHmac("sha256", config.siteSecret).update(canonical, "utf8").digest("hex");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${config.origin}${path}`, { method: "POST", headers: { "Content-Type": "application/json", "x-payment-site": config.siteCode, "x-payment-timestamp": timestamp, "x-payment-signature": signature }, body, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.success) { const error = new Error("Central payment service request failed."); error.statusCode = response.status; throw error; }
    return data;
  } finally { clearTimeout(timer); }
}

function sendJson(res, status, body) { res.setHeader("Cache-Control", "no-store"); res.setHeader("Content-Type", "application/json; charset=utf-8"); return res.status(status).json(body); }
module.exports = { paymentMasterRequest, sendJson };
