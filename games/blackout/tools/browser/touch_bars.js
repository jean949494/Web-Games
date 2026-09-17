/**
 * Prüft, dass die Steuerzonen am BILDSCHIRM hängen und nicht an der Bühne.
 *
 * Dafür ein bewusst breites Fenster (900x360): Die Bühne ist 640x360, wird
 * also mittig mit je 130 px schwarzem Balken links und rechts eingepasst.
 * Genau dort liegen auf einem heutigen Handy im Querformat die Daumen.
 * Berührungen in den Balken MÜSSEN zählen.
 */
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const context = await browser.newContext({
    viewport: { width: 900, height: 360 }, hasTouch: true, isMobile: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto((process.env.BASE_URL || 'http://localhost:5173') + '/games/blackout/?debug', { waitUntil: 'load' });
  await page.waitForTimeout(300);
  await page.tap('#btn-start');
  await page.waitForTimeout(300);

  const box = await (await page.$('#stage')).boundingBox();
  console.log(`Bühne: x=${Math.round(box.x)} Breite=${Math.round(box.width)} ` +
              `-> Balken links 0..${Math.round(box.x)}, rechts ${Math.round(box.x + box.width)}..900`);

  const client = await page.context().newCDPSession(page);
  const touch = (type, points) => client.send('Input.dispatchTouchEvent', {
    type, touchPoints: points.map((p, i) => ({ x: p[0], y: p[1], id: i })),
  });
  const state = () => page.evaluate(() => window.BO.game.getDebugState());

  const Y = 300;
  let fails = 0;
  async function check(label, points, ms, test, expect) {
    await touch('touchStart', points);
    await page.waitForTimeout(ms);
    const d = await state();
    await touch('touchEnd', []);
    await page.waitForTimeout(350);
    const ok = test(d);
    if (!ok) fails++;
    console.log(`${ok ? 'OK  ' : 'FEHL'} ${label}: vx=${d.ninja.vx.toFixed(2)} vy=${d.ninja.vy.toFixed(2)} ` +
                `airborn=${d.ninja.airborn}  (erwartet ${expect})`);
  }

  // Erst nach rechts laufen: Der Start liegt links an der Wand, dort kann
  // die Figur gar nicht nach links - sonst misst der Test nur die Wand.
  await touch('touchStart', [[300, Y]]);
  await page.waitForTimeout(900);
  await touch('touchEnd', []);
  await page.waitForTimeout(400);

  // Ganz links im schwarzen Balken -> muss "links laufen" sein (< 25 % von 900)
  await check('Balken links (x=30)', [[30, Y]], 600, d => d.ninja.vx < -0.5, 'vx negativ');
  // Ganz rechts im schwarzen Balken -> rechte Hälfte = Sprung
  await check('Balken rechts (x=880)', [[880, Y]], 300, d => d.ninja.vy < 0 || d.ninja.airborn, 'Sprung');
  // Zweites Viertel (x=300) -> rechts laufen
  await check('zweites Viertel (x=300)', [[300, Y]], 600, d => d.ninja.vx > 0.5, 'vx positiv');
  // Beides zusammen: im linken Balken laufen und im rechten Balken springen
  await check('beide Balken gleichzeitig', [[30, Y], [880, Y]], 300,
    d => d.ninja.vx < -0.3 && d.ninja.airborn, 'vx negativ UND in der Luft');

  await browser.close();
  console.log(`\nFehlgeschlagen: ${fails}`);
  console.log('JS-Fehler:', errors.length ? errors : 'keine');
  process.exit(fails ? 1 : 0);
})();
