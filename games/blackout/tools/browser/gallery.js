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

  // Durch die ersten Räume gehen und jeden fotografieren
  for (let r = 0; r < 9; r++) {
    await page.waitForTimeout(280);
    const st = await page.evaluate(() => window.BO.game.getDebugState());
    await page.screenshot({ path: OUT + `room_${r}.png` });
    console.log(`Raum ${st.room}: ${st.hazards} Gefahren, ${st.turrets.length} Geschütze, Zeit ${Math.round(st.timeLeft / 60)}s`);
    // Nicht blind warten: Der Schalter zählt erst, wenn ein Frame gelaufen
    // ist, und wie lange das dauert, hängt daran, wie oft der Generator für
    // den nächsten Raum neu würfeln musste. Feste Wartezeiten waren deshalb
    // flatterig - der Test hing dann im selben Raum fest.
    for (let t = 0; t < 20; t++) {
      await page.evaluate(() => window.BO.game.debugWarp('switch'));
      await page.waitForTimeout(60);
      if ((await page.evaluate(() => window.BO.game.getDebugState())).switchOn) break;
    }
    for (let t = 0; t < 20; t++) {
      await page.evaluate(() => window.BO.game.debugWarp('door'));
      await page.waitForTimeout(60);
      if ((await page.evaluate(() => window.BO.game.getDebugState())).room > st.room) break;
    }
  }
  await browser.close();
  console.log('Fehler:', errors.length ? errors : 'keine');
})();
