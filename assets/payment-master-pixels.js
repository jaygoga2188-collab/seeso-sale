(() => {
  const queued = [];
  let pixelIds = [];

  function ensurePixelBase() {
    if (window.fbq) return;
    const fbq = function () { fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments); };
    if (!window._fbq) window._fbq = fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    window.fbq = fbq;
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }

  function send(event, payload = {}, eventId) {
    if (!pixelIds.length) { queued.push([event, payload, eventId]); return; }
    pixelIds.forEach((pixelId) => {
      if (eventId) window.fbq("trackSingle", pixelId, event, payload, { eventID: eventId });
      else window.fbq("trackSingle", pixelId, event, payload);
    });
  }

  window.PaymentMasterPixels = { track: send, ready: false };
  fetch("/api/tracking-pixels", { cache: "no-store" })
    .then((response) => response.ok ? response.json() : { pixels: [] })
    .then((data) => {
      pixelIds = [...new Set((Array.isArray(data?.pixels) ? data.pixels : []).map(String).filter((id) => /^\d{5,25}$/.test(id)))];
      if (!pixelIds.length) return;
      ensurePixelBase();
      pixelIds.forEach((pixelId) => window.fbq("init", pixelId));
      window.PaymentMasterPixels.ready = true;
      send("PageView");
      queued.splice(0).forEach(([event, payload, eventId]) => send(event, payload, eventId));
    })
    .catch(() => undefined);
})();
