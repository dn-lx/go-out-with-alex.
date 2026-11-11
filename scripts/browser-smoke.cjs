'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..', 'public');
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/.netlify/functions/unlock' && req.method === 'POST') {
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ ok:true, guestName:'Test Girl', inviteId:'e2e-test' }));
    return;
  }
  const name = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (name.includes('..')) { res.writeHead(403); res.end(); return; }
  const filename = path.join(root, name);
  if (!fs.existsSync(filename)) { res.writeHead(404); res.end(); return; }
  const type = filename.endsWith('.svg') ? 'image/svg+xml' : filename.endsWith('.webmanifest') ? 'application/manifest+json' : 'text/html';
  res.writeHead(200, {'Content-Type':type});
  fs.createReadStream(filename).pipe(res);
});
function listen(server) {
  return new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
}
(async () => {
  await listen(server);
  const origin = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({ channel:'chrome', headless:true, args:['--no-sandbox'] });
    for (const viewport of [{width:360,height:780},{width:390,height:844},{width:1280,height:850}]) {
      const page = await browser.newPage({viewport});
      const errors = [];
      page.on('pageerror', err => errors.push(String(err)));
      await page.goto(origin, {waitUntil:'domcontentloaded'});
      // The visual smoke test deliberately bypasses the fullscreen prompt:
      // headless Chrome does not reliably grant fullscreen privileges.
      await page.locator('#manual-fullscreen').evaluate(button => button.click());
      await page.locator('#invite-code').fill('Test');
      await page.locator('#unlock-button').click();
      await page.locator('#yes-btn').waitFor({state:'visible'});
      // Move the pointer away and allow any hover-triggered dodge to settle.
      await page.mouse.move(1, 1);
      await page.waitForTimeout(1050);
      const layout = await page.evaluate(() => {
        const arena = document.querySelector('.ask-buttons').getBoundingClientRect();
        const yes = document.querySelector('#yes-btn').getBoundingClientRect();
        const no = document.querySelector('#no-btn').getBoundingClientRect();
        const cssYes = getComputedStyle(document.querySelector('#yes-btn'));
        const cssNo = getComputedStyle(document.querySelector('#no-btn'));
        return {
          arena:{left:arena.left,right:arena.right,top:arena.top,bottom:arena.bottom},
          yes:{left:yes.left,right:yes.right,top:yes.top,bottom:yes.bottom,width:yes.width,height:yes.height},
          no:{left:no.left,right:no.right,top:no.top,bottom:no.bottom,width:no.width,height:no.height},
          positionYes:cssYes.position,positionNo:cssNo.position,
          emojisYes:document.querySelector('#yes-btn').textContent,
          emojisNo:document.querySelector('#no-btn').textContent,
          overflow:document.documentElement.scrollWidth-window.innerWidth
        };
      });
      console.log('LAYOUT ' + viewport.width + ': ' + JSON.stringify(layout));
      assert.equal(layout.positionYes,'absolute');
      assert.equal(layout.positionNo,'absolute');
      assert.ok(layout.yes.width >= 98 && layout.no.width >= 98,'Emoji buttons must have large touch targets');
      assert.ok(layout.yes.height >= 90 && layout.no.height >= 90,'Emoji buttons too short');
      assert.ok(layout.yes.right + 10 < layout.no.left,'Emoji buttons overlap');
      assert.ok(layout.yes.bottom < viewport.height - 8 && layout.no.bottom < viewport.height - 8,
        'Emoji choice buttons are below the first screen on ' + viewport.width + 'px');
      for (const [label,rect] of [['yes',layout.yes],['no',layout.no]]) {
        assert.ok(rect.left >= layout.arena.left-2 && rect.right <= layout.arena.right+2,label+' outside its arena');
        assert.ok(rect.top >= layout.arena.top-2 && rect.bottom <= layout.arena.bottom+2,label+' vertically clipped');
      }
      assert.ok(layout.emojisYes.includes('✅') && layout.emojisNo.includes('❌'),'Yes and No emoji indicators missing');
      assert.ok(layout.overflow <= 2,'Page overflows horizontally');
      assert.deepEqual(errors,[],'JavaScript errors');
      if (viewport.width === 390) {
        const no = page.locator('#no-btn');
        for (let i=0;i<3;i++) {
          await no.dispatchEvent('pointerdown',{pointerType:'touch'});
          const delta = await no.evaluate(el => el.style.getPropertyValue('--dx'));
          assert.notEqual(delta,'0px','The No button did not move');
          await page.waitForTimeout(930);
        }
        assert.ok(await no.evaluate(el=>el.classList.contains('gave-up')),'The No button must give up after three jumps');
        await no.click();
        assert.match(await page.locator('#title').innerText(),/no worries/i);
      } else {
        await page.locator('#yes-btn').click();
        await page.getByRole('heading',{name:'What would you enjoy doing?'}).waitFor({timeout:3000});
        if(viewport.width===360) {
          await page.getByRole('button',{name:/Coffee or tea/}).click();
          await page.getByRole('heading',{name:'What kind of coffee stop?'}).waitFor();
          await page.getByRole('button',{name:/A cosy café and a good chat/}).click();
        } else {
          await page.getByRole('button',{name:/Something sweet/}).click();
          await page.getByRole('heading',{name:'Which sweet treat?'}).waitFor();
          await page.getByRole('button',{name:/Ice cream or gelato/}).click();
        }
        await page.getByRole('heading',{name:'Where would be convenient?'}).waitFor();
        await page.getByRole('button',{name:/Meet halfway/}).click();
        await page.getByRole('heading',{name:'Which day works for you?'}).waitFor();
        await page.locator('.calendar-day:not([disabled]):not(.blank)').first().click();
        await page.getByRole('button',{name:/Afternoon/}).click();
        assert.equal(await page.locator('#schedule-continue').isEnabled(),true,'Day and time should unlock Continue');
        await page.locator('#schedule-continue').click();
        await page.getByRole('heading',{name:'Bunny is doing happy little jumps!'}).waitFor();
        const summary = await page.locator('.summary').innerText();
        assert.match(summary,/Meet halfway/);
        assert.match(summary,/Afternoon/);
        assert.match(summary,viewport.width===360?/cosy café/:/Ice cream or gelato/);
        // Re-enter to test the skip-day alternative.
        await page.getByRole('button',{name:/Play again/}).click();
        await page.getByRole('button',{name:/Open the envelope/}).click();
        await page.locator('#yes-btn').click();
        await page.getByRole('heading',{name:'What would you enjoy doing?'}).waitFor({timeout:3000});
        await page.getByRole('button',{name:/A walk and exploring/}).click();
        await page.getByRole('heading',{name:'Where should we wander?'}).waitFor();
        await page.getByRole('button',{name:/A park and some nature/}).click();
        await page.getByRole('button',{name:/Choose a place together/}).click();
        await page.getByRole('button',{name:/Pick a day together later/}).click();
        assert.match(await page.locator('.summary').innerText(),/Choose together/);
        // Verify every activity leads to its own meaningful follow-up.
        for (const scenario of [
          {activity:/A bite to eat/,question:'What food sounds good?',answer:/Italian/,expected:/Italian/},
          {activity:/A little surprise/,question:'What should the surprise feel like?',answer:/Calm and cosy/,expected:/Calm and cosy/}
        ]) {
          await page.getByRole('button',{name:/Play again/}).click();
          await page.getByRole('button',{name:/Open the envelope/}).click();
          await page.locator('#yes-btn').click();
          await page.getByRole('heading',{name:'What would you enjoy doing?'}).waitFor({timeout:3000});
          await page.getByRole('button',{name:scenario.activity}).click();
          await page.getByRole('heading',{name:scenario.question}).waitFor();
          await page.getByRole('button',{name:scenario.answer}).click();
          await page.getByRole('button',{name:/Choose a place together/}).click();
          await page.getByRole('button',{name:/Pick a day together later/}).click();
          assert.match(await page.locator('.summary').innerText(),scenario.expected);
        }
      }
      console.log('PASS: ' + viewport.width + 'x' + viewport.height + ' emoji layout and interaction');
      await page.close();
    }
    // Simulate a future generated character clip without spending audio credits.
    // This verifies recorded clips are preferred and stop on scene changes.
    const clipPage=await browser.newPage({viewport:{width:390,height:844}});
    const clipErrors=[];
    clipPage.on('pageerror', error=>clipErrors.push(String(error)));
    await clipPage.route('**/audio/manifest.json', route=>route.fulfill({
      status:200,contentType:'application/json',
      body:JSON.stringify({version:1,clips:{ask:'/audio/demo.mp3'}})
    }));
    await clipPage.addInitScript(()=>{
      window.__audioPlayed=[];
      window.__audioPaused=0;
      window.Audio=class MockAudio {
        constructor(url){ this.src=url;this.paused=true;this.currentTime=0;this.listeners={}; }
        addEventListener(name,fn){ this.listeners[name]=fn; }
        play(){
          this.paused=false;
          window.__audioPlayed.push(this.src);
          this.listeners.playing?.();
          return Promise.resolve();
        }
        pause(){ this.paused=true;window.__audioPaused++; }
        removeAttribute(name){ if(name==='src')this.src=''; }
      };
    });
    await clipPage.goto(origin,{waitUntil:'domcontentloaded'});
    await clipPage.locator('#manual-fullscreen').evaluate(btn=>btn.click());
    await clipPage.locator('#invite-code').fill('Test');
    await clipPage.locator('#unlock-button').click();
    await clipPage.locator('#yes-btn').waitFor({state:'visible'});
    const clipData=await clipPage.evaluate(()=>({
      paths:window.__audioPlayed,
      speaking:document.querySelector('#bunny').classList.contains('talking')
    }));
    assert.ok(clipData.paths.some(x=>x.endsWith('/audio/demo.mp3')),'Recorded bunny clip should play when present');
    assert.ok(clipData.speaking,'Bunny mouth must animate during recorded speech');
    await clipPage.locator('#yes-btn').click();
    assert.ok(await clipPage.evaluate(()=>window.__audioPaused)>=1,'Scene change must stop old audio');
    assert.deepEqual(clipErrors,[],'Recorded audio caused JavaScript errors');
    await clipPage.close();
    console.log('PASS: prerecorded character narration, lip sync and cancel-on-scene-change');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(err => { console.error(err); process.exitCode=1; });
