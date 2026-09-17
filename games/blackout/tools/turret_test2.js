const fs = require('fs'), vm = require('vm');
const path = require('path');
const BASE = path.join(__dirname, '..', 'js') + path.sep;
for (const f of ['constants.js','world.js','ninja.js','hazards.js','level.js']) vm.runInThisContext(fs.readFileSync(BASE+f,'utf8'),{filename:f});
const C = BO.constants, T = BO.TURRET_CFG;

// Breiter Gang: 70 Kacheln, damit echtes Laufen möglich ist
function wideRoom(w, h) {
  const grid = [];
  for (let y=0;y<h;y++){const row=[];for(let x=0;x<w;x++){row.push((x===0||y===0||x===w-1||y===h-1)?C.T_SOLID:C.T_EMPTY);}grid.push(row);}
  return grid;
}

function run(label, opts) {
  const W = 70, H = 15;
  const grid = wideRoom(W, H);
  const world = new BO.World(grid);
  const turret = new BO.Turret(world, 35*C.TILE, 3*C.TILE);
  const floorTop = (H-1)*C.TILE;
  const n = new BO.Ninja(world, opts.startX*C.TILE, floorTop - C.RADIUS - 1, {impactLimit:C.IMPACT_LIMIT_MILD});
  let hit=null, shots=0, minCrosshair=9999;
  for (let f=0; f<60*15; f++){
    const inp = opts.input(f, n, W);
    n.setInput(inp.hor, inp.jump);
    n.tick();
    if (f % T.THINK_INTERVAL === 0) turret.think(n);
    const before = turret.phase;
    turret.update(n, f);
    if (before !== 'firing' && turret.phase === 'firing') shots++;
    if (turret.aimDist != null && turret.phase==='targeting') minCrosshair = Math.min(minCrosshair, turret.aimDist);
    if (turret.hits(n)) { hit = f; break; }
    if (n.dead) break;
  }
  console.log(`${label.padEnd(50)} ${hit===null?'ÜBERLEBT (15 s)':'getroffen nach '+(hit/60).toFixed(2)+' s'}  Schüsse:${shots}  min. Fadenkreuz-Abstand: ${minCrosshair===9999?'-':minCrosshair.toFixed(0)+'px'}`);
}

console.log('Gang 70 Kacheln breit, Geschütz mittig oben bei x=840.\n');

run('Stillstehen direkt darunter', { startX: 35, input: () => ({hor:0,jump:0}) });
run('Stillstehen 8 Kacheln daneben', { startX: 27, input: () => ({hor:0,jump:0}) });
run('Volles Tempo durchlaufen (einmal quer)', { startX: 3, input: (f,n,W) => ({hor: n.xpos < (W-4)*C.TILE ? 1 : 0, jump:0}) });
run('Weite Patrouille (je 20 Kacheln hin und her)', { startX: 15,
  input: (f,n) => {
    const left = 12*C.TILE, right = 58*C.TILE;
    if (!run._dir) run._dir = 1;
    if (n.xpos > right) run._dir = -1;
    if (n.xpos < left) run._dir = 1;
    return {hor: run._dir, jump:0};
  }});
console.log('\nErwartung laut Originalcode: Stillstehen tödlich, echtes Durchlaufen überlebbar,');
console.log('weil das Fadenkreuz in der äußeren Zone (>96px) bleibt und der Countdown dort nicht tickt.');
