/* Optional, production-only page-view analytics. No Google code loads before opt-in. */
(function () {
  "use strict";
  var script = document.currentScript;
  if (!script || window.location.origin !== script.dataset.origin) return;
  var id = script.dataset.measurementId;
  if (!/^G-[A-Z0-9]+$/.test(id || "")) return;
  var key = "analytics-consent-v1";
  var loaded = false;
  var settings = document.getElementById("analytics-settings");
  var privacySignal = navigator.globalPrivacyControl === true ||
    navigator.doNotTrack === "1" || navigator.doNotTrack === "yes" ||
    window.doNotTrack === "1";
  var choice = null;
  try { choice = window.localStorage.getItem(key); } catch (e) { /* Fail closed. */ }

  function clearCookies() {
    document.cookie.split(";").forEach(function (cookie) {
      var name = cookie.split("=")[0].trim();
      if (!/^_ga(?:_|$)/.test(name)) return;
      ["", window.location.hostname, "." + window.location.hostname].forEach(function (domain) {
        document.cookie = name + "=; Max-Age=0; path=/; SameSite=Lax" +
          (domain ? "; domain=" + domain : "");
      });
    });
  }
  function gtag() { window.dataLayer.push(arguments); }
  function start() {
    if (loaded || privacySignal || choice !== "granted") return;
    loaded = true;
    window["ga-disable-" + id] = false;
    window.dataLayer = window.dataLayer || [];
    gtag("consent", "default", {
      analytics_storage: "granted", ad_storage: "denied",
      ad_user_data: "denied", ad_personalization: "denied"
    });
    var referrer = "";
    try { referrer = document.referrer ? new URL(document.referrer).origin : ""; } catch (e) { /* No referrer. */ }
    var page = window.location.origin + window.location.pathname;
    // Apply safe defaults before initialization, including automatic tag events.
    gtag("set", {
      page_location: page, page_referrer: referrer, page_title: "Academic website",
      allow_google_signals: false, allow_ad_personalization_signals: false
    });
    gtag("js", new Date());
    // Use the config-generated page view only; never also send a manual page_view.
    gtag("config", id, {
      send_page_view: true, allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_location: page, page_referrer: referrer,
      page_title: "Academic website", cookie_expires: 7776000,
      cookie_update: false, cookie_domain: window.location.hostname
    });
    var tag = document.createElement("script");
    tag.async = true;
    tag.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
    document.head.appendChild(tag);
  }
  var panel = document.createElement("section");
  panel.setAttribute("aria-label", "Analytics preferences");
  panel.hidden = true;
  panel.style.cssText = "display:none;position:fixed;bottom:0;left:0;right:0;max-height:40vh;overflow-y:auto;padding:10px 16px;background:#fff;color:#222;border-top:1px solid #aaa;box-shadow:0 -1px 5px #0001;z-index:9999;font-size:14px;line-height:1.4;box-sizing:border-box";
  var row = document.createElement("div");
  row.style.cssText = "display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px;max-width:1280px;margin:auto";
  panel.appendChild(row);
  var description = document.createElement("p");
  description.style.cssText = "flex:1 1 280px;margin:0;font-size:14px;line-height:1.4";
  description.textContent = privacySignal ?
    "Analytics is off because your browser sends a privacy signal. You can still use the whole site." :
    "Allow Google Analytics cookies to help understand page visits? This is optional.";
  row.appendChild(description);
  var privacy = document.createElement("a");
  privacy.href = "/privacy/";
  privacy.textContent = "Privacy details";
  privacy.style.cssText = "color:#174e7a;text-decoration:underline;font-size:14px;margin-left:8px;white-space:nowrap";
  description.appendChild(privacy);
  function button(label, handler) {
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.style.cssText = "margin:0;padding:8px 12px;min-height:44px;background:#fff;color:#222;border:1px solid #666;border-radius:4px;cursor:pointer;font:inherit;white-space:nowrap";
    button.addEventListener("click", handler);
    row.appendChild(button);
    return button;
  }
  function show() {
    panel.hidden = false;
    panel.style.display = "block";
  }
  function dismiss() {
    panel.hidden = true;
    panel.style.display = "none";
    if (settings) settings.focus({ preventScroll: true });
  }
  function choose(value) {
    choice = value;
    try { window.localStorage.setItem(key, value); } catch (e) { /* Applies for this page only. */ }
    if (value === "granted") start();
    else {
      window["ga-disable-" + id] = true;
      clearCookies();
      // Remove Google's already loaded code and its listeners, including delayed events.
      if (loaded) { window.location.reload(); return; }
    }
    dismiss();
  }
  var first;
  if (!privacySignal) first = button("Allow analytics", function () { choose("granted"); });
  var reject = button("Reject", function () { choose("denied"); });
  button("Close", dismiss);
  document.body.appendChild(panel);
  if (settings) {
    settings.hidden = false;
    settings.addEventListener("click", function () {
      show();
      (first || reject).focus();
    });
  }
  panel.addEventListener("keydown", function (event) {
    if (event.key === "Escape") dismiss();
  });
  // Honor withdrawals made in another tab as well.
  window.addEventListener("storage", function (event) {
    if (event.key === key && event.newValue !== "granted") choose("denied");
  });
  if (privacySignal || choice !== "granted") {
    window["ga-disable-" + id] = true;
    clearCookies();
    if (!privacySignal && choice !== "denied") show();
  } else start();
}());
