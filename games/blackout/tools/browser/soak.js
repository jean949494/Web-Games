/**
 * Dauerlauf: viele Räume am Stück, und dabei zusehen, ob etwas wegläuft.
 *
 * Ein Endlosspiel hat kein Ende, an dem aufgeräumt wird. Partikel, Gegner,
 * Weltgeometrie – alles wird pro Raum neu gebaut. Wenn dabei etwas liegen
 * bleibt, merkt man das nicht in Raum 3, sondern in Raum 80, und dann ruckelt
 * es auf dem Handy. Der Test spult deshalb weit vor und prüft nebenbei ein
 * paar Dinge, die nie passieren dürfen.
 *
 *   node games/blackout/tools/browser/soak.js [Räume]
 */
const path = require('path');
const { chromium } = require('playwright-core');
const OUT = path.join(__dirname, 'out') + path.sep;
require('fs').mkdirSync(OUT, { recursive: true });

const ROOMS = parseInt(process.argv[2] || '120', 10);
const state = page => page.evaluate(() => window.BO.game.getDebugState());
const heapMB = page => page.evaluate(() =>
  (performance.memory ? performance.memory.usedJSHeapSize : 0) / 1048576);

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM || undefined,
    args: ['--enable-precise-memory-info'],
  });
  const page = await browser.newPage({ viewport: { width: 740, height: 420 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto((process.env.BASE_URL || 'http://localhost:5173') + '/games/blackout/?debug', { waitUntil: 'load' });
  await page.click('#btn-start');
  await page.waitForTimeout(300);

  const problems = [];
  const heap0 = await heapMB(page);
  let lastRoom = -1, reached = 0;
  const t0 = Date.now();

  for (let i = 0; i < ROOMS; i++) {
    // Schalter und Tür in EINEM Rutsch, mit nur zwei Bildern dazwischen.
    // Sonst steht die Figur zwischen zwei Playwright-Aufrufen ein paar
    // Zehntelsekunden am Schalter herum - und ab Raum 4 reicht das einem
    // Geschütz. Der Raum setzt sich dann zurück, und der Test kam über
    // Raum 9 nie hinaus, ohne dass am Spiel etwas falsch gewesen wäre.
    // Nach Wanduhr geduldig sein, nicht nach Versuchen: Stirbt die Figur am
    // Schalter, setzt sich der Raum zurück und der Versuch war umsonst - das
    // ist richtiges Spielverhalten. Erst wenn ein Raum 20 Sekunden lang nicht
    // durchzubekommen ist, stimmt wirklich etwas nicht.
    let d = await state(page);
    const bis = Date.now() + 20000;
    while (Date.now() < bis && d.state !== 'gameover' && d.room <= lastRoom) {
      await page.evaluate(() => new Promise(done => {
        const g = window.BO.game;
        if (!g.debugWarp('switch')) return done();   // tot: einfach abwarten
        requestAnimationFrame(() => requestAnimationFrame(() => {
          g.debugWarp('door');
          done();
        }));
      }));
      await page.waitForTimeout(90);
      d = await state(page);
    }

    if (d.state === 'gameover') {
      console.log(`Lauf regulär beendet in Raum ${d.room} (Zeit abgelaufen).`);
      await page.click('#btn-restart');
      await page.waitForTimeout(400);
      lastRoom = -1;
      continue;
    }
    if (d.room <= lastRoom) {
      problems.push(`Raum ${d.room} in 20 s nicht durchzubekommen ` +
        `(switchOn=${d.switchOn}, tot=${d.ninja && d.ninja.dead}, ` +
        `Zustand ${d.state}, Tode ${d.deaths}, Uhr ${Math.round(d.timeLeft / 60)}s, ` +
        `Figur @${d.ninja && d.ninja.x},${d.ninja && d.ninja.y})`);
      await page.screenshot({ path: OUT + 'soak_haengt.png' });
      break;
    }
    reached = Math.max(reached, d.room);
    lastRoom = d.room;

    // Dinge, die nie passieren dürfen
    if (d.timeLeft < 0) problems.push(`negative Uhr in Raum ${d.room}`);
    if (d.timeLeft > 99 * 60 + 1) problems.push(`Uhr über dem Deckel (${d.timeLeft}) in Raum ${d.room}`);
    if (d.hazards > 20) problems.push(`${d.hazards} Gefahren in Raum ${d.room}`);
    if (d.pendingGold > 12) problems.push(`${d.pendingGold} ungebanktes Gold in Raum ${d.room}`);
    if (!d.ninja) problems.push(`keine Spielfigur in Raum ${d.room}`);

    if (i % 25 === 24) {
      console.log(`  Raum ${d.room}: Zeit ${Math.round(d.timeLeft / 60)}s, ` +
        `Gefahren ${d.hazards}, Heap ${(await heapMB(page)).toFixed(1)} MB`);
    }
  }

  const heap1 = await heapMB(page);
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`\nDurchgelaufen: ${reached + 1} Räume in ${secs}s`);
  if (heap0 > 0) {
    console.log(`Heap: ${heap0.toFixed(1)} MB -> ${heap1.toFixed(1)} MB ` +
      `(${(heap1 - heap0 >= 0 ? '+' : '') + (heap1 - heap0).toFixed(1)} MB)`);
  }
  await page.screenshot({ path: OUT + 'soak_ende.png' });
  await browser.close();

  console.log('Auffälligkeiten:', problems.length ? problems.slice(0, 10) : 'keine');
  console.log('JS-Fehler:', errors.length ? errors.slice(0, 5) : 'keine');
  process.exit(problems.length || errors.length ? 1 : 0);
})();
