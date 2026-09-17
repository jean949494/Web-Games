const { chromium } = require('playwright-core');
const path = require('path');
const OUT = path.join(__dirname, 'out') + path.sep;
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const page = await browser.newPage({ viewport: { width: 740, height: 420 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto((process.env.BASE_URL || 'http://localhost:5173') + '/games/blackout/?debug', { waitUntil: 'load' });
  await page.click('#btn-start');
  await page.waitForTimeout(250);

  const st0 = await page.evaluate(() => window.BO.game.getDebugState());
  console.log(`Start: Zeit ${Math.round(st0.timeLeft / 60)}s, Raum ${st0.room}, Tode ${st0.deaths}`);

  // Gold einsammeln (Schalter-Warp läuft an Gold vorbei) und Stand prüfen
  await page.evaluate(() => window.BO.game.debugWarp('switch'));
  await page.waitForTimeout(200);
  let st = await page.evaluate(() => window.BO.game.getDebugState());
  console.log(`Nach Schalter: switchOn=${st.switchOn}, ungebanktes Gold ${st.pendingGold}`);

  // Absichtlich sterben: Zeit-unabhängig über eine Mine ist unzuverlässig,
  // deshalb prüfen wir den Respawn über mehrere Räume hinweg im Normalspiel.
  await page.evaluate(() => window.BO.game.debugWarp('door'));
  await page.waitForTimeout(250);
  st = await page.evaluate(() => window.BO.game.getDebugState());
  console.log(`Nach Tür: Raum ${st.room}, Zeit ${Math.round(st.timeLeft / 60)}s, Gold zurückgesetzt: ${st.pendingGold === 0}`);

  // Bis in gefährliche Räume vorspulen und dort ausharren -> Tode provozieren
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.BO.game.debugWarp('switch'));
    await page.waitForTimeout(90);
    await page.evaluate(() => window.BO.game.debugWarp('door'));
    await page.waitForTimeout(130);
  }
  st = await page.evaluate(() => window.BO.game.getDebugState());
  console.log(`Raum ${st.room} erreicht, Zeit ${Math.round(st.timeLeft / 60)}s`);

  // Jetzt stillhalten: Geschütze/Drohnen sollen treffen. Der Lauf darf
  // dadurch NICHT enden - es soll neu eingesetzt werden.
  let sawDeath = false, sawRespawn = false;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(250);
    const d = await page.evaluate(() => window.BO.game.getDebugState());
    if (d.deaths > 0 && !sawDeath) {
      sawDeath = true;
      console.log(`  Tod Nr. ${d.deaths} in Raum ${d.room} (Zustand: ${d.state})`);
    }
    if (sawDeath && d.ninja && !d.ninja.dead && d.state === 'playing') {
      sawRespawn = true;
      console.log(`  -> wieder eingesetzt, Lauf läuft weiter (Raum ${d.room}, Zeit ${Math.round(d.timeLeft / 60)}s, Tode ${d.deaths})`);
      break;
    }
    if (d.state === 'gameover') { console.log(`  Lauf beendet: ${JSON.stringify(d)}`); break; }
  }
  console.log(`Tod gesehen: ${sawDeath}, Respawn gesehen: ${sawRespawn}`);
  await page.screenshot({ path: OUT + 'bo_loop3.png' });

  await browser.close();
  console.log('Fehler:', errors.length ? errors : 'keine');
})();
