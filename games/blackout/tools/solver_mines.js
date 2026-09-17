/**
 * Löser: Breitensuche über die ECHTE Physik.
 *
 * Statt zu raten, ob ein Raum machbar ist, wird er tatsächlich durchsucht.
 * Zustand = grob gerasterte Position und Geschwindigkeit, Aktionen = die
 * sechs möglichen Eingabekombinationen, jeweils ein paar Frames gehalten.
 * Findet die Suche einen Weg zum Schalter (und danach zur Tür), ist der
 * Raum garantiert lösbar - nicht nur laut Modell, sondern in der Praxis.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const BASE = path.join(__dirname, '..', 'js') + path.sep;
for (const f of ['constants.js', 'world.js', 'ninja.js', 'hazards.js', 'level.js']) {
  vm.runInThisContext(fs.readFileSync(BASE + f, 'utf8'), { filename: f });
}
const C = BO.constants;

const ACTIONS = [
  [0, 0], [-1, 0], [1, 0], [0, 1], [-1, 1], [1, 1],
];
const HOLD = 10;         // Frames pro Aktion (kürzer -> Zustände unterscheiden sich kaum)
const POS_Q = 4;         // Positionsraster für den Besucht-Schlüssel
const VEL_Q = 0.5;       // Geschwindigkeitsraster
const MAX_STATES = 250000;

function snapshot(n) {
  return {
    xpos: n.xpos, ypos: n.ypos, xspeed: n.xspeed, yspeed: n.yspeed,
    state: n.state, airborn: n.airborn, airbornOld: n.airbornOld, walled: n.walled,
    wallNormal: n.wallNormal, appliedGravity: n.appliedGravity,
    jumpInputOld: n.jumpInputOld, jumpDuration: n.jumpDuration,
    jumpBuffer: n.jumpBuffer, floorBuffer: n.floorBuffer, wallBuffer: n.wallBuffer,
    launchPadBuffer: n.launchPadBuffer, facing: n.facing,
    floorNormalizedX: n.floorNormalizedX, floorNormalizedY: n.floorNormalizedY,
  };
}

function restore(n, s) {
  Object.assign(n, s);
  n.dead = false;
  n.deathReason = null;
}

function keyOf(n) {
  return Math.round(n.xpos / POS_Q) + ',' + Math.round(n.ypos / POS_Q) + ',' +
         Math.round(n.xspeed / VEL_Q) + ',' + Math.round(n.yspeed / VEL_Q) + ',' +
         (n.airborn ? 'a' : '-') + (n.walled ? 'w' : '-');
}

/**
 * Strahlensuche: pro Runde werden alle Nachfolger erzeugt, aber nur die
 * BEAM besten (nach Abstand zum Ziel) weiterverfolgt. Findet sie einen Weg,
 * ist der Raum bewiesen lösbar. Findet sie keinen, heißt das "nicht
 * nachgewiesen" - nicht "unmöglich".
 */
const BEAM = 900;

function solve(room, startPos, target, impactLimit, mines) {
  mines = mines || [];
  const n = new BO.Ninja(room.world, startPos.x, startPos.y, { impactLimit: impactLimit });
  function hitsMine() {
    for (const m of mines) if (m.hits(n)) return true;
    return false;
  }
  const seen = new Set([keyOf(n)]);
  let frontier = [snapshot(n)];
  let bestDist = Infinity;

  for (let depth = 0; depth < 140 && frontier.length; depth++) {
    const next = [];
    for (const st of frontier) {
      for (const [hor, jump] of ACTIONS) {
        restore(n, st);
        let died = false;
        for (let f = 0; f < HOLD; f++) {
          n.setInput(hor, jump);
          n.tick();
          if (n.dead || hitsMine()) { died = true; break; }
        }
        if (died) continue;
        const dx = n.xpos - target.x, dy = n.ypos - target.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 300) return { ok: true, depth: depth };
        if (d2 < bestDist) bestDist = d2;
        const k = keyOf(n);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ st: snapshot(n), d: d2 });
      }
    }
    next.sort((a, b) => a.d - b.d);
    frontier = next.slice(0, BEAM).map(e => e.st);
  }
  return { ok: false, reason: 'nicht nachgewiesen', bestDist: Math.sqrt(bestDist).toFixed(0) };
}

const args = process.argv.slice(2);
const SEEDS = parseInt(args[0] || '8', 10);
const ROOMS = parseInt(args[1] || '6', 10);

let solvable = 0, unsolvable = 0;
const failures = [];
const t0 = Date.now();

const FIRST_ROOM = parseInt(process.argv[4] || '0', 10);
for (let s = 0; s < SEEDS; s++) {
  for (let i = FIRST_ROOM; i < FIRST_ROOM + ROOMS; i++) {
    const room = BO.level.generate(i, 9000 + s);
    const mines = room.hazards.filter(h => h.kind === 'mine');
    const r1 = solve(room, { x: room.spawn.x, y: room.spawn.y - 4 }, room.switchPos, C.IMPACT_LIMIT_MILD, mines);
    if (r1.ok) {
      solvable++;
    } else {
      unsolvable++;
      failures.push({ seed: 9000 + s, room: i, mines: mines.length, archetype: room.archetype, reason: r1.reason + ' (naechster Abstand ' + r1.bestDist + 'px)', spawn: room.spawn, sw: room.switchPos });
    }
  }
}

const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`Geprüft: ${solvable + unsolvable} Räume in ${secs}s`);
console.log(`  lösbar:        ${solvable} (${(solvable / (solvable + unsolvable) * 100).toFixed(1)} %)`);
console.log(`  NICHT lösbar:  ${unsolvable}`);
if (failures.length) {
  console.log('\nFehlschläge:');
  failures.slice(0, 12).forEach(f => {
    console.log(`  Seed ${f.seed} Raum ${f.room} (Archetyp ${f.archetype}, ${f.reason}) Start ${f.spawn.x},${f.spawn.y} -> Schalter ${f.sw.x},${f.sw.y}`);
  });
}
