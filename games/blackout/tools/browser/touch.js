const { chromium } = require('playwright-core');
const path = require('path');
const OUT = path.join(__dirname, 'out') + path.sep;
require('fs').mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const context = await browser.newContext({
    viewport: { width: 740, height: 420 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto((process.env.BASE_URL || 'http://localhost:5173') + '/games/blackout/?debug', { waitUntil: 'load' });
  await page.waitForTimeout(300);
  await page.tap('#btn-start');
  await page.waitForTimeout(300);

  const box = await (await page.$('#stage')).boundingBox();
  const Y = box.y + box.height * 0.75;
  const xLeftZone = box.x + box.width * 0.10;   // links laufen
  const xRightZone = box.x + box.width * 0.36;  // rechts laufen
  const xJump = box.x + box.width * 0.75;       // springen

  // Zwei Finger gleichzeitig: rechts laufen UND springen
  const client = await page.context().newCDPSession(page);
  async function touch(type, points) {
    await client.send('Input.dispatchTouchEvent', {
      type: type,
      touchPoints: points.map((p, i) => ({ x: p[0], y: p[1], id: i })),
    });
  }

  console.log('--- Test 1: nur rechts laufen ---');
  await touch('touchStart', [[xRightZone, Y]]);
  await page.waitForTimeout(700);
  let d = await page.evaluate(() => window.BO.game.getDebugState());
  console.log('vx =', d.ninja.vx, '(erwartet: positiv)');
  await touch('touchEnd', []);

  await page.waitForTimeout(400);

  console.log('--- Test 2: rechts laufen + springen gleichzeitig ---');
  await touch('touchStart', [[xRightZone, Y], [xJump, Y]]);
  await page.waitForTimeout(420);
  d = await page.evaluate(() => window.BO.game.getDebugState());
  console.log('vx =', d.ninja.vx, ', vy =', d.ninja.vy, ', airborn =', d.ninja.airborn, '(erwartet: vx positiv, vy negativ, in der Luft)');
  await page.screenshot({ path: OUT + 'bo_touch.png' });
  await touch('touchEnd', []);

  await page.waitForTimeout(500);
  console.log('--- Test 3: links laufen ---');
  await touch('touchStart', [[xLeftZone, Y]]);
  await page.waitForTimeout(600);
  d = await page.evaluate(() => window.BO.game.getDebugState());
  console.log('vx =', d.ninja.vx, '(erwartet: negativ)');
  await touch('touchEnd', []);

  // Joystick-Variante
  console.log('--- Test 4: Joystick-Schema ---');
  await page.evaluate(() => window.BO.game.setScheme('stick'));
  await page.waitForTimeout(150);
  const originX = box.x + box.width * 0.2;
  await touch('touchStart', [[originX, Y]]);
  await touch('touchMove', [[originX + 40, Y]]);
  await page.waitForTimeout(600);
  d = await page.evaluate(() => window.BO.game.getDebugState());
  console.log('Stick nach rechts gezogen: vx =', d.ninja.vx, '(erwartet: positiv)');
  await touch('touchEnd', []);

  await browser.close();
  console.log('\nFehler:', errors.length ? errors : 'keine');
})();
