/**
 * Fadenkreuz im Einsatz fotografieren.
 *
 * Das Fadenkreuz ist die eigentliche Information des Spiels: Solange es
 * hinterherhinkt, passiert nichts; rastet es ein, wird geschossen. Ob man
 * das auf einem Handy erkennt, sieht man nur im Bild.
 *
 * Vorgehen bewusst ohne Sonder-Schnittstelle: durch die Räume gehen, die
 * Figur stehen lassen und warten, bis irgendein Geschütz sie tatsächlich
 * sieht. Dann Bilder machen - beim Zielen (orange) und in der Vorwarnung
 * (rot), und wenn es so weit kommt, auch vom Schuss.
 */
const path = require('path');
const { chromium } = require('playwright-core');
const OUT = path.join(__dirname, 'out') + path.sep;
require('fs').mkdirSync(OUT, { recursive: true });

const state = page => page.evaluate(() => window.BO.game.getDebugState());

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const page = await browser.newPage({ viewport: { width: 740, height: 420 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto((process.env.BASE_URL || 'http://localhost:5173') + '/games/blackout/?debug', { waitUntil: 'load' });
  await page.click('#btn-start');
  await page.waitForTimeout(250);

  const seen = {};
  let shots = 0;

  for (let r = 0; r < 14 && shots < 3; r++) {
    let st = await state(page);
    if (st.turrets.length) {
      // Figur an den Schalter stellen - das ist die Stelle, an der man im
      // Spiel am ehesten stehen bleibt, und meist quer durch den Raum.
      await page.evaluate(() => window.BO.game.debugWarp('switch'));
      for (let p = 0; p < 40 && shots < 3; p++) {
        await page.waitForTimeout(100);
        const d = await state(page);
        if (d.ninja.dead) break;
        for (const t of d.turrets) {
          if (seen[t.phase] || (t.phase !== 'targeting' && t.phase !== 'prefire' && t.phase !== 'firing')) continue;
          seen[t.phase] = true;
          shots++;
          const dx = t.aimX - d.ninja.x, dy = t.aimY - d.ninja.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          console.log(`Raum ${d.room}: Phase ${t.phase}, Fadenkreuz ${(dist / 24).toFixed(1)} ` +
                      `Kacheln vom Spieler, Countdown ${t.timer}`);
          await page.screenshot({ path: OUT + `aim_${t.phase}.png` });
        }
      }
    }
    // Weiter in den nächsten Raum
    for (let t = 0; t < 20; t++) {
      await page.evaluate(() => window.BO.game.debugWarp('switch'));
      await page.waitForTimeout(60);
      if ((await state(page)).switchOn) break;
    }
    for (let t = 0; t < 20; t++) {
      await page.evaluate(() => window.BO.game.debugWarp('door'));
      await page.waitForTimeout(60);
      if ((await state(page)).room > st.room) break;
    }
    await page.waitForTimeout(150);
  }

  await browser.close();
  console.log(`Fotografierte Phasen: ${Object.keys(seen).join(', ') || 'keine'}`);
  console.log('Fehler:', errors.length ? errors : 'keine');
})();
