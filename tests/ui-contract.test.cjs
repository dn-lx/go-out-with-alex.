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
test('cartoon is now an actual MP4 video element, not SVG or a GIF',()=>{
  assert.match(html, /<video id="bunny-video"/);
  assert.match(html, /playsinline webkit-playsinline autoplay muted loop/);
  assert.match(html, /poster="\/video\/poster\.png"/);
  assert.doesNotMatch(html, /<svg\b/i);
  assert.match(js, /function playBunnyFilm\(path,text,token,onComplete,clipKey\)/);
  assert.match(js, /fetch\('\/video\/manifest\.json'/);
  assert.match(js, /bunnyVideo\.play\(\)/);
  assert.match(js, /bunnyVideo\.pause\(\)/);
  const source=readFileSync('scripts/video/render_nibbles.py','utf8');
  assert.match(source, /nibbles-reference\.webp/);
  assert.match(source, /def load_poses\(/);
  assert.match(source, /def pose_at\(/);
  assert.match(source, /def voice_level\(/);
  assert.match(source, /mouth shapes follow the actual Qwen waveform envelope/);
  assert.match(source, /libx264/);
  assert.match(source, /'-c:a'/);
  assert.match(source, /def render_idle\(/);
  assert.doesNotMatch(source, /cv2\.remap|animated_frame/);
});
test('pre-recorded bunny narration is available with an explicit safe device voice fallback', () => {
  const manifest = JSON.parse(readFileSync('public/audio/manifest.json','utf8'));
  assert.equal(manifest.version,1);
  assert.equal(typeof manifest.clips,'object');
  assert.match(js, /fetch\('\/audio\/manifest\.json'/);
  assert.match(js, /function say\(text,clipKey=sceneTrackKey\(\),onComplete\)/);
  assert.match(js, /function playRecordedClip\(path,text,token,onComplete\)/);
  assert.match(js, /function speakWithDevice\(text,token,onComplete\)/);
  assert.match(js, /audio\.play\(\)\.catch\(fallBack\)/);
  assert.match(js, /voiceSession/);
});
test('expressive character narration maps to all scenes and every activity-specific question', () => {
  const worklist = JSON.parse(readFileSync('scripts/voice-script.json','utf8'));
  const ids = ['password','password-error','intro','ask','yes','outing',
    'detail-coffee','detail-walk','detail-food','detail-sweet','detail-surprise',
    'area','schedule','success','decline'];
  for (const id of ids) {
    assert.equal(typeof worklist.lines[id],'string','Missing planned recording: '+id);
    assert.ok(worklist.lines[id].length >= 20,'Too short recording: '+id);
  }
  assert.match(js, /sceneTrackKey = \(\) => step === 'detail' \? 'detail-'\+picks\.activityKey : step/);
  assert.match(js, /'password-error'/);
  assert.match(js, /'password'/);
  assert.match(js, /'yes'/);
});
test('video and sound are kept together: no timer-driven fake mouth on the visible character',()=>{
  assert.match(js, /videoClips\[clipKey\]/);
  assert.match(js, /playBunnyFilm\(film,text,token,onComplete,clipKey\)/);
  assert.match(js, /bunnyVideo\.onended/);
  assert.match(js, /bunnyVideo\.onerror=fallback/);
  assert.match(js, /startIdleVideo\(\)/);
  assert.match(js, /currentRecording\.pause\(\)/);
  const source=readFileSync('scripts/video/render_nibbles.py','utf8');
  assert.match(source, /voice_level\(env, norm, t\)/);
  assert.match(source, /pose_at\(name, t, duration, level\)/);
  assert.match(source, /IDLE_POSES/);
  assert.match(source, /GESTURES/);
  assert.match(source, /'-shortest'/);
});
test('recorded narration only activates after the entire clip set is published', () => {
  const { existsSync, statSync, openSync, readSync, closeSync } = require('node:fs');
  const manifest = JSON.parse(readFileSync('public/audio/manifest.json','utf8'));
  const scripts = JSON.parse(readFileSync('scripts/tts/bunny-lines.json','utf8'));
  const keys = Object.keys(manifest.clips);
  // Empty manifest is the intentional browser-TTS fallback while regenerating.
  if (keys.length === 0) return;
  assert.equal(manifest.engine, 'Qwen3-TTS-12Hz-1.7B-CustomVoice',
    'Do not inadvertently reactivate the Kokoro recordings');
  assert.deepEqual(keys.sort(), Object.keys(scripts.clips).sort(),
    'Release must include every bunny dialogue line');
  for (const [id, url] of Object.entries(manifest.clips)) {
    assert.match(id,/^[a-z0-9_-]+$/);
    assert.equal(url,'/audio/'+id+'.mp3');
    const pathname = 'public'+url;
    assert.ok(existsSync(pathname),'Missing published recording '+id);
    assert.ok(statSync(pathname).size > 2500,'Recording too small: '+id);
    const fh = openSync(pathname,'r');
    const header = Buffer.alloc(4);
    readSync(fh,header,0,4,0);
    closeSync(fh);
    assert.ok(header.toString('latin1').startsWith('ID3') ||
      (header[0] === 0xff && (header[1] & 0xe0) === 0xe0),
      'Recording does not look like MP3: '+id);
  }
});

test('the approved 3D bunny is used without a human portrait',()=>{
  const {existsSync,statSync}=require('node:fs');
  assert.ok(existsSync('public/video/nibbles-reference.webp'));
  assert.ok(statSync('public/video/nibbles-reference.webp').size>3000);
  assert.doesNotMatch(html, /<img[^>]+(?:alex|profile|headshot|avatar)/i);
  assert.match(html, /#eaf2fc/i);
  assert.match(html, /#1478df/i);
  assert.match(html, /#f7fafd/i);
  const admin=readFileSync('public/admin.html','utf8');
  assert.match(admin, /#f6f9fd/);
  assert.match(admin, /#237cde/);
});


test('invitation uses an immersive viewport layout and the approved Nibbles art on the entry gate',()=>{
  assert.match(html, /height:100svh; height:100dvh/);
  assert.match(html, /grid-template-columns:minmax\(0,1\.16fr\) minmax\(360px,\.84fr\)/);
  assert.match(html, /grid-template-rows:minmax\(165px,37dvh\) minmax\(0,1fr\)/);
  assert.equal((html.match(/class=\"gate-character\" src=\"\/video\/idle\.mp4\"/g)||[]).length,2);
  assert.equal((html.match(/class=\"gate-canvas\"/g)||[]).length,2);
});

test('animation atlas preserves Nibbles and supplies distinct acting keyframes',()=>{
  const {existsSync,statSync}=require('node:fs');
  const atlas='public/video/nibbles-pose-sheet.webp';
  assert.ok(existsSync(atlas));
  assert.ok(statSync(atlas).size>100000);
  const mischief='public/video/nibbles-mischief-sheet.webp';
  assert.ok(existsSync(mischief));
  assert.ok(statSync(mischief).size>100000);
  const source=readFileSync('scripts/video/render_nibbles.py','utf8');
  for(const marker of ['IDLE_POSES','GESTURES','HAPPY','load_poses','voice_level','pose_at','render_clip']) assert.ok(source.includes(marker));
  assert.match(source,/Qwen3-TTS/);
  assert.match(source,/waveform-driven mouth/);
  assert.match(source,/exactly 20 poses/);
  assert.match(source,/fluffy tail/);
  assert.match(source,/return 19/);
});

test('the player accepts the current version 3 video manifest and starts idle animation',()=>{
  const videoManifest=JSON.parse(readFileSync('public/video/manifest.json','utf8'));
  assert.equal(videoManifest.version,3);
  assert.equal(Object.keys(videoManifest.clips).length,16);
  assert.match(js,/Number\.isInteger\(data\?\.version\)\s*\|\|\s*data\.version<1/);
  assert.match(js,/videoClips\.idle='\/video\/idle\.mp4'/);
  assert.match(js,/startIdleVideo\(\)/);
});

test('the bunny is cut out, larger, and option panels stay on top without scrolling',()=>{
  assert.match(html,/keyBunnyVideo\(bunnyVideo,bunnyCanvas\)/);
  assert.match(html,/const pixels=frame\.data/);
  assert.match(html,/\.bunny-wrap \{[^}]*width:min\(92vw,88vh\)/);
  assert.match(html,/\.content-pane \{[^}]*overflow:hidden/);
  assert.match(html,/\.choices \{ grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(html,/backdrop-filter:blur\(14px\)/);
});
