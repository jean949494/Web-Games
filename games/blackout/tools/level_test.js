/**
 * Prüft den Raumgenerator über viele Räume und Seeds:
 * - stehen Start, Schalter und Tür im freien Raum (nicht in der Wand)?
 * - ist der Schalter nach dem konservativen Modell erreichbar?
 * - stecken Gefahren in Wänden?
 * - erreicht der Ninja den Schalter auch PHYSIKALISCH? (Stichprobe mit
 *   einem simplen Bot, der stur in Richtung Ziel läuft und springt)
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const BASE = path.join(__dirname, '..', 'js') + path.sep;
for (const f of ['constants.js', 'world.js', 'ninja.js', 'hazards.js', 'level.js']) {
  vm.runInThisContext(fs.readFileSync(BASE + f, 'utf8'), { filename: f });
}
const C = BO.constants;

function tileOf(px, py) { return { x: Math.floor(px / C.TILE), y: Math.floor(py / C.TILE) }; }

let problems = [];
let stats = { rooms: 0, archetypes: {}, hazards: 0, golds: 0,
              gold: { total: 0, reachable: 0, beispiele: [] } };

/** Kacheln, auf denen man stehen kann (leer, darunter massiv). */
function standable(g) {
  const out = [];
  for (let y = 1; y < C.ROOM_H - 1; y++) {
    for (let x = 1; x < C.ROOM_W - 1; x++) {
      if (g[y][x] === C.T_EMPTY && g[y + 1][x] !== C.T_EMPTY) out.push({ x, y });
    }
  }
  return out;
}

const ROOMS_PER_SEED = 12;
const SEEDS = 40;

for (let s = 0; s < SEEDS; s++) {
  for (let i = 0; i < ROOMS_PER_SEED; i++) {
    const room = BO.level.generate(i, 1000 + s);
    stats.rooms++;
    stats.archetypes[room.archetype] = (stats.archetypes[room.archetype] || 0) + 1;
    stats.hazards += room.hazards.length;
    stats.golds += room.golds.length;

    const g = room.grid;
    const check = (name, pos) => {
      const t = tileOf(pos.x, pos.y);
      if (!g[t.y] || g[t.y][t.x] === undefined) { problems.push(`Seed${s} R${i}: ${name} ausserhalb`); return; }
      if (g[t.y][t.x] !== C.T_EMPTY) problems.push(`Seed${s} R${i}: ${name} steckt in einer Wand`);
    };
    check('Start', room.spawn);
    check('Tuer', room.door);
    check('Schalter', room.switchPos);

    room.hazards.forEach((h, hi) => {
      const t = tileOf(h.x, h.y);
      if (g[t.y] && g[t.y][t.x] !== C.T_EMPTY && h.kind !== 'mine') {
        problems.push(`Seed${s} R${i}: ${h.kind} #${hi} steckt in einer Wand`);
      }
    });

    room.golds.forEach((gold) => {
      const t = tileOf(gold.x, gold.y);
      if (g[t.y] && g[t.y][t.x] !== C.T_EMPTY) problems.push(`Seed${s} R${i}: Gold in der Wand`);
    });

    // Erreichbarkeit des Goldes. Bewusst streng gerechnet: höchstens drei
    // Kacheln über einer begehbaren Kachel und höchstens drei zur Seite -
    // die Physik schafft mehr (3.09 hoch, über 15 weit), das hier ist also
    // die untere Schranke. Sichtbares Gold, das man nicht holen kann, sieht
    // nach einem Fehler aus und verzerrt die Zeitrechnung.
    const steh = standable(g);
    room.golds.forEach((gold) => {
      const t = tileOf(gold.x, gold.y);
      stats.gold.total++;
      const ok = steh.some(p => Math.abs(p.x - t.x) <= 3 && p.y - t.y >= 0 && p.y - t.y <= 3);
      if (ok) stats.gold.reachable++;
      else stats.gold.beispiele.length < 5 &&
        stats.gold.beispiele.push(`Seed${1000 + s} R${i} (${BO.level.ARCHETYPE_NAMES[room.archetype]}) bei ${t.x},${t.y}`);
    });
  }
}

console.log(`Räume erzeugt: ${stats.rooms}`);
console.log(`Archetypen: ${JSON.stringify(stats.archetypes)} (0=Plattformen, 1=Schacht, 2=Säulen)`);
console.log(`Gefahren gesamt: ${stats.hazards} (Ø ${(stats.hazards / stats.rooms).toFixed(1)}/Raum)`);
console.log(`Gold gesamt: ${stats.golds} (Ø ${(stats.golds / stats.rooms).toFixed(1)}/Raum)`);
const gq = stats.gold.reachable / stats.gold.total * 100;
console.log(`Gold in Reichweite: ${gq.toFixed(1)} % (${stats.gold.reachable}/${stats.gold.total}, ` +
  `streng gerechnet: max. 3 Kacheln hoch und 3 zur Seite)`);
stats.gold.beispiele.forEach(b => console.log(`  unerreichbar: ${b}`));

if (problems.length) {
  console.log(`\nPROBLEME: ${problems.length}`);
  problems.slice(0, 15).forEach(p => console.log('  - ' + p));
} else {
  console.log('\nKeine Struktur-Probleme.');
}

// --- Physikalische Stichprobe: schafft ein simpler Bot den Schalter? -----
// Der Bot läuft stur Richtung Schalter und springt, wenn er ansteht oder
// wenn das Ziel höher liegt. Das ist WEIT schlechter als ein Mensch spielt -
// wenn der Bot es oft schafft, ist der Raum sicher machbar.
function botReachesSwitch(room, maxFrames) {
  const n = new BO.Ninja(room.world, room.spawn.x, room.spawn.y - 4, { impactLimit: C.IMPACT_LIMIT_MILD });
  let lastX = n.xpos, stuck = 0;
  for (let f = 0; f < maxFrames; f++) {
    const dx = room.switchPos.x - n.xpos;
    const dy = room.switchPos.y - n.ypos;
    let hor = dx > 4 ? 1 : (dx < -4 ? -1 : 0);
    // springen: wenn Ziel höher, oder wenn wir festhängen, oder an der Wand
    let jump = 0;
    if (dy < -10 && !n.airborn) jump = 1;
    if (stuck > 10) jump = 1;
    if (n.walled && n.airborn) { jump = (f % 3 === 0) ? 1 : 0; hor = -n.wallNormal; }
    n.setInput(hor, jump);
    n.tick();
    if (n.dead) return 'tot';
    if (Math.abs(n.xpos - lastX) < 0.4) stuck++; else stuck = 0;
    lastX = n.xpos;
    const sdx = n.xpos - room.switchPos.x, sdy = n.ypos - room.switchPos.y;
    if (sdx * sdx + sdy * sdy < 300) return 'erreicht';
  }
  return 'timeout';
}

console.log('\nPhysik-Stichprobe (simpler Bot, 1200 Frames = 20 s pro Raum):');
const outcome = { erreicht: 0, timeout: 0, tot: 0 };
for (let s = 0; s < 12; s++) {
  for (let i = 0; i < 8; i++) {
    const room = BO.level.generate(i, 5000 + s);
    // Gefahren für diesen Test ignorieren - es geht nur um die Geometrie
    outcome[botReachesSwitch(room, 1200)]++;
  }
}
const total = outcome.erreicht + outcome.timeout + outcome.tot;
console.log(`  erreicht: ${outcome.erreicht}/${total} (${(outcome.erreicht / total * 100).toFixed(0)} %)`);
console.log(`  timeout:  ${outcome.timeout}`);
console.log(`  gestorben (Sturz): ${outcome.tot}`);
