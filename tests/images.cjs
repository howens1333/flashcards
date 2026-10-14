// Run with a local server on :8765 and Playwright installed: node tests/images.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
(async () => {
  for (const file of fs.readdirSync('.').filter(f => f.endsWith('.html'))) {
    for (const [, script] of fs.readFileSync(file, 'utf8').matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(script, { filename: file });
  }
  const browser = await chromium.launch({headless:true, args:['--no-sandbox']});
  const context = await browser.newContext({serviceWorkers:'block', acceptDownloads:true});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('https://**/*', route => route.abort());
  const base = process.env.TEST_URL || 'http://127.0.0.1:8765';
  await page.goto(base);
  let id = await page.evaluate(() => {
    const set = createSet('Image test');
    set.cards = [createCard('Alpha', 'First'), createCard('Beta', 'Second')];
    saveSet(set); return set.id;
  });
  await page.goto(`${base}/edit.html?id=${id}`);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64');
  await page.locator('input[type=file][aria-label="Upload term image"]').first().setInputFiles({name:'test.png', mimeType:'image/png', buffer:png});
  await page.waitForFunction(() => currentSet.cards[0].termImage);
  await page.locator('input[type=file][aria-label="Upload definition image"]').first().setInputFiles({name:'test.png', mimeType:'image/png', buffer:png});
  await page.waitForFunction(() => currentSet.cards[0].definitionImage);
  await page.evaluate(() => saveAll());
  await page.reload();
  assert.equal(await page.locator('.image-editor img').count(), 2);
  await page.evaluate(() => duplicateCard(currentSet.cards[0].id));
  assert.equal(await page.locator('.image-editor img').count(), 4);
  await page.evaluate(() => { swapCard(currentSet.cards[0].id); saveAll(); });
  assert.equal(await page.evaluate(() => getSet(currentSet.id).cards[0].term), 'First');
  await page.setViewportSize({width:700, height:900});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({path:'/tmp/flashcards-editor.png', fullPage:true});
  for (const file of ['study.html', 'flashcard.html']) {
    await page.goto(`${base}/${file}?id=${id}`);
    assert.ok(await page.locator(file === 'study.html' ? '#front-text img' : '#card-text img').count());
    assert.equal(await page.locator('.card-image').first().evaluate(img => img.complete && img.naturalWidth > 0), true);
  }
  const downloadPromise = page.waitForEvent('download');
  await page.evaluate(id => exportSet(getSet(id)), id);
  const download = await downloadPromise;
  const json = fs.readFileSync(await download.path(), 'utf8');
  assert.ok(JSON.parse(json).cards[0].termImage.startsWith('data:image/jpeg;'));
  await page.evaluate(json => importFromJson(json), json);
  assert.equal(await page.evaluate(() => getSets().length), 2);
  assert.equal(await page.evaluate(() => getSets()[1].cards[0].termImage === getSets()[0].cards[0].termImage), true);
  const allDownload = page.waitForEvent('download');
  await page.evaluate(() => exportAllSets());
  const allJson = fs.readFileSync(await (await allDownload).path(), 'utf8');
  await page.evaluate(json => { localStorage.removeItem('flashdeck_sets'); importFromJson(json); }, allJson);
  assert.equal(await page.evaluate(() => getSets().length), 2);
  assert.ok(await page.evaluate(() => combineSets(getSets().map(s => s.id), 'Combined').cards[0].termImage));
  id = await page.evaluate(() => getSets()[0].id);
  await page.goto(`${base}/edit.html?id=${id}`);
  await page.evaluate(() => { removeCardImage(currentSet.cards[0].id, 'term'); saveAll(); });
  await page.reload();
  assert.equal(await page.evaluate(() => currentSet.cards[0].termImage), undefined);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); };
    markDirty(); saveAll();
  });
  assert.equal(await page.evaluate(() => dirty), true);
  assert.ok((await page.locator('#toast-container').textContent()).includes('Could not save'));
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('PASS: syntax, uploads, persistence, previews, narrow layout, study/focus images, duplicate/swap/combine, export/import, removal, quota failure');
})().catch(error => { console.error(error); process.exit(1); });
