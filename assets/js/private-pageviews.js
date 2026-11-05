/* Minimal GoatCounter integration: https://www.goatcounter.com/help/pixel */
(function () {
  "use strict";
  var script = document.currentScript;
  if (!script || window.location.origin !== script.dataset.origin) return;
  if (window.top !== window.self || window.__privatePageviewsInitialized) return;
  if (navigator.globalPrivacyControl === true || navigator.doNotTrack === "1" ||
      navigator.doNotTrack === "yes" || window.doNotTrack === "1") return;
  if (typeof window.fetch !== "function") return;
  var endpoint = script.dataset.endpoint;
  if (endpoint !== "https://kuonoda.goatcounter.com/count") return;
  // Use Jekyll's known page path, not an arbitrary request URL (including 404 URLs).
  var path = script.dataset.path;
  if (!path || path.charAt(0) !== "/" || /[?#]/.test(path)) return;
  window.__privatePageviewsInitialized = true;
  var counted = false;
  function count() {
    if (counted || document.prerendering ||
        (document.visibilityState && document.visibilityState !== "visible")) return;
    counted = true;
    document.removeEventListener("visibilitychange", count);
    document.removeEventListener("prerenderingchange", count);
    // No query strings, titles, referrers, screen data, cookies or persistent IDs.
    // No retries: an uncertain network result must not produce duplicate views.
    var url = endpoint + "?p=" + encodeURIComponent(path) +
      "&rnd=" + Math.random().toString(36).slice(2, 9);
    window.fetch(url, {
      method: "GET", mode: "no-cors", credentials: "omit",
      referrerPolicy: "no-referrer", cache: "no-store", keepalive: true
    }).catch(function () { /* Blocking or offline visitors are simply not counted. */ });
  }
  document.addEventListener("visibilitychange", count);
  document.addEventListener("prerenderingchange", count);
  count();
}());
