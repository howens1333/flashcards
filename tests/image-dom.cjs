const {JSDOM}=require('jsdom');
const fs=require('fs');const assert=require('node:assert/strict');
const img='data:image/jpeg;base64,YWJj';
const seed=[{id:'test',title:'Test',cards:[{id:'card',term:'Hello',definition:'World',termImage:img,definitionImage:img},{id:'two',term:'Other',definition:'Second'}]}];
for(const file of ['edit.html','study.html','flashcard.html','learn.html','match.html','test.html']){
 const html=fs.readFileSync(file,'utf8');const dom=new JSDOM(html,{url:'http://localhost/'+file+'?id=test',runScripts:'outside-only'});const w=dom.window;
 w.localStorage.setItem('flashdeck_sets',JSON.stringify(seed));
 w.eval(fs.readFileSync('app.js','utf8').replace('const SYNC_ENABLED = true','const SYNC_ENABLED = false'));
 for(const [,script] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) if(script.trim()) w.eval(script);
 if(file==='edit.html'){
  assert.equal(w.document.querySelectorAll('.image-editor img').length,2);
  w.removeCardImage('card','term');w.saveAll();assert.equal(w.getSet('test').cards[0].termImage,undefined);
 } else if(file==='study.html') assert.equal(w.document.querySelectorAll('#front-text img').length,1);
 else if(file==='flashcard.html'){assert.equal(w.document.querySelectorAll('#card-text img').length,1);w.revealCard();assert.equal(w.document.querySelectorAll('#card-text img').length,1);}
 else if(file==='learn.html') {assert.equal(w.document.querySelectorAll('#q-text img').length,0+ (w.document.querySelector('#q-text').textContent.includes('World')?1:0));}
 else if(file==='test.html'){w.document.querySelector('#shuffle-q').checked=false;w.startTest();assert.equal(w.document.querySelectorAll('.question-text img').length,1);}
 console.log('PASS DOM:',file);w.close();
}
