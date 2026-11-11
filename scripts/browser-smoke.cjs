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
      await page.addInitScript(() => { Element.prototype.requestFullscreen = () => Promise.resolve(); });
      await page.goto(origin, {waitUntil:'domcontentloaded'});
      await page.locator('#request-fullscreen').click();
      await page.locator('#invite-code').fill('Test');
      await page.locator('#unlock-button').click();
      await page.locator('#yes-btn').waitFor({state:'visible'});
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
      assert.equal(layout.positionYes,'absolute');
      assert.equal(layout.positionNo,'absolute');
      assert.ok(layout.yes.width >= 98 && layout.no.width >= 98,'Emoji buttons must have large touch targets');
      assert.ok(layout.yes.height >= 90 && layout.no.height >= 90,'Emoji buttons too short');
      assert.ok(layout.yes.right + 10 < layout.no.left,'Emoji buttons overlap');
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
        await page.locator('#title').getByText('Okay! What sounds like fun?').waitFor({timeout:3000});
      }
      console.log('PASS: ' + viewport.width + 'x' + viewport.height + ' emoji layout and interaction');
      await page.close();
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(err => { console.error(err); process.exitCode=1; });
