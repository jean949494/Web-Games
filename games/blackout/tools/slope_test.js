/**
 * Prüft die 45-Grad-Schrägen:
 *  - Rutscht der Ninja darauf ab, statt hängenzubleiben?
 *  - Wird Fallgeschwindigkeit in Laufgeschwindigkeit UMGELENKT (das ist der
 *    "Flow" von N), statt vernichtet zu werden?
 *  - Überlebt man auf einer Schräge einen Sturz, der auf flachem Boden tötet?
 *    (Die Aufprallschwelle hängt von der Steilheit ab: 6 - 4/3*|ny|)
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const BASE = path.join(__dirname, '..', 'js') + path.sep;
for (const f of ['constants.js', 'world.js', 'ninja.js']) {
  vm.runInThisContext(fs.readFileSync(BASE + f, 'utf8'), { filename: f });
}
const C = BO.constants;

function room(h, mutate) {
  const W = 26;
  const grid = [];
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < W; x++) {
      row.push((x === 0 || y === 0 || x === W - 1 || y === h - 1) ? C.T_SOLID : C.T_EMPTY);
    }
    grid.push(row);
  }
  if (mutate) mutate(grid);
  return new BO.World(grid);
}

console.log('--- 1. Rutscht der Ninja eine Schräge hinunter? ---');
{
  const H = 15;
  // Treppe aus Schrägen von links oben nach rechts unten
  const w = room(H, (g) => {
    for (let i = 0; i < 8; i++) {
      const x = 4 + i, y = 4 + i;
      g[y][x] = C.T_SLOPE_BR; // massiv unten rechts -> Hypotenuse fällt nach rechts
      for (let yy = y + 1; yy < H - 1; yy++) g[yy][x] = C.T_SOLID;
    }
  });
  const n = new BO.Ninja(w, 4 * C.TILE + 12, 3 * C.TILE);
  let maxVx = 0;
  for (let f = 0; f < 240; f++) {
    n.setInput(0, 0); // KEINE Eingabe - alles kommt aus der Schräge
    n.tick();
    maxVx = Math.max(maxVx, Math.abs(n.xspeed));
    if (n.dead) break;
  }
  console.log(`  Endposition x=${n.xpos.toFixed(0)} (Start 108), max. |vx| ohne Eingabe = ${maxVx.toFixed(2)} px/Frame`);
  const slid = Math.abs(n.xpos - 108) > 40;
  console.log(`  ${slid && maxVx > 0.5 ? 'OK  - Fallen wird in Seitwärtstempo umgelenkt (Richtung je nach Schrägentyp)' : 'ABW - der Ninja rutscht nicht'}`);
}

console.log('\n--- 2. Überlebt man auf einer Schräge einen tödlichen Sturz? ---');
{
  function fall(onSlope, heightTiles) {
    const H = heightTiles + 6;
    const w = room(H, (g) => {
      if (onSlope) {
        // EINE Schräge oben auf einer massiven Säule - so entsteht eine
        // echte schiefe Landefläche statt eines Sägezahnmusters.
        g[H - 2][12] = C.T_SLOPE_BR;
      }
    });
    const landY = (H - 2) * C.TILE;
    const n = new BO.Ninja(w, 12 * C.TILE, landY - heightTiles * C.TILE, { impactLimit: C.IMPACT_LIMIT_ORIGINAL });
    for (let f = 0; f < 600; f++) {
      n.setInput(0, 0);
      n.tick();
      if (n.dead) return false;
      if (!n.airborn && f > 3) return true;
    }
    return true;
  }
  for (const h of [9, 11, 13, 15]) {
    const flat = fall(false, h);
    const slope = fall(true, h);
    console.log(`  Sturz aus ${String(h).padStart(2)} Kacheln:  flach ${flat ? 'überlebt' : 'TOT    '}   Schräge ${slope ? 'überlebt' : 'TOT'}`);
  }
  console.log('  (Erwartung: auf der Schräge überlebt man mehr als auf flachem Boden)');
}

console.log('\n--- 3. Bleibt der Ninja auf einer Schräge irgendwo hängen? ---');
{
  const H = 15;
  const w = room(H, (g) => {
    g[H - 2][10] = C.T_SLOPE_BR;
    g[H - 2][11] = C.T_SLOPE_BL;
  });
  const n = new BO.Ninja(w, 5 * C.TILE, (H - 2) * C.TILE - C.RADIUS - 1);
  let stuckFrames = 0, lastX = n.xpos;
  for (let f = 0; f < 400; f++) {
    n.setInput(1, 0);
    n.tick();
    if (Math.abs(n.xpos - lastX) < 0.05) stuckFrames++; else stuckFrames = 0;
    lastX = n.xpos;
    if (stuckFrames > 40) break;
  }
  console.log(`  Endposition x=${n.xpos.toFixed(0)} nach 400 Frames Dauerlauf nach rechts`);
  console.log(`  ${n.xpos > 400 ? 'OK  - läuft über die Schrägen hinweg' : 'ABW - bleibt hängen bei x=' + n.xpos.toFixed(0)}`);
}
