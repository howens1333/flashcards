// Start a local server, then run: node tests/responsive-ui.cjs
// Set CHROMIUM_PATH for a custom Chromium binary. Requires Playwright.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({headless:true,
  ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {}),
  args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--use-gl=angle','--no-zygote']});
 const context = await browser.newContext({serviceWorkers:'block',acceptDownloads:true});
 const page = await context.newPage(); const errors=[];
 page.on('pageerror', error=>errors.push(error.message));
 await page.route('https://**/*',route=>route.abort());
 const base=process.env.TEST_URL || 'http://127.0.0.1:8765';
 await page.goto(base);
 await page.evaluate(()=>{
  localStorage.setItem('flashdeck_theme','dark');
  const canvas=document.createElement('canvas');canvas.width=200;canvas.height=100;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#2d5a27';ctx.fillRect(0,0,200,100);
  const image=canvas.toDataURL();
  const cards=Array.from({length:8},(_,i)=>({id:'card-'+i,term:'Term '+i,definition:'Definition '+i,...(i===0?{termImage:image}:{})}));
  saveSet({id:'layout',title:'HUM1020 #2',description:'Study notes',cards});
  saveSet({id:'single',title:'One card',cards:[cards[0]]});
 });
 for(const width of [375,635,660,680,700,800,1024,1440]){
  await page.setViewportSize({width,height:850});
  await page.goto(base+'/edit.html?id=layout');
  const geometry=await page.evaluate(()=>{
   const row=document.querySelector('.card-row');
   const field=row.querySelector('textarea');const title=document.querySelector('#edit-title');
   const desc=document.querySelector('#edit-desc');const header=document.querySelector('.edit-header');
   return {scroll:document.documentElement.scrollWidth,viewport:innerWidth,
    field:field.getBoundingClientRect().width,row:row.getBoundingClientRect().width,
    title:title.getBoundingClientRect().width,desc:desc.getBoundingClientRect().width,
    header:header.getBoundingClientRect().width,font:getComputedStyle(title).fontFamily};
  });
  assert.ok(geometry.scroll<=width, `editor overflow ${width}: ${JSON.stringify(geometry)}`);
  assert.ok(geometry.field>200, `squeezed editor ${width}`);
  assert.ok(Math.abs(geometry.title-geometry.header)<2, 'title should fill header');
  assert.ok(Math.abs(geometry.desc-geometry.header)<2, 'description should fill header');
  assert.ok(!geometry.font.includes('Serif'), 'sans-serif titles');
  assert.equal(await page.locator('#save-bar button').count(),1);
  assert.equal(await page.locator('.edit-actions button:has-text("Export JSON")').count(),1);
  for(const link of await page.locator('nav.set-nav .nav-links a').all()){
   if(!await link.isVisible()) continue;
   const box=await link.boundingBox();assert.ok(box.x>=0 && box.x+box.width<=width+1,'navigation clipped');
  }
  if(width===635) { await page.waitForTimeout(200); await page.screenshot({path:'/tmp/flashcards-responsive-editor.png'}); }
 }
 // The Match tab must navigate from Study instead of pointing to '#'.
 await page.goto(base+'/study.html?id=layout');
 await page.locator('nav #match-link').click();
 await page.waitForURL('**/match.html?id=layout');
 assert.equal(await page.locator('.match-tile').count(),12);
 // Rapid taps during a wrong answer should not select or score another pair.
 const firstId=await page.locator('.match-tile[data-side="term"]').first().getAttribute('data-id');
 await page.locator(`.match-tile[data-id="${firstId}"][data-side="term"]`).click();
 const wrongDef=page.locator(`.match-tile[data-side="def"]:not([data-id="${firstId}"])`).first();
 await wrongDef.click();
 const attempts=await page.evaluate(()=>totalWrong);
 await page.locator('.match-tile[data-side="term"]').last().click({force:true});
 assert.equal(await page.evaluate(()=>totalWrong),attempts);
 await page.waitForTimeout(550);
 // Complete all batches, checking that matched definitions cannot be reused.
 while(await page.locator('#match-grid').isVisible()){
  const ids=await page.locator('.match-tile[data-side="term"]').evaluateAll(els=>els.map(e=>e.dataset.id));
  for(const id of ids){
   await page.locator(`.match-tile[data-id="${id}"][data-side="term"]`).click();
   await page.locator(`.match-tile[data-id="${id}"][data-side="def"]`).click();
   await page.waitForTimeout(460);
   const score=await page.evaluate(()=>totalCorrect);
   await page.locator(`.match-tile[data-id="${id}"][data-side="def"]`).click({force:true});
   assert.equal(await page.evaluate(()=>totalCorrect),score);
  }
  await page.waitForTimeout(180);
  if(await page.locator('#batch-screen').isVisible()) await page.locator('#batch-next-btn').click();
  else break;
 }
 assert.equal(await page.locator('#results-correct').textContent(),'8');
 await page.getByRole('button',{name:'Play Again'}).click();
 assert.equal(await page.locator('.match-tile').count(),12);
 // A one-card set is usable and can be completed.
 await page.goto(base+'/match.html?id=single');
 assert.equal(await page.locator('.match-tile').count(),2);
 await page.locator('.match-tile[data-side="term"]').press('Enter');
 await page.locator('.match-tile[data-side="def"]').press('Enter');
 await page.waitForTimeout(650);
 assert.equal(await page.locator('#results-correct').textContent(),'1');
 // Other set pages and menus also fit split screen.
 for(const file of ['study.html','flashcard.html','learn.html','test.html','stats.html','index.html']){
  await page.setViewportSize({width:635,height:700});
  await page.goto(base+'/'+file+(file==='index.html'?'':'?id=layout'));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),file+' overflow');
  if(file==='index.html'){
   await page.locator('.hamburger-btn').click();
   await page.waitForTimeout(300);
   const box=await page.locator('.hamburger-menu').boundingBox();
   assert.ok(box.x>=0 && box.x+box.width<=635 && box.height<=700,'menu must fit viewport');
  }
 }
 assert.deepEqual(errors,[]);
 await browser.close();
 console.log('PASS: eight editor widths, full-width fields, sans-serif, export placement, nav links, Match wrong/correct/rapid taps/batches/restart/single-card/keyboard, all set pages and narrow menu');
})().catch(error=>{console.error(error);process.exit(1);});
