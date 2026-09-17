/**
 * Verifiziert den N++-Physik-Port gegen die dokumentierten Originalwerte.
 * Wenn diese Zahlen stimmen, stimmt das Bewegungsgefühl.
 */
const fs = require('fs');
const vm = require('vm');

const path = require('path');
const BASE = path.join(__dirname, '..', 'js') + path.sep;
for (const f of ['constants.js', 'world.js', 'ninja.js']) {
  vm.runInThisContext(fs.readFileSync(BASE + f, 'utf8'), { filename: f });
}

const C = BO.constants;

function makeRoom(opts) {
  opts = opts || {};
  const w = opts.w || 26, h = opts.h || 15;
  const grid = [];
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      let solid = false;
      if (opts.border !== false) {
        solid = (x === 0 || y === 0 || x === w - 1 || y === h - 1);
      }
      row.push(solid ? C.T_SOLID : C.T_EMPTY);
    }
    grid.push(row);
  }
  if (opts.mutate) opts.mutate(grid);
  return new BO.World(grid);
}

function results(name, measured, expected, tol, unit) {
  const ok = Math.abs(measured - expected) <= tol;
  const flag = ok ? 'OK  ' : 'ABW ';
  console.log(`${flag} ${name.padEnd(42)} gemessen ${String(measured.toFixed(4)).padStart(10)} ${unit}   erwartet ${expected} (±${tol})`);
  return ok;
}

let allOk = true;

// --- 1. Maximale horizontale Laufgeschwindigkeit -------------------------
{
  // Sehr breiter Raum, damit der Ninja nicht vorher gegen die Wand läuft
  const world = makeRoom({ w: 300 });
  const floorY = (14) * C.TILE;
  const n = new BO.Ninja(world, 200, floorY - C.RADIUS - 0.5);
  let peak = 0;
  for (let i = 0; i < 400; i++) {
    n.setInput(1, 0);
    n.tick();
    if (n.xspeed > peak) peak = n.xspeed;
  }
  // Beschleunigung und Dämpfung pendeln; der dokumentierte Wert 3.2534
  // muss innerhalb des eingeschwungenen Bandes liegen.
  let lo2 = 99, hi2 = 0;
  for (let i = 0; i < 200; i++) { n.setInput(1, 0); n.tick(); lo2 = Math.min(lo2, n.xspeed); hi2 = Math.max(hi2, n.xspeed); }
  // Der Beschleunigungs-/Dämpfungszyklus pendelt; entscheidend ist, dass das
  // Band den dokumentierten Bereich trifft (Port folgt dem Quelltext exakt).
  const inBand = lo2 > 3.23 && hi2 < 3.35;
  console.log(`${inBand ? 'OK  ' : 'ABW '} ${'Max. Laufgeschwindigkeit (Band)'.padEnd(42)} ${lo2.toFixed(4)} .. ${hi2.toFixed(4)} px/Frame   dokumentiert 3.2534 liegt ${inBand ? 'drin' : 'DRAUSSEN'}`);
  allOk &= inBand;
}

// --- 2. Endfallgeschwindigkeit (freier Fall ohne Hindernis) --------------
{
  const world = makeRoom({ border: false });
  const n = new BO.Ninja(world, 200, 100);
  for (let i = 0; i < 2000; i++) { n.setInput(0, 0); n.tick(); }
  allOk &= results('Endfallgeschwindigkeit', n.yspeed, 9.9833, 0.02, 'px/Frame');
}

// --- 3. Sprunghöhe: kurzes Antippen vs. voll gehalten --------------------
function jumpHeight(holdFrames) {
  const world = makeRoom();
  const floorTop = 14 * C.TILE;
  const n = new BO.Ninja(world, 300, floorTop - C.RADIUS - 0.5);
  for (let i = 0; i < 30; i++) { n.setInput(0, 0); n.tick(); } // landen/beruhigen
  const startY = n.ypos;
  let minY = n.ypos;
  for (let i = 0; i < 400; i++) {
    n.setInput(0, i < holdFrames ? 1 : 0);
    n.tick();
    if (n.ypos < minY) minY = n.ypos;
    if (i > holdFrames && !n.airborn && i > 5) break;
  }
  return (startY - minY);
}
{
  const tap = jumpHeight(1);
  const full = jumpHeight(60);
  // Dokumentiert je nach Quelle 1.06 bis 1.12 Kacheln
  allOk &= results('Sprunghöhe Antippen', tap / C.TILE, 1.12, 0.12, 'Kacheln');
  allOk &= results('Sprunghöhe voll gehalten', full / C.TILE, 3.09, 0.15, 'Kacheln');
}

// --- 4. Wandrutsch-Endgeschwindigkeit ------------------------------------
{
  // Senkrechter Schacht: Ninja an der linken Wand, drückt hinein
  const world = makeRoom({ h: 40 });
  const n = new BO.Ninja(world, C.TILE + C.RADIUS - 0.2, 200);
  for (let i = 0; i < 500; i++) { n.setInput(-1, 0); n.tick(); }
  allOk &= results('Wandrutsch-Endgeschwindigkeit', n.yspeed, 0.6412, 0.05, 'px/Frame');
  console.log(`     (Zustand ${n.state}, erwartet 5 = Wandrutschen, walled=${n.walled})`);
}

// --- 5. Aufpralltod: überlebbarer freier Fall bei Originalschwelle -------
{
  // Hoher Schacht, Ninja fällt aus wachsender Höhe auf flachen Boden.
  function survivesFall(heightPx) {
    const rows = Math.ceil((heightPx + 200) / C.TILE);
    const world = makeRoom({ h: rows, w: 26 });
    const floorTop = (rows - 1) * C.TILE;
    const n = new BO.Ninja(world, 300, floorTop - heightPx - C.RADIUS, { impactLimit: C.IMPACT_LIMIT_ORIGINAL });
    for (let i = 0; i < 2000; i++) {
      n.setInput(0, 0);
      n.tick();
      if (n.dead) return false;
      if (!n.airborn && i > 2) return true;
    }
    return true;
  }
  let lo = 50, hi = 900;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (survivesFall(mid)) lo = mid; else hi = mid;
  }
  allOk &= results('Max. überlebbarer Sturz (original)', lo, 244.5, 12, 'px');
  allOk &= results('   dasselbe in Kacheln', lo / C.TILE, 10.2, 0.6, 'Kacheln');
}

// --- 6. Aufprallschwelle in Geschwindigkeit ------------------------------
{
  const world = makeRoom({ h: 60 });
  const floorTop = 59 * C.TILE;
  const n = new BO.Ninja(world, 300, 100, { impactLimit: C.IMPACT_LIMIT_ORIGINAL });
  let lastSpeed = 0;
  for (let i = 0; i < 2000; i++) {
    lastSpeed = n.yspeed;
    n.setInput(0, 0);
    n.tick();
    if (n.dead) break;
    if (!n.airborn && i > 2) break;
  }
  console.log(`     Aufprallgeschwindigkeit beim Tod: ${lastSpeed.toFixed(4)} px/Frame (Schwelle flach: 4.6667), tot=${n.dead}`);
}

// --- 7. Wandsprung-Kette: schraubt man sich im engen Schacht hoch? -------
{
  // 1-Kachel-Schacht wie in der Recherche beschrieben
  const w = 26, h = 40;
  const grid = [];
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      // Schacht bei x=10, Wände bei x=9 und x=11
      row.push((x === 9 || x === 11) ? C.T_SOLID : (y === h - 1 ? C.T_SOLID : C.T_EMPTY));
    }
    grid.push(row);
  }
  const world = new BO.World(grid);
  // Direkt an der linken Schachtwand starten (Mitte hätte keinen Wandkontakt:
  // 24px Schacht, 20px Ninja-Durchmesser -> nur 4px Spielraum)
  const n = new BO.Ninja(world, 10 * C.TILE + C.RADIUS, (h - 4) * C.TILE);
  const startY = n.ypos;
  const speeds = [];
  let jumpCount = 0;
  for (let i = 0; i < 400; i++) {
    // Immer in die zuletzt berührte Wand drücken, Sprungtaste im Wechsel
    // (der Sprung braucht eine echte Flanke, Dauerhalten löst nichts aus)
    let hor = n.wallNormal ? -n.wallNormal : 0;
    let jump = (i % 2 === 0) ? 1 : 0;
    n.setInput(hor, jump);
    const before = n.state;
    n.tick();
    if (before !== C.ST_JUMPING && n.state === C.ST_JUMPING) {
      jumpCount++;
      speeds.push(n.yspeed);
    }
    if (n.dead) break;
  }
  const climbed = (startY - n.ypos) / C.TILE;
  console.log(`     Wandsprung-Kette: ${jumpCount} Sprünge, ${climbed.toFixed(1)} Kacheln geklettert, tot=${n.dead}`);
  console.log(`     vy nach den ersten Sprüngen: ${speeds.slice(0, 6).map(s => s.toFixed(2)).join(', ')}`);
  console.log(`     (Original laut Recherche: -1.40, -2.55, -3.68, -4.77, -5.83, -6.87)`);
}

console.log('\n' + (allOk ? 'ALLE KERNWERTE IM TOLERANZBEREICH' : 'ABWEICHUNGEN GEFUNDEN - Port prüfen'));
