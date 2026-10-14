// Dependency-free data and rendering regression tests: node tests/image-data.cjs
const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
for (const file of fs.readdirSync('.').filter(f => f.endsWith('.html'))) {
  for (const [, script] of fs.readFileSync(file, 'utf8').matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(script, { filename: file });
}
const storage = new Map();
const notices = [];
const downloads = [];
const ctx = vm.createContext({
  crypto: {randomUUID}, console, Blob, URL: {createObjectURL(blob) { downloads.push(blob); return 'blob:test'; }, revokeObjectURL() {}},
  navigator: {}, setTimeout() {},
  document: {
    documentElement: {setAttribute() {}},
    createElement() { return {click() {}, set textContent(value) {this.innerHTML = value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}}; }
  },
  window: {addEventListener() {}},
  localStorage: {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key,value)}
});
vm.runInContext(fs.readFileSync('app.js','utf8'), ctx);
ctx.notices = notices;
vm.runInContext('toast = msg => notices.push(msg)', ctx);
(async () => {
  const img = 'data:image/jpeg;base64,YWJj';
  ctx.img = img;
  vm.runInContext(`
    const a = createSet('Images');
    a.cards.push(createCard('<Alpha>', 'First', {termImage: img}));
    saveSet(a);
    const b = createSet('Other'); b.cards.push(createCard('Beta', 'Second')); saveSet(b);
  `,ctx);
  assert.equal(vm.runInContext('getSets()[0].cards[0].termImage',ctx), img);
  assert.match(vm.runInContext("cardSideHtml(getSets()[0].cards[0], 'term')",ctx), /&lt;Alpha&gt;/);
  assert.equal(vm.runInContext(`validCardImage('javascript:alert(1)')`,ctx), false);
  assert.equal(vm.runInContext(`validCardImage('data:image/svg+xml;base64,YWJj')`,ctx), false);
  vm.runInContext('swapCardSides(a.cards[0]); saveSet(a)',ctx);
  assert.equal(vm.runInContext('getSets()[0].cards[0].definitionImage',ctx), img);
  vm.runInContext("const combined = combineSets([a.id,b.id], 'Combined')",ctx);
  assert.equal(vm.runInContext('combined.cards[0].definitionImage',ctx),img);
  vm.runInContext('exportSet(a); exportAllSets()',ctx);
  for (const blob of downloads.slice()) {
    const json = await blob.text();
    ctx.json = json;
    assert.ok(json.includes(img));
    vm.runInContext('importFromJson(json)',ctx);
  }
  assert.equal(vm.runInContext('getSets().length',ctx),7);
  const before = storage.get('flashdeck_sets');
  ctx.localStorage.setItem = () => { throw new Error('quota'); };
  assert.throws(() => vm.runInContext('saveSet(createSet("Fail"))',ctx), /quota/);
  assert.equal(storage.get('flashdeck_sets'),before);
  assert.ok(notices.some(s => s.includes('Could not save')));
  await assert.rejects(ctx.prepareCardImage({type:'image/svg+xml',size:1}), /Choose a PNG/);
  await assert.rejects(ctx.prepareCardImage({type:'image/png',size:11*1024*1024}), /10 MB/);
  console.log('PASS: all page scripts parse; local persistence, safe rendering, image copy/swap/combine, both JSON exports/imports, quota preservation, invalid/oversized uploads');
})().catch(e => {console.error(e); process.exitCode=1;});
