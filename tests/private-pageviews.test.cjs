const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('assets/js/private-pageviews.js', 'utf8');
function setup(o = {}) {
  const requests = [], handlers = {};
  const document = { currentScript: {dataset: {origin:'https://kuonoda.github.io', endpoint:o.endpoint || 'https://kuonoda.goatcounter.com/count', path:o.path || '/publications/'}},
    visibilityState:o.visibility || 'visible', prerendering:!!o.prerendering,
    addEventListener(k,f) { handlers[k] = f; }, removeEventListener(k) { delete handlers[k]; } };
  const window = {location:{origin:o.origin || 'https://kuonoda.github.io',pathname:'/private-input',search:'?email=secret@example.com',hash:'#secret'},
    fetch(url, options) { requests.push({url,options}); return o.fail ? Promise.reject(Error('blocked')) : Promise.resolve({type:'opaque'}); } };
  window.self = window; window.top = o.frame ? {} : window;
  const context = vm.createContext({window,document,navigator:o.navigator || {}});
  vm.runInContext(source,context);
  return {requests,handlers,window,document,rerun() {vm.runInContext(source,context);} };
}
test('one request, fixed path only, no cookies or referrer', () => {
  const s=setup(); assert.equal(s.requests.length,1);
  const r=s.requests[0],u=new URL(r.url);
  assert.equal(u.origin,'https://kuonoda.goatcounter.com'); assert.equal(u.pathname,'/count');
  assert.equal(u.searchParams.get('p'),'/publications/');
  assert.deepEqual([...u.searchParams.keys()].sort(),['p','rnd']);
  assert.equal(r.options.credentials,'omit'); assert.equal(r.options.referrerPolicy,'no-referrer');
  assert.equal(r.options.cache,'no-store'); assert.equal(r.options.method,'GET');
  assert.equal(r.options.mode,'no-cors'); assert.ok(!r.url.includes('secret'));
  s.rerun(); assert.equal(s.requests.length,1);
});
test('hidden document waits until visible and counts only once', () => {
  const s=setup({visibility:'hidden'});assert.equal(s.requests.length,0);
  const callback=s.handlers.visibilitychange;s.document.visibilityState='visible';callback();callback();
  assert.equal(s.requests.length,1);assert.equal(s.handlers.visibilitychange,undefined);
});
test('prerender waits for activation', () => {
  const s=setup({prerendering:true});assert.equal(s.requests.length,0);
  s.document.prerendering=false;s.handlers.prerenderingchange();assert.equal(s.requests.length,1);
});
test('privacy signals prevent any count', () => {
  for(const navigator of [{globalPrivacyControl:true},{doNotTrack:'1'},{doNotTrack:'yes'}])
    assert.equal(setup({navigator}).requests.length,0);
});
test('no local, preview, embedded, invalid endpoint or query-bearing path counting', () => {
  for(const options of [{origin:'http://localhost:4000'},{origin:'https://preview.example.com'},
    {frame:true},{endpoint:'https://other.example/count'},{path:'/a?secret'},{path:'/a#secret'}])
    assert.equal(setup(options).requests.length,0);
});
test('network failure is not retried', async () => {
  const s=setup({fail:true});await Promise.resolve();s.rerun();assert.equal(s.requests.length,1);
});
test('production template keeps GA disabled and includes only one local counter', () => {
  const template=fs.readFileSync('_includes/analytics-providers/custom.html','utf8');
  assert.equal(template.match(/private-pageviews\.js/g).length,1);
  assert.ok(template.includes('jekyll.environment == "production"'));
  assert.ok(fs.readFileSync('_includes/analytics-providers/google-analytics-4.html','utf8').includes('data-collection-enabled="false"'));
});
