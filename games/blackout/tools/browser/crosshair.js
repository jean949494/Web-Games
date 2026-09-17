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
  await page.waitForTimeout(200);

  // So lange Räume überspringen, bis ein Geschütz Sicht auf den Schalter hat
  for (let attempt = 0; attempt < 25; attempt++) {
    await page.evaluate(() => window.BO.game.debugWarp('switch'));
    await page.waitForTimeout(700); // stehenbleiben -> Fadenkreuz rastet ein
    const info = await page.evaluate(() => {
      // Zustände der Geschütze auslesen
      const dbg = window.BO.game.getDebugState();
      return { room: dbg.room, hazards: dbg.hazards, state: dbg.state };
    });
    const shot = await page.screenshot({ path: OUT + 'bo_cross.png' });
    const phases = await page.evaluate(() => {
      const out = [];
      // ueber das Spielobjekt an die Gefahren kommen: ueber debugWarp ist der
      // Raum erreichbar, aber hazards sind privat - deshalb ueber den Zaehler
      return out;
    });
    if (info.state !== 'playing') {
      console.log('Zustand', info.state, 'in Raum', info.room, '- vermutlich vom Geschütz erwischt (gut!)');
      await page.screenshot({ path: OUT + 'bo_cross_death.png' });
      break;
    }
    if (info.hazards >= 3 && attempt > 3) {
      console.log('Raum', info.room, 'mit', info.hazards, 'Gefahren - Screenshot gemacht');
      break;
    }
    await page.evaluate(() => window.BO.game.debugWarp('door'));
    await page.waitForTimeout(140);
  }
  await browser.close();
  console.log('Fehler:', errors.length ? errors : 'keine');
})();
