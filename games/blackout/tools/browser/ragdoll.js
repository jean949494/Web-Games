const { chromium } = require('playwright-core');
const path = require('path');
const OUT = path.join(__dirname, 'out') + path.sep;
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const page = await browser.newPage({ viewport: { width: 740, height: 420 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto((process.env.BASE_URL || 'http://localhost:5173') + '/games/blackout/?debug', { waitUntil: 'load' });
  await page.click('#btn-start');
  await page.waitForTimeout(250);
  // Mit Schwung sterben, damit die Puppe purzelt
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(800);
  await page.evaluate(() => window.BO.game.debugKill());
  await page.keyboard.up('ArrowRight');
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(110);
    await page.screenshot({ path: OUT + `ragdoll_${i}.png` });
  }
  const st = await page.evaluate(() => window.BO.game.getDebugState());
  console.log('Nach dem Tod:', st.state, '| Tode:', st.deaths);
  await page.waitForTimeout(800);
  const st2 = await page.evaluate(() => window.BO.game.getDebugState());
  console.log('Nach Respawn:', st2.state, '| tot:', st2.ninja.dead);
  await browser.close();
  console.log('Fehler:', errors.length ? errors : 'keine');
})();
