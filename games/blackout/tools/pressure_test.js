/**
 * Wie schnell wird Stehenbleiben tödlich? – Schwierigkeitskurve nachmessen.
 *
 * Die These des Spiels lautet: Bewegung schützt, Zögern tötet. Ob die
 * Schwierigkeitskurve das trägt, lässt sich messen, ohne einen Spieler zu
 * simulieren: Man setzt die Figur auf eine begehbare Kachel, drückt nichts,
 * und misst, wie lange sie lebt. Genau die Zeit hat man, um von Deckung zu
 * Deckung zu überlegen.
 *
 * Gemessen wird pro Raumnummer:
 *  - Anteil der Stellen, an denen Stehenbleiben binnen 10 s tötet
 *  - Median der Überlebenszeit an genau diesen Stellen
 *
 * Die Gefahren-Schleife ist identisch zu der in game.js (Reihum-Denken der
 * Geschütze inklusive) - sonst misst man etwas anderes als das Spiel.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const BASE = path.join(__dirname, '..', 'js') + path.sep;
for (const f of ['constants.js', 'world.js', 'ninja.js', 'hazards.js', 'level.js']) {
  vm.runInThisContext(fs.readFileSync(BASE + f, 'utf8'), { filename: f });
}
const C = BO.constants;

const MAX_FRAMES = 10 * 60;

function standable(grid) {
  const out = [];
  for (let y = 1; y < C.ROOM_H - 1; y++) {
    for (let x = 1; x < C.ROOM_W - 1; x++) {
      if (grid[y][x] === C.T_EMPTY && grid[y + 1][x] !== C.T_EMPTY) out.push({ x, y });
    }
  }
  return out;
}

/** {frames, cause} beim Stillstehen; cause === null heißt überlebt. */
function lingerFrames(room, tile) {
  const n = new BO.Ninja(room.world, tile.x * C.TILE + C.TILE / 2,
                         tile.y * C.TILE + C.TILE / 2, { impactLimit: C.IMPACT_LIMIT_MILD });
  let cursor = 0;
  for (let f = 1; f <= MAX_FRAMES; f++) {
    n.setInput(0, 0);
    n.tick();
    if (n.dead) return { frames: f, cause: n.deathReason || 'sturz' };
    if (room.turrets.length && f % BO.TURRET_CFG.THINK_INTERVAL === 0) {
      cursor = (cursor + 1) % room.turrets.length;
      room.turrets[cursor].think(n, f);
    }
    for (const h of room.hazards) {
      if (h.kind === 'turret') h.update(n, f); else h.update();
      if (h.hits(n)) return { frames: f, cause: h.kind };
    }
  }
  return { frames: MAX_FRAMES, cause: null };
}

const SEEDS = parseInt(process.argv[2] || '10', 10);
const ROOMS = parseInt(process.argv[3] || '20', 10);
const SAMPLES = 14; // Stellen pro Raum

console.log('Gemessen: Figur auf eine begehbare Kachel setzen, nichts drücken,');
console.log('Zeit bis zum Tod stoppen. Kacheln direkt an einer Mine sind');
console.log('ausgenommen - dort steht man nicht, die sieht man ja.\n');
console.log('Raum | beschossen | Median bis zum Schuss | Gefahren | Geschütze');
console.log('-----|------------|-----------------------|----------|----------');

for (let i = 0; i < ROOMS; i++) {
  let lethal = 0, total = 0, hazards = 0, turrets = 0;
  const times = [];
  for (let s = 0; s < SEEDS; s++) {
    const room = BO.level.generate(i, 4000 + s);
    room.turrets = room.hazards.filter(h => h.kind === 'turret');
    hazards += room.hazards.length;
    turrets += room.turrets.length;
    const mines = room.hazards.filter(h => h.kind === 'mine');
    const tiles = standable(room.grid).filter(t => {
      // Nicht auf oder neben einer Mine abtasten: Das misst nur, dass eine
      // Mine tötet, wenn man in sie hineinsteht - und verfälscht den Median
      // auf 0,0 s. Interessant ist der Druck aus der Ferne.
      const cx = t.x * C.TILE + C.TILE / 2, cy = t.y * C.TILE + C.TILE / 2;
      return !mines.some(m => Math.abs(m.x - cx) < C.TILE * 1.5 &&
                              Math.abs(m.y - cy) < C.TILE * 1.5);
    });
    // Gleichmäßig über den Raum verteilt abtasten statt zu würfeln,
    // damit die Zahlen zwischen zwei Läufen vergleichbar bleiben.
    for (let k = 0; k < SAMPLES && tiles.length; k++) {
      const t = tiles[Math.floor(k * tiles.length / SAMPLES)];
      const r = lingerFrames(room, t);
      total++;
      if (r.cause) { lethal++; times.push(r.frames / 60); }
    }
  }
  times.sort((a, b) => a - b);
  const med = times.length ? times[Math.floor(times.length / 2)].toFixed(1) + ' s' : '–';
  console.log(` ${String(i + 1).padStart(3)} | ${String((lethal / total * 100).toFixed(0) + ' %').padStart(10)} | ` +
    `${med.padStart(21)} | ${(hazards / SEEDS).toFixed(1).padStart(8)} | ${(turrets / SEEDS).toFixed(1).padStart(9)}`);
}
