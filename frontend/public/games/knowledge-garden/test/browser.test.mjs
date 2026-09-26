/**
 * Browser smoke test — drives the real game in Chrome.
 *
 * This proves the game is actually playable, not just that its modules
 * import: it boots the page, waits for WebGL, walks the title → map → intro
 * → play flow, steers the owl, and screenshots the result.
 *
 * Run:  node --test test/browser.test.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
// puppeteer-core lives in the backend workspace (it is not a game dependency),
// so it is resolved by absolute path to keep the game folder self-contained.
const PUPPETEER_CORE = process.env.PUPPETEER_CORE
  || 'file:///D:/WORK/03-education/rafiqi-full-2026-09-02-2/rafiqi/backend/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const puppeteer = (await import(PUPPETEER_CORE)).default;

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CHROME = process.env.CHROME_PATH
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

/** Serve the game folder over http so ES modules load exactly as in production. */
function serveGame() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let path = decodeURIComponent(url.pathname);
      if (path === '/') path = '/index.html';
      // Keep the resolved path inside the game folder.
      const file = join(ROOT, normalize(path).replace(/^([/\\])+/, ''));
      if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

const { server, port } = await serveGame();
const PAGE_URL = `http://127.0.0.1:${port}/index.html`;

// Diagnostic entry point: `node test/browser.test.mjs --diag` loads the page and
// prints every console message and page error, then exits. Use it whenever the
// boot sequence fails so the real cause is visible instead of a bare timeout.
if (process.argv.includes('--diag')) {
  const b = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader']
  });
  const pg = await b.newPage();
  pg.on('console', (m) => console.log(`[${m.type()}]`, m.text()));
  pg.on('pageerror', (e) => console.log('[pageerror]', e.message, '\n', e.stack));
  pg.on('requestfailed', (r) => console.log('[requestfailed]', r.url(), r.failure()?.errorText));
  pg.on('response', (r) => { if (r.status() >= 400) console.log('[http]', r.status(), r.url()); });
  await pg.goto(PAGE_URL, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 3000));
  console.log('loading gone?', await pg.evaluate(() =>
    document.getElementById('kg-loading')?.classList.contains('is-gone')));
  await b.close();
  server.close();
  process.exit(0);
}

// Diagnostic entry point for the play phase: `node test/browser.test.mjs --play`
// walks title → map → intro → play and reports any error raised while the 3D
// level is being built. This is where world-building bugs surface.
if (process.argv.includes('--play')) {
  const b = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader']
  });
  const pg = await b.newPage();
  await pg.setViewport({ width: 1280, height: 720 });
  pg.on('console', (m) => { if (m.type() === 'error') console.log('[error]', m.text()); });
  pg.on('pageerror', (e) => console.log('[pageerror]', e.message, '\n', e.stack));
  await pg.goto(PAGE_URL, { waitUntil: 'networkidle0', timeout: 30000 });
  await pg.waitForFunction(() => document.getElementById('kg-loading')?.classList.contains('is-gone'), { timeout: 20000 });
  await pg.click('#kg-start');
  await pg.waitForSelector('#kg-worlds .kg-world');
  await pg.click('#kg-worlds .kg-world .kg-lvl');
  await pg.waitForSelector('#kg-intro:not(.hidden)');
  console.log('clicking start…');
  await pg.click('#kg-intro-go');
  await new Promise((r) => setTimeout(r, 2500));
  console.log('hud shown?', await pg.evaluate(() => !document.getElementById('kg-hud').classList.contains('hidden')));
  console.log('objective?', await pg.evaluate(() => {
    const o = document.getElementById('kg-objective');
    return { shown: !o.classList.contains('hidden'), prompt: document.getElementById('kg-prompt').textContent, target: document.getElementById('kg-target').textContent };
  }));
  // Capture the live play phase for visual review.
  const shotDir = new URL('../screenshots/', import.meta.url).pathname.replace(/^\//, '');
  await mkdir(shotDir, { recursive: true });
  await pg.screenshot({ path: join(shotDir, 'play.png') });
  await b.close();
  server.close();
  process.exit(0);
}

// Diagnostic entry point for layout: `node test/browser.test.mjs --layout`
// reports the on-screen box of every HUD element so clipping or overlap is
// measured rather than guessed at from a screenshot. Runs desktop and mobile.
if (process.argv.includes('--layout')) {
  const b = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader']
  });
  for (const vp of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    const pg = await b.newPage();
    await pg.setViewport(vp);
    pg.on('pageerror', (e) => console.log('[pageerror]', e.message));
    await pg.goto(PAGE_URL, { waitUntil: 'networkidle0', timeout: 30000 });
    await pg.waitForFunction(() => document.getElementById('kg-loading')?.classList.contains('is-gone'), { timeout: 20000 });
    await pg.click('#kg-start');
    await pg.waitForSelector('#kg-worlds .kg-world');
    await pg.click('#kg-worlds .kg-world .kg-lvl');
    await pg.waitForSelector('#kg-intro:not(.hidden)');
    await pg.click('#kg-intro-go');
    await new Promise((r) => setTimeout(r, 1500));
    console.log(`\n=== viewport ${vp.width}x${vp.height} ===`);
    console.log(await pg.evaluate(() => {
      const ids = ['kg-hud', 'kg-objective', 'kg-hint-btn', 'kg-pause-btn', 'kg-streak', 'kg-level-name', 'kg-touch'];
      const out = {};
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) { out[id] = 'missing'; continue; }
        const r = el.getBoundingClientRect();
        out[id] = {
          visible: !el.classList.contains('hidden'),
          x: Math.round(r.x), y: Math.round(r.y),
          w: Math.round(r.width), h: Math.round(r.height),
          offscreen: r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.x < -1 || r.y < -1
        };
      }
      return out;
    }));
    await pg.close();
  }
  await b.close();
  server.close();
  process.exit(0);
}
let browser;
let page;
const errors = [];

test.before(async () => {
  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader']
  });
  page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  // Any console error or page exception fails the test.
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto(PAGE_URL, { waitUntil: 'networkidle0', timeout: 30000 });
  // The loading overlay is removed once the save has loaded.
  await page.waitForFunction(
    () => document.getElementById('kg-loading')?.classList.contains('is-gone'),
    { timeout: 20000 }
  );
});

test.after(async () => {
  await browser?.close();
  server.close();
});

test('the page boots with no console errors', () => {
  assert.deepEqual(errors, [], `browser reported errors:\n${errors.join('\n')}`);
});

test('WebGL is initialised and the canvas is rendering', async () => {
  const info = await page.evaluate(() => {
    const c = document.getElementById('kg-canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    return { w: c.width, h: c.height, hasGl: Boolean(gl) };
  });
  assert.equal(info.hasGl, true, 'WebGL context available');
  assert.ok(info.w > 0 && info.h > 0, 'canvas has a real size');
});

test('the title screen shows the story and the start button', async () => {
  const visible = await page.evaluate(() => ({
    shown: !document.getElementById('kg-title').classList.contains('hidden'),
    name: document.querySelector('.kg-title__name')?.textContent,
    story: document.querySelector('.kg-title__story')?.textContent.length,
    hasStart: Boolean(document.getElementById('kg-start'))
  }));
  assert.equal(visible.shown, true);
  assert.ok(visible.name.includes('رفيقي'), 'the mascot name is shown');
  assert.ok(visible.story > 40, 'the story is present');
  assert.equal(visible.hasStart, true);
});

test('the world map lists all 7 worlds with 35 levels', async () => {
  await page.click('#kg-start');
  await page.waitForSelector('#kg-worlds .kg-world', { timeout: 10000 });

  const map = await page.evaluate(() => ({
    worlds: document.querySelectorAll('#kg-worlds .kg-world').length,
    levels: document.querySelectorAll('#kg-worlds .kg-lvl').length,
    locked: document.querySelectorAll('#kg-worlds .kg-lvl--locked').length,
    firstUnlocked: !document.querySelector('#kg-worlds .kg-world .kg-lvl')?.classList.contains('kg-lvl--locked')
  }));
  assert.equal(map.worlds, 7, 'seven worlds');
  assert.equal(map.levels, 35, 'thirty-five levels');
  assert.equal(map.firstUnlocked, true, 'the first level is unlocked');
  assert.ok(map.locked > 0, 'later levels start locked');
});

test('opening level 1 shows the briefing with its beats', async () => {
  await page.click('#kg-worlds .kg-world .kg-lvl');
  await page.waitForSelector('#kg-intro:not(.hidden)', { timeout: 10000 });

  const intro = await page.evaluate(() => ({
    title: document.getElementById('kg-intro-title').textContent,
    text: document.getElementById('kg-intro-text').textContent,
    beats: document.querySelectorAll('#kg-intro-beats li').length
  }));
  assert.ok(intro.title.includes('حديقة الحروف'), 'names the world');
  assert.ok(intro.text.length > 20, 'has an introduction');
  assert.ok(intro.beats >= 5, 'lists the beats ahead');
});

test('starting the level switches to play and an objective appears', async () => {
  await page.click('#kg-intro-go');
  await page.waitForSelector('#kg-hud:not(.hidden)', { timeout: 10000 });
  // Let the owl run for a moment so the first zone activates.
  await new Promise((r) => setTimeout(r, 1500));

  const state = await page.evaluate(() => ({
    hud: !document.getElementById('kg-hud').classList.contains('hidden'),
    touch: !document.getElementById('kg-touch').classList.contains('hidden'),
    objectiveShown: !document.getElementById('kg-objective').classList.contains('hidden'),
    prompt: document.getElementById('kg-prompt').textContent,
    target: document.getElementById('kg-target').textContent,
    progress: document.getElementById('kg-progress-text').textContent
  }));
  assert.equal(state.hud, true, 'the HUD is visible during play');
  assert.equal(state.objectiveShown, true, 'an educational objective is presented');
  assert.ok(state.prompt.length > 3, 'the prompt is readable');
  assert.ok(state.target.length > 0, 'the target letter/word is shown');
  assert.match(state.progress, /^\d+ \/ \d+$/, 'progress is shown as done / total');
});

test('steering and jumping keep the run stable', async () => {
  await page.keyboard.down('ArrowRight');
  await new Promise((r) => setTimeout(r, 400));
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('Space');
  await new Promise((r) => setTimeout(r, 400));
  await page.keyboard.down('ArrowLeft');
  await new Promise((r) => setTimeout(r, 400));
  await page.keyboard.up('ArrowLeft');

  assert.deepEqual(errors, [], `input produced errors:\n${errors.join('\n')}`);
  const stillPlaying = await page.evaluate(
    () => !document.getElementById('kg-hud').classList.contains('hidden')
  );
  assert.equal(stillPlaying, true, 'the run is still going');
});

test('the pause screen opens and closes', async () => {
  await page.keyboard.press('Escape');
  await page.waitForSelector('#kg-pause:not(.hidden)', { timeout: 5000 });
  await page.click('#kg-resume');
  await page.waitForFunction(
    () => document.getElementById('kg-pause').classList.contains('hidden'),
    { timeout: 5000 }
  );
  assert.deepEqual(errors, [], `pausing produced errors:\n${errors.join('\n')}`);
});

test('a screenshot of live gameplay is captured', async () => {
  const dir = new URL('../screenshots/', import.meta.url).pathname.replace(/^\//, '');
  await mkdir(dir, { recursive: true });
  const out = join(dir, 'gameplay.png');
  await page.screenshot({ path: out });
  assert.ok((await readFile(out)).length > 1000, 'a non-empty screenshot was written');
  await writeFile(join(dir, '.ok'), 'ok');
});

/**
 * Layout regression guard.
 *
 * Two real bugs were found by measuring the DOM rather than eyeballing a
 * screenshot: the objective panel lost its centring because the entrance
 * animation overrode `transform`, and the hint button sat on top of the
 * touch jump/dash buttons. These assertions keep both fixed.
 */
test('HUD elements stay on screen and centred on desktop and mobile', async () => {
  for (const vp of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    await page.setViewport(vp);
    // Give the resize a frame plus the objective entrance animation to settle.
    await new Promise((r) => setTimeout(r, 900));

    const boxes = await page.evaluate(() => {
      const pick = (id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          visible: !el.classList.contains('hidden'),
          x: r.x, y: r.y, w: r.width, h: r.height,
          right: r.right, bottom: r.bottom
        };
      };
      return {
        vw: innerWidth, vh: innerHeight,
        objective: pick('kg-objective'),
        hint: pick('kg-hint-btn'),
        jump: pick('kg-jump'),
        dash: pick('kg-dash'),
        pause: pick('kg-pause-btn')
      };
    });

    for (const [name, b] of Object.entries(boxes)) {
      if (name === 'vw' || name === 'vh' || !b || !b.visible) continue;
      assert.ok(b.x >= -1 && b.y >= -1, `${name} starts on screen at ${vp.width}px`);
      assert.ok(b.right <= boxes.vw + 1, `${name} is not cut off on the right at ${vp.width}px`);
      assert.ok(b.bottom <= boxes.vh + 1, `${name} is not cut off at the bottom at ${vp.width}px`);
    }

    // The objective must be horizontally centred, not merely on screen.
    if (boxes.objective?.visible) {
      const centre = boxes.objective.x + boxes.objective.w / 2;
      assert.ok(
        Math.abs(centre - boxes.vw / 2) < 4,
        `objective is centred at ${vp.width}px (centre ${Math.round(centre)} vs ${boxes.vw / 2})`
      );
    }

    // On touch layouts the hint button must not sit on the jump/dash buttons.
    if (vp.width <= 640 && boxes.hint?.visible && boxes.jump?.visible) {
      const overlap = !(boxes.hint.bottom < boxes.jump.y
        || boxes.hint.y > boxes.jump.bottom
        || boxes.hint.right < boxes.jump.x
        || boxes.hint.x > boxes.jump.right);
      assert.equal(overlap, false, 'the hint button must not cover the jump button');
    }
  }
  await page.setViewport({ width: 1280, height: 720 });
});
