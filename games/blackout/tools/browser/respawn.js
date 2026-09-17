const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const page = await browser.newPage({ viewport: { width: 740, height: 420 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto((process.env.BASE_URL || 'http://localhost:5173') + '/games/blackout/?debug', { waitUntil: 'load' });
  await page.click('#btn-start');
  await page.waitForTimeout(250);

  // Erst ein paar Räume schaffen und Gold sammeln lassen
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.BO.game.debugWarp('switch'));
    await page.waitForTimeout(110);
    await page.evaluate(() => window.BO.game.debugWarp('door'));
    await page.waitForTimeout(150);
  }
  let st = await page.evaluate(() => window.BO.game.getDebugState());
  console.log(`Vor dem Tod: Raum ${st.room}, Zeit ${Math.round(st.timeLeft/60)}s, Tode ${st.deaths}`);

  // Gezielt sterben
  await page.evaluate(() => window.BO.game.debugKill());
  await page.waitForTimeout(120);
  st = await page.evaluate(() => window.BO.game.getDebugState());
  console.log(`Direkt nach dem Tod: Zustand ${st.state}, tot=${st.ninja && st.ninja.dead}, Tode ${st.deaths}, Zeit ${Math.round(st.timeLeft/60)}s`);

  // Respawn abwarten
  await page.waitForTimeout(900);
  st = await page.evaluate(() => window.BO.game.getDebugState());
  console.log(`Nach Wartezeit: Zustand ${st.state}, tot=${st.ninja && st.ninja.dead}, Raum ${st.room}, Schalter zurück: ${st.switchOn === false}`);
  console.log(st.state === 'playing' && st.ninja && !st.ninja.dead
    ? 'OK  - Tod beendet den Lauf NICHT, es geht im selben Raum weiter'
    : 'ABW - Respawn hat nicht funktioniert');

  await browser.close();
  console.log('Fehler:', errors.length ? errors : 'keine');
})();
