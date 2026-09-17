const { chromium } = require('playwright-core');
const path = require('path');
const OUT = path.join(__dirname, 'out') + path.sep;
require('fs').mkdirSync(OUT, { recursive: true });

(async () => {
  const errors = [];
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  // Querformat wie auf einem gedrehten Handy
  const page = await browser.newPage({ viewport: { width: 740, height: 420 } });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console.error: ' + msg.text()); });

  await page.goto((process.env.BASE_URL || 'http://localhost:5173') + '/games/blackout/', { waitUntil: 'load' });
  await page.waitForTimeout(400);
  console.log('Menü sichtbar:', await page.isVisible('#screen-menu'));
  await page.screenshot({ path: OUT + 'bo_menu.png' });

  await page.click('#btn-start');
  await page.waitForTimeout(300);
  console.log('Nach Start:', JSON.stringify(await page.evaluate(() => window.BO.game.getDebugState())));

  // Mit der Tastatur spielen: nach rechts laufen und springen
  async function play(keys, ms) {
    for (const k of keys) await page.keyboard.down(k);
    await page.waitForTimeout(ms);
    for (const k of keys) await page.keyboard.up(k);
  }

  await play(['ArrowRight'], 700);
  let dbg = await page.evaluate(() => window.BO.game.getDebugState());
  console.log('Nach Laufen rechts:', JSON.stringify(dbg.ninja));

  await play(['ArrowRight', 'Space'], 500);
  dbg = await page.evaluate(() => window.BO.game.getDebugState());
  console.log('Nach Sprung:', JSON.stringify(dbg.ninja));
  await page.screenshot({ path: OUT + 'bo_play.png' });

  // Eine Weile herumspringen, um Gefahren/Tod zu provozieren
  for (let i = 0; i < 14; i++) {
    await play(i % 2 ? ['ArrowRight', 'Space'] : ['ArrowLeft'], 320);
    dbg = await page.evaluate(() => window.BO.game.getDebugState());
    if (dbg.state === 'gameover') { console.log(`Game Over nach Runde ${i}:`, JSON.stringify(dbg)); break; }
  }

  dbg = await page.evaluate(() => window.BO.game.getDebugState());
  console.log('Zwischenstand:', JSON.stringify(dbg));
  await page.screenshot({ path: OUT + 'bo_later.png' });

  // Touch-Steuerung prüfen (Bildschirmhälften): links laufen + rechts springen
  if (dbg.state === 'playing') {
    const box = await (await page.$('#stage')).boundingBox();
    await page.touchscreen.tap(box.x + box.width * 0.15, box.y + box.height * 0.8).catch(() => {});
    await page.waitForTimeout(150);
  }

  // Pause und Einstellungen
  if ((await page.evaluate(() => window.BO.game.getState())) === 'playing') {
    await page.click('#btn-pause');
    await page.waitForTimeout(150);
    console.log('Pause:', await page.evaluate(() => window.BO.game.getState()));
    await page.click('#btn-scheme-pause');
    await page.click('#btn-impact-pause');
    console.log('Einstellungen nach Umschalten:', JSON.stringify(await page.evaluate(() => window.BO.game.settings)));
    await page.screenshot({ path: OUT + 'bo_pause.png' });
    await page.click('#btn-resume');
  }

  // Raumwechsel erzwingen: Ninja direkt auf Schalter und Tür setzen
  const teleported = await page.evaluate(() => {
    const st = window.BO.game.getDebugState();
    return st.state;
  });
  console.log('Status vor Ende:', teleported);

  await browser.close();
  console.log('\n=== JS-Fehler ===');
  errors.length ? errors.forEach(e => console.log(e)) : console.log('keine');
  process.exit(errors.length ? 1 : 0);
})();
