// Dependency-free regression tests: node --test tests/analytics-consent.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('assets/js/analytics-consent.js', 'utf8');
function setup(options = {}) {
  const elements = [];
  function element(tag) {
    const el = { tag, dataset: {}, children: [], handlers: {}, hidden: false, style: {},
      appendChild(child) { this.children.push(child); },
      setAttribute() {}, addEventListener(name, handler) { this.handlers[name] = handler; },
      focus() { el.focused = true; } };
    elements.push(el); return el;
  }
  const settings = element('button');
  let cookie = options.cookies || '', reloads = 0;
  const removed = [], storage = new Map();
  if (options.choice) storage.set('analytics-consent-v1', options.choice);
  const document = { currentScript: { dataset: { origin: 'https://kuonoda.github.io', collectionEnabled: options.paused ? 'false' : 'true', measurementId: 'G-MTJW4CW9Y2' } },
    referrer: 'https://example.org/private?q=person@example.org#secret', head: element('head'), body: element('body'),
    createElement: element, getElementById: () => settings,
    get cookie() { return cookie; }, set cookie(value) { removed.push(value); } };
  const window = { location: { origin: options.origin || 'https://kuonoda.github.io', hostname: 'kuonoda.github.io', pathname: '/publications/', search: '?email=private', hash: '#private', reload() { reloads++; } },
    handlers: {}, addEventListener(name, handler) { this.handlers[name] = handler; },
    localStorage: { getItem(k) { if (options.noStorage) throw Error('blocked'); return storage.get(k); }, setItem(k, v) { if (options.noStorage) throw Error('blocked'); storage.set(k, v); } } };
  vm.runInNewContext(source, { document, window, navigator: options.navigator || {}, URL });
  return { document, window, settings, storage, removed, get reloads() { return reloads; },
    get panel() { return document.body.children[0]; },
    click(text) { const el = elements.find(e => e.textContent === text); assert.ok(el, text); el.handlers.click(); } };
}
test('unknown preference makes no Google requests and equal choices are available', () => {
  const s = setup(); assert.equal(s.document.head.children.length, 0); assert.equal(s.window.dataLayer, undefined);
  assert.equal(s.panel.hidden, false); s.click('Close'); assert.equal(s.panel.hidden, true); assert.equal(s.panel.style.display, 'none');
  s.settings.handlers.click(); assert.equal(s.panel.hidden, false); s.click('Reject');
  assert.equal(s.storage.get('analytics-consent-v1'), 'denied'); assert.equal(s.document.head.children.length, 0);
});
test('opt-in loads once, correct ID, sanitized URLs and advertising disabled', () => {
  const s = setup(); s.click('Allow analytics'); s.click('Allow analytics');
  assert.equal(s.document.head.children.length, 1);
  assert.equal(s.document.head.children[0].src, 'https://www.googletagmanager.com/gtag/js?id=G-MTJW4CW9Y2');
  const calls = s.window.dataLayer.map(a => Array.from(a));
  const config = calls.find(a => a[0] === 'config')[2];
  assert.equal(config.send_page_view, true); assert.equal(config.allow_google_signals, false);
  assert.equal(config.allow_ad_personalization_signals, false);
  assert.equal(config.page_location, 'https://kuonoda.github.io/publications/');
  assert.equal(config.page_referrer, 'https://example.org');
  assert.equal(calls.filter(a => a[0] === 'config' && a[2].send_page_view).length, 1);
  assert.equal(calls.filter(a => a[0] === 'event').length, 0);
  const globalIndex = calls.findIndex(a => a[0] === 'set');
  const initIndex = calls.findIndex(a => a[0] === 'js');
  const configIndex = calls.findIndex(a => a[0] === 'config');
  assert.ok(globalIndex >= 0 && globalIndex < initIndex && initIndex < configIndex);
  const defaults = calls[globalIndex][1];
  assert.equal(defaults.page_location, config.page_location);
  assert.equal(defaults.page_referrer, config.page_referrer);
  assert.equal(defaults.page_title, config.page_title);
  assert.equal(defaults.allow_google_signals, false);
  assert.equal(defaults.allow_ad_personalization_signals, false);
  assert.ok(!JSON.stringify(calls).includes('private'));
});
test('persisted consent/rejection and rejection followed by allowance', () => {
  assert.equal(setup({choice: 'granted'}).document.head.children.length, 1);
  const s = setup({choice: 'denied'}); assert.equal(s.panel.hidden, true); assert.equal(s.document.head.children.length, 0);
  s.settings.handlers.click(); s.click('Allow analytics'); assert.equal(s.document.head.children.length, 1);
});
test('withdrawal disables tag, removes only analytics cookies and reloads', () => {
  const s = setup({choice: 'granted', cookies: '_ga=123; _ga_MTJW4CW9Y2=456; theme=dark'});
  s.settings.handlers.click(); s.click('Reject');
  assert.equal(s.window['ga-disable-G-MTJW4CW9Y2'], true); assert.equal(s.reloads, 1);
  assert.equal(s.storage.get('analytics-consent-v1'), 'denied'); assert.equal(s.removed.length, 6);
  assert.ok(s.removed.every(c => c.startsWith('_ga') && c.includes('Max-Age=0')));
});
test('GPC and DNT override previous opt-in', () => {
  for (const navigator of [{globalPrivacyControl:true}, {doNotTrack:'1'}, {doNotTrack:'yes'}]) {
    const s = setup({choice: 'granted', navigator}); assert.equal(s.document.head.children.length, 0);
    assert.equal(s.window['ga-disable-G-MTJW4CW9Y2'], true);
  }
});
test('local and preview origins never initialize', () => {
  for (const origin of ['http://localhost:4000', 'https://preview.example.org']) {
    const s = setup({choice:'granted', origin}); assert.equal(s.document.head.children.length, 0); assert.equal(s.panel, undefined);
  }
});
test('blocked storage fails closed but allows a one-page explicit choice', () => {
  const s = setup({noStorage:true}); assert.equal(s.document.head.children.length, 0);
  s.click('Allow analytics'); assert.equal(s.document.head.children.length, 1);
});
test('withdrawal in another tab stops an active tag', () => {
  const s = setup({choice:'granted'}); s.window.handlers.storage({key:'analytics-consent-v1', newValue:'denied'});
  assert.equal(s.reloads, 1); assert.equal(s.window['ga-disable-G-MTJW4CW9Y2'], true);
});

test('collection pause disables Google, clears old cookies and creates no consent UI', () => {
  const s = setup({choice:'granted', paused:true, cookies:'_ga=123; theme=dark'});
  assert.equal(s.document.head.children.length, 0);
  assert.equal(s.window.dataLayer, undefined);
  assert.equal(s.window['ga-disable-G-MTJW4CW9Y2'], true);
  assert.equal(s.panel, undefined);
  assert.equal(s.settings.handlers.click, undefined);
  assert.equal(s.removed.length, 3);
  assert.ok(s.removed.every(c => c.startsWith('_ga=') && c.includes('Max-Age=0')));
});
