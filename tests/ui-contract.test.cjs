'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { Script } = require('node:vm');
const html = readFileSync('public/index.html','utf8');
const js = html.match(/<script>([\s\S]*?)<\/script>/i)?.[1];
test('inline browser JavaScript has valid syntax', () => {
  assert.ok(js, 'missing application script');
  assert.doesNotThrow(() => new Script(js));
});
test('invitation uses only facial emoji, but keeps accessible Yes/No labels', () => {
  assert.match(js, /makeButton\('', 'btn-primary emoji-choice'/);
  assert.match(js, /makeButton\('', 'btn-secondary emoji-choice'/);
  assert.match(js, /aria-label', 'Yes, I would like to go out with Alex'/);
  assert.match(js, /aria-label', 'No, thank you'/);
  assert.doesNotMatch(js, /makeButton\('Yes'/);
  assert.doesNotMatch(js, /makeButton\('No'/);
});
test('No dodges three times with facial expressions but no new reaction text', () => {
  const dodge=js.slice(js.indexOf('function dodge(no)'),js.indexOf('function addAsk()'));
  assert.match(dodge, /tries >= 3/);
  assert.match(dodge, /count === 3/);
  for (const emoji of ['😛','🤪','😜']) assert.ok(dodge.includes(emoji));
  assert.doesNotMatch(dodge,/bubble\.textContent\s*=/);
  assert.doesNotMatch(dodge,/feedback\.textContent\s*=/);
});
test('gate supports visible-viewport keyboard repositioning and bunny narration', () => {
  assert.match(html,/\.gate:focus-within/);
  assert.match(js,/visualViewport\?\.addEventListener\('resize'/);
  assert.match(js,/function showPassword\(\)/);
  assert.match(js,/say\('Psst!/);
});
test('explicit user-submitted Netlify response is enabled and can be emailed', () => {
  assert.match(html,/name="going-out" data-netlify="true"/);
  assert.match(html,/name="subject"/);
  assert.match(js,/async function submitAnswer\(/);
  assert.match(js,/send-answer/);
  assert.match(js,/'decision': 'yes'/);
});

test('device voice picker prefers higher quality system voices with natural prosody', () => {
  assert.match(html, /id="voice-picker"/);
  assert.match(js, /function voiceQuality\(voice\)/);
  assert.match(js, /natural\|neural\|premium\|enhanced\|studio/);
  assert.match(js, /voiceschanged/);
  assert.match(js, /msg\.rate = 1\.02/);
  assert.match(js, /msg\.pitch = 1\.06/);
  assert.doesNotMatch(js, /https:\/\/.*(texttospeech|elevenlabs|openai)/);
});
test('No travels around a larger dedicated arena and still gives up after three dodges', () => {
  assert.match(html, /\.ask-buttons \{ position:relative; display:block; min-height:312px/);
  assert.match(html, /#no-btn \{ right:6%/);
  assert.match(js, /const travelX = Math\.max\(0, no\.offsetLeft - 12\)/);
  assert.match(js, /const travelY = Math\.max\(0, \(arena\.clientHeight - no\.offsetHeight\) \/ 2 - 10\)/);
  for (const target of ['-travelX*.97','travelY*.96','-travelX*.96']) assert.ok(js.includes(target));
  assert.match(js, /Date\.now\(\) - lastTouchDodge < 600/);
});
test('bunny gives playful, contextual narration across all outing choices', () => {
  for (const cue of ['carrot farming','carrot shop','carrot cake','rabbit assistant','bow tie']) {
    assert.ok(js.toLowerCase().includes(cue.toLowerCase()), 'Missing comedic cue: ' + cue);
  }
  assert.match(js, /en-us/i);
});
test('Yes and No have visible emoji markings and absolute layout overrides', () => {
  assert.match(js, /yesSignal\.textContent = '✅'/);
  assert.match(js, /noSignal\.textContent = '❌'/);
  assert.match(html, /\.ask-buttons #yes-btn,\s*\.ask-buttons #no-btn \{\s*position:absolute/);
  assert.match(html, /\.ask-buttons #yes-btn \{ inset-inline-start:3%/);
  assert.match(html, /\.ask-buttons #no-btn \{ inset-inline-end:3%/);
  assert.match(js, /yes\.setAttribute\('aria-label'/);
  assert.match(js, /no\.setAttribute\('aria-label'/);
});

test('activity details are meaningful and specific to the selected plan', () => {
  for (const activity of ['coffee','walk','food','sweet','surprise']) {
    assert.match(js,new RegExp(activity+": \\{ heading:"));
  }
  for (const detail of ['A cosy café and a good chat','A park and some nature',
    'Italian','Ice cream or gelato','Calm and cosy']) {
    assert.ok(js.includes(detail));
  }
  assert.match(js, /picks\.activityKey=key/);
  assert.match(js, /nav\('detail'\)/);
  assert.match(js, /nav\('area'\)/);
});
test('calendar is interactive, excludes previous days, and offers time options', () => {
  assert.match(js, /function addSchedule\(\)/);
  assert.match(js, /function drawCalendar\(\)/);
  assert.match(js, /btn\.disabled = key < today \|\| key > maxDate/);
  assert.match(js, /new Intl\.DateTimeFormat/);
  assert.match(js, /'Morning'/);
  assert.match(js, /'Afternoon'/);
  assert.match(js, /'Evening'/);
  assert.match(js, /'Flexible time'/);
  assert.match(js, /'Pick a day together later'/);
  assert.match(js, /continueBtn\.disabled = !picks\.day \|\| !picks\.time/);
});
test('submission and summary include activity, custom detail, area, day and time', () => {
  for(const key of ['detail','meet_area','day','time']) {
    assert.ok(html.includes('name="'+key+'"'),'Missing Netlify form field '+key);
    assert.ok(js.includes("'"+key+"':"),'Missing form value '+key);
  }
  assert.match(js, /'day': picks\.day/);
  assert.match(js, /'time': picks\.time/);
  assert.match(js, /'meet_area': picks\.meetArea/);
  assert.match(js, /'detail': picks\.detail/);
});
test('cartoon bunny is an expressive gray-white animated character',()=>{
  for(const mark of ['id="head"','id="ear-left"','id="ear-right"','id="look-around"','id="whiskers"','id="carrot"','id="face-speaking"']) {
    assert.ok(html.includes(mark),'Missing animation layer '+mark);
  }
  assert.match(html, /@keyframes cartoon-blink/);
  assert.match(html, /@keyframes talking-head/);
});
