/**
 * Prüft die Kernaussage des Gauss-Geschützes aus dem Originalcode:
 *   - Wer stehenbleibt, stirbt nach ca. 0,4-1 s.
 *   - Wer sich bewegt, hält das Fadenkreuz auf Abstand und wird NIE getroffen.
 *   - Wer die Sichtlinie bricht, setzt das Geschütz komplett zurück.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const BASE = path.join(__dirname, '..', 'js') + path.sep;
for (const f of ['constants.js', 'world.js', 'ninja.js', 'hazards.js', 'level.js']) {
  vm.runInThisContext(fs.readFileSync(BASE + f, 'utf8'), { filename: f });
}
const C = BO.constants;
const T = BO.TURRET_CFG;

// Offener Raum mit Boden
function openRoom() {
  const grid = [];
  for (let y = 0; y < C.ROOM_H; y++) {
    const row = [];
    for (let x = 0; x < C.ROOM_W; x++) {
      row.push((x === 0 || y === 0 || x === C.ROOM_W - 1 || y === C.ROOM_H - 1) ? C.T_SOLID : C.T_EMPTY);
    }
    grid.push(row);
  }
  return grid;
}

function run(label, opts) {
  const grid = openRoom();
  if (opts.cover) {
    // Eine Säule als Deckung in der Mitte
    for (let y = 6; y < C.ROOM_H - 1; y++) grid[y][13] = C.T_SOLID;
  }
  const world = new BO.World(grid);
  const turret = new BO.Turret(world, 21 * C.TILE, 11 * C.TILE);
  const floorTop = (C.ROOM_H - 1) * C.TILE;
  const n = new BO.Ninja(world, opts.startX, floorTop - C.RADIUS - 1, { impactLimit: C.IMPACT_LIMIT_MILD });

  let frame = 0, firedCount = 0, firstDeathFrame = null;
  for (; frame < 60 * 12; frame++) {
    const input = opts.input(frame, n);
    n.setInput(input.hor, input.jump);
    n.tick();

    // Wie im Spiel: das Geschütz denkt nur alle THINK_INTERVAL Frames
    if (frame % T.THINK_INTERVAL === 0) turret.think(n);
    const before = turret.phase;
    turret.update(n, frame);
    if (before !== 'firing' && turret.phase === 'firing') firedCount++;

    if (turret.hits(n)) {
      if (firstDeathFrame === null) firstDeathFrame = frame;
      break;
    }
    if (n.dead) break;
  }

  const secs = firstDeathFrame === null ? null : (firstDeathFrame / 60).toFixed(2);
  console.log(`${label.padEnd(46)} ${firstDeathFrame === null ? 'ÜBERLEBT nach 12 s' : 'getroffen nach ' + secs + ' s'}   (Schüsse: ${firedCount})`);
  return firstDeathFrame;
}

console.log('Geschütz sitzt bei x=504, Ninja startet am Boden.\n');

// 1. Stillstehen in Sichtweite -> sollte sterben
run('Stillstehen (10 Kacheln entfernt)', {
  startX: 11 * C.TILE, cover: false,
  input: () => ({ hor: 0, jump: 0 }),
});

// 2. Stillstehen ganz nah -> sollte schneller sterben
run('Stillstehen (4 Kacheln entfernt)', {
  startX: 17 * C.TILE, cover: false,
  input: () => ({ hor: 0, jump: 0 }),
});

// 3. Dauerhaft hin- und herlaufen -> sollte überleben
run('Ständig hin und her laufen', {
  startX: 11 * C.TILE, cover: false,
  input: (f) => ({ hor: Math.floor(f / 45) % 2 === 0 ? 1 : -1, jump: 0 }),
});

// 4. Einmal quer durchlaufen -> sollte durchkommen
run('Einmal quer am Geschütz vorbeilaufen', {
  startX: 3 * C.TILE, cover: false,
  input: () => ({ hor: 1, jump: 0 }),
});

// 5. Hinter Deckung stehen -> darf nie getroffen werden
run('Stillstehen HINTER einer Säule', {
  startX: 8 * C.TILE, cover: true,
  input: () => ({ hor: 0, jump: 0 }),
});

console.log('\nErwartung: 1 und 2 sterben (2 schneller), 3, 4 und 5 überleben.');
