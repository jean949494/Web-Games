/**
 * Zeit-Haushalt über einen ganzen Lauf nachrechnen.
 *
 * Die Zahlen für Startzeit und Zeitgutschrift pro Raum waren bisher geraten.
 * Hier wird stattdessen gemessen: Die Strahlensuche spielt jeden Raum
 * tatsächlich durch - erst zum Schalter, dann zurück zur Tür - und die
 * gebrauchten Frames werden gegen die Gutschrift gerechnet.
 *
 * Was das NICHT ist: eine Vorhersage für Menschen. Die Suche sucht den
 * kürzesten Weg, den sie findet, nicht den schnellsten, und sie weicht
 * Gefahren nur aus, indem sie an ihnen stirbt und den Ast verwirft. Ein
 * Anfänger braucht deutlich länger, ein Könner weniger. Als Maßstab dafür,
 * ob die Uhr überhaupt in der richtigen Größenordnung liegt, reicht es.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const BASE = path.join(__dirname, '..', 'js') + path.sep;
for (const f of ['constants.js', 'world.js', 'ninja.js', 'hazards.js', 'level.js']) {
  vm.runInThisContext(fs.readFileSync(BASE + f, 'utf8'), { filename: f });
}
const C = BO.constants;

const ACTIONS = [[0, 0], [-1, 0], [1, 0], [0, 1], [-1, 1], [1, 1]];
const HOLD = 10;
// Breiter Strahl, weil hier ZWEI Wege am Stück gesucht werden und der zweite
// aus einem beliebigen Zustand startet. Mit 500 meldete die Suche fünf Räume
// als unlösbar; vier davon fand sie mit 2500 problemlos - es lag also an der
// Suche, nicht am Raum. Der fünfte war ein echter Baufehler: eine Rampe, die
// unter einer Platte endete (siehe README des Spiels).
const POS_Q = 4, VEL_Q = 0.5, BEAM = 1500;

const FIELDS = ['xpos', 'ypos', 'xspeed', 'yspeed', 'state', 'airborn', 'airbornOld',
  'walled', 'wallNormal', 'appliedGravity', 'jumpInputOld', 'jumpDuration', 'jumpBuffer',
  'floorBuffer', 'wallBuffer', 'launchPadBuffer', 'facing', 'floorNormalizedX', 'floorNormalizedY'];
const snap = n => { const o = {}; for (const k of FIELDS) o[k] = n[k]; return o; };
const restore = (n, s) => { Object.assign(n, s); n.dead = false; n.deathReason = null; };
const keyOf = n => Math.round(n.xpos / POS_Q) + ',' + Math.round(n.ypos / POS_Q) + ',' +
  Math.round(n.xspeed / VEL_Q) + ',' + Math.round(n.yspeed / VEL_Q) +
  (n.airborn ? 'a' : '-') + (n.walled ? 'w' : '-');

/** Sucht einen Weg und liefert {frames, endState} oder null. */
function leg(world, startState, startPos, target, mines) {
  const n = new BO.Ninja(world, startPos.x, startPos.y, { impactLimit: C.IMPACT_LIMIT_MILD });
  if (startState) restore(n, startState);
  const seen = new Set([keyOf(n)]);
  let frontier = [{ st: snap(n), steps: 0 }];
  for (let depth = 0; depth < 160 && frontier.length; depth++) {
    const next = [];
    for (const cur of frontier) {
      for (const [hor, jump] of ACTIONS) {
        restore(n, cur.st);
        let died = false;
        for (let f = 0; f < HOLD; f++) {
          n.setInput(hor, jump);
          n.tick();
          if (n.dead || mines.some(m => m.hits(n))) { died = true; break; }
        }
        if (died) continue;
        const dx = n.xpos - target.x, dy = n.ypos - target.y;
        const d2 = dx * dx + dy * dy;
        const st = snap(n);
        if (d2 < 300) return { frames: (cur.steps + 1) * HOLD, endState: st };
        const k = keyOf(n);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ st: st, steps: cur.steps + 1, d: d2 });
      }
    }
    next.sort((a, b) => a.d - b.d);
    frontier = next.slice(0, BEAM);
  }
  return null;
}

const SEEDS = parseInt(process.argv[2] || '6', 10);
const ROOMS = parseInt(process.argv[3] || '12', 10);
const misses = [];

const TIME_PER_ROOM = 10 * 60;
const TIME_START = 45 * 60;
const TIME_PER_GOLD = 2 * 60;
const TIME_MAX = 99 * 60;

const perRoom = [];
let ended = [];

for (let s = 0; s < SEEDS; s++) {
  let clock = TIME_START;
  let room = 0;
  for (; room < ROOMS; room++) {
    const r = BO.level.generate(room, 7000 + s);
    const mines = r.hazards.filter(h => h.kind === 'mine');
    const toSwitch = leg(r.world, null, { x: r.spawn.x, y: r.spawn.y - 4 }, r.switchPos, mines);
    if (!toSwitch) {
      perRoom.push({ room, frames: null });
      misses.push({ seed: 7000 + s, room, arch: r.archetype, leg: 'Hinweg' });
      continue;
    }
    // Position ist egal, der gespeicherte Zustand überschreibt sie sofort.
    const back = leg(r.world, toSwitch.endState, r.spawn, r.door, mines);
    if (!back) {
      perRoom.push({ room, frames: null });
      misses.push({ seed: 7000 + s, room, arch: r.archetype, leg: 'Rückweg',
                    hoehe: BO.level.FLOOR_Y - r.switchTile.y });
      continue;
    }
    const frames = toSwitch.frames + back.frames;
    perRoom.push({ room, frames });
    clock -= frames;
    if (clock <= 0) break;
    // Gold wird nur eingesammelt, wenn es am Weg liegt - hier vorsichtig
    // mit einem Drittel angesetzt statt mit allem.
    clock = Math.min(TIME_MAX, clock + TIME_PER_ROOM + Math.floor(r.golds.length / 3) * TIME_PER_GOLD);
  }
  ended.push({ seed: 7000 + s, room, clock: Math.max(0, clock) });
}

const ok = perRoom.filter(p => p.frames != null);
const secs = ok.map(p => p.frames / 60).sort((a, b) => a - b);
const med = secs[Math.floor(secs.length / 2)];
console.log(`Räume durchgespielt: ${ok.length} von ${perRoom.length}` +
  (ok.length < perRoom.length ? `  (${perRoom.length - ok.length} ohne gefundenen Weg)` : ''));
console.log(`Sekunden pro Raum (Hin- und Rückweg):`);
console.log(`  Median ${med.toFixed(1)}s   schnellster ${secs[0].toFixed(1)}s   ` +
  `langsamster ${secs[secs.length - 1].toFixed(1)}s`);
console.log(`  90 % schaffen es in ${secs[Math.floor(secs.length * 0.9)].toFixed(1)}s`);
console.log(`\nGutschrift pro Raum: ${TIME_PER_ROOM / 60}s  ->  Bilanz im Median ` +
  `${(TIME_PER_ROOM / 60 - med).toFixed(1)}s pro Raum`);

// Entwicklung über die Raumnummer: werden späte Räume länger?
const byIdx = {};
ok.forEach(p => { (byIdx[p.room] = byIdx[p.room] || []).push(p.frames / 60); });
console.log('\nZeitbedarf nach Raumnummer:');
Object.keys(byIdx).map(Number).sort((a, b) => a - b).forEach(k => {
  const v = byIdx[k];
  const avg = v.reduce((a, b) => a + b, 0) / v.length;
  console.log(`  Raum ${String(k).padStart(2)}: Ø ${avg.toFixed(1)}s  (n=${v.length})`);
});

if (misses.length) {
  console.log('\nOhne gefundenen Weg:');
  misses.forEach(m => console.log(`  Seed ${m.seed} Raum ${m.room} ` +
    `(${BO.level.ARCHETYPE_NAMES[m.arch]}, ${m.leg}` +
    (m.hoehe != null ? `, Schalter ${m.hoehe} Kacheln hoch` : '') + ')'));
}

console.log('\nLäufe:');
ended.forEach(e => console.log(`  Seed ${e.seed}: bis Raum ${e.room}, Restzeit ${(e.clock / 60).toFixed(0)}s`));
