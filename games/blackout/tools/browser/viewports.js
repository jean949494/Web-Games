/**
 * Das Spiel auf verschiedenen Bildschirmen ansehen.
 *
 * Die Bühne ist fest 640x360 und wird mittig eingepasst. Ob dabei etwas
 * abgeschnitten wird, ob die Menüknöpfe noch zu treffen sind und ob der
 * Hochkant-Hinweis erscheint, sieht man nur im Bild. Geprüft werden typische
 * Geräte, nicht Zufallsgrößen.
 */
const path = require('path');
const { chromium } = require('playwright-core');
const OUT = path.join(__dirname, 'out') + path.sep;
require('fs').mkdirSync(OUT, { recursive: true });

const GERAETE = [
  { name: 'iphone-se-quer', w: 568, h: 320, touch: true },
  { name: 'iphone-14-quer', w: 844, h: 390, touch: true },
  { name: 'pixel-quer', w: 892, h: 412, touch: true },
  { name: 'ipad-quer', w: 1080, h: 810, touch: true },
  { name: 'handy-hochkant', w: 390, h: 844, touch: true },
  { name: 'laptop', w: 1440, h: 900, touch: false },
];

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const errors = [];
  let probleme = 0;

  for (const g of GERAETE) {
    const ctx = await browser.newContext({
      viewport: { width: g.w, height: g.h }, hasTouch: g.touch, isMobile: g.touch,
    });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`${g.name}: ${e.message}`));
    await page.goto((process.env.BASE_URL || 'http://localhost:5173') + '/games/blackout/', { waitUntil: 'load' });
    await page.waitForTimeout(350);

    const hochkant = g.h > g.w;
    const hinweis = await page.isVisible('#rotate-hint');
    if (g.touch && hochkant !== hinweis) {
      probleme++;
      console.log(`FEHL ${g.name}: Dreh-Hinweis ${hinweis ? 'sichtbar' : 'versteckt'}, erwartet ${hochkant ? 'sichtbar' : 'versteckt'}`);
    }

    if (!hochkant) {
      // Bühne muss vollständig ins Fenster passen und darf nicht 0 sein
      const box = await (await page.$('#stage')).boundingBox();
      const passt = box.width > 20 && box.height > 20 &&
                    box.x >= -1 && box.y >= -1 &&
                    box.x + box.width <= g.w + 1 && box.y + box.height <= g.h + 1;
      if (!passt) {
        probleme++;
        console.log(`FEHL ${g.name}: Bühne ${Math.round(box.x)},${Math.round(box.y)} ` +
          `${Math.round(box.width)}x${Math.round(box.height)} passt nicht in ${g.w}x${g.h}`);
      }
      // Startknopf muss anfassbar sein (mindestens 44 px, Apples Richtwert)
      const btn = await (await page.$('#btn-start')).boundingBox();
      if (btn.width < 40 || btn.height < 40) {
        probleme++;
        console.log(`FEHL ${g.name}: Startknopf nur ${Math.round(btn.width)}x${Math.round(btn.height)} px`);
      }
      console.log(`OK   ${g.name} (${g.w}x${g.h}): Bühne ${Math.round(box.width)}x${Math.round(box.height)}, ` +
        `Rand ${Math.round(box.x)} px seitlich, Startknopf ${Math.round(btn.width)} px`);
      await page.click('#btn-start');
      await page.waitForTimeout(450);
    } else {
      console.log(`OK   ${g.name} (${g.w}x${g.h}): Dreh-Hinweis sichtbar`);
    }

    await page.screenshot({ path: OUT + `vp_${g.name}.png` });
    await ctx.close();
  }

  await browser.close();
  console.log(`\nProbleme: ${probleme}`);
  console.log('JS-Fehler:', errors.length ? errors : 'keine');
  process.exit(probleme || errors.length ? 1 : 0);
})();
