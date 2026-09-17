/**
 * Die letzten Sekunden und das Ende eines Laufs.
 *
 * Zwei Dinge, die man leicht kaputtmacht, ohne es zu merken: der Ton, der
 * die letzten zehn Sekunden hörbar macht, und der Übergang ins Ende samt
 * Neustart. Beides passiert selten genug, dass es beim Testen durchrutscht.
 */
const { chromium } = require('playwright-core');

const state = page => page.evaluate(() => window.BO.game.getDebugState());

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const page = await browser.newPage({ viewport: { width: 740, height: 420 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto((process.env.BASE_URL || 'http://localhost:5173') + '/games/blackout/?debug', { waitUntil: 'load' });

  // Tonaufrufe mitzählen statt hören
  await page.evaluate(() => {
    window.__ticks = [];
    const orig = window.BO.sounds.playTick;
    window.BO.sounds.playTick = function (letzte) { window.__ticks.push(!!letzte); return orig(letzte); };
  });

  await page.click('#btn-start');
  await page.waitForTimeout(300);

  let probleme = 0;
  const pruefe = (ok, text) => { if (!ok) probleme++; console.log(`${ok ? 'OK  ' : 'FEHL'} ${text}`); };

  // Uhr auf 12 s stellen und zwölf Sekunden zusehen
  await page.evaluate(() => window.BO.game.debugSetTime(12 * 60));
  await page.waitForTimeout(13000);

  const ticks = await page.evaluate(() => window.__ticks);
  pruefe(ticks.length === 9,
    `neun Ticks in den letzten zehn Sekunden (gezählt: ${ticks.length})`);
  pruefe(ticks.filter(Boolean).length === 3,
    `davon drei hohe für die letzten drei Sekunden (gezählt: ${ticks.filter(Boolean).length})`);

  const d = await state(page);
  pruefe(d.state === 'gameover', `Lauf beendet, sobald die Uhr leer ist (Zustand: ${d.state})`);
  pruefe(await page.isVisible('#screen-gameover'), 'Abschluss-Bildschirm sichtbar');

  // Neustart
  await page.click('#btn-restart');
  await page.waitForTimeout(600);
  const n = await state(page);
  pruefe(n.state === 'playing' && n.room === 0 && n.deaths === 0,
    `Neustart beginnt sauber von vorn (Zustand ${n.state}, Raum ${n.room}, ` +
    `Uhr ${Math.round(n.timeLeft / 60)}s, Tode ${n.deaths})`);

  await browser.close();
  console.log(`\nProbleme: ${probleme}`);
  console.log('JS-Fehler:', errors.length ? errors : 'keine');
  process.exit(probleme || errors.length ? 1 : 0);
})();
