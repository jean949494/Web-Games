const fs=require('fs'), vm=require('vm');
const BASE='/home/user/poki/games/blackout/js/';
for (const f of ['constants.js','world.js','ninja.js']) vm.runInThisContext(fs.readFileSync(BASE+f,'utf8'),{filename:f});
const C=BO.constants;

// Rampe, die nach rechts ansteigt (T_SLOPE_BR), 6 Kacheln lang
const W=40,H=20;
const grid=[];
for(let y=0;y<H;y++){const row=[];for(let x=0;x<W;x++){row.push((x===0||y===0||x===W-1||y===H-1)?C.T_SOLID:C.T_EMPTY);}grid.push(row);}
const FLOOR=H-2;
for(let i=0;i<6;i++){
  const x=10+i, y=FLOOR-i;
  grid[y][x]=C.T_SLOPE_BR;
  for(let yy=y+1;yy<=FLOOR;yy++) grid[yy][x]=C.T_SOLID;
}
const world=new BO.World(grid);

console.log('Rampe steigt von x=10 bis x=15 um 6 Kacheln an.\n');

// 1. Bergauf laufen
{
  const n=new BO.Ninja(world, 5*C.TILE, FLOOR*C.TILE - C.RADIUS - 1);
  let maxHeight=0;
  const startY=n.ypos;
  for(let f=0;f<400;f++){ n.setInput(1,0); n.tick(); maxHeight=Math.max(maxHeight,startY-n.ypos); if(n.dead)break; }
  const tiles=maxHeight/C.TILE;
  console.log(`Bergauf laufen: ${tiles.toFixed(1)} Kacheln erklommen, Endposition x=${(n.xpos/C.TILE).toFixed(1)}, vx=${n.xspeed.toFixed(2)}`);
  console.log(`  ${tiles > 4 ? 'OK  - der Bergauf-Boost trägt' : 'ABW - bleibt an der Schräge hängen!'}`);
}

// 2. Bergab laufen: wird man schneller als auf flachem Boden?
{
  // Rampe andersherum: von x=15 nach x=10 abfallend, wir starten oben
  const n=new BO.Ninja(world, 16*C.TILE, (FLOOR-6)*C.TILE - C.RADIUS - 1);
  let maxVx=0;
  for(let f=0;f<300;f++){ n.setInput(-1,0); n.tick(); maxVx=Math.max(maxVx,Math.abs(n.xspeed)); if(n.dead)break; }
  console.log(`\nBergab laufen: max |vx| = ${maxVx.toFixed(3)} px/Frame`);
  console.log(`  (flaches Laufen erreicht maximal 3.33) -> ${maxVx > 3.35 ? 'OK  - Schrägen machen schneller als der Cap' : 'nur ' + maxVx.toFixed(2) + ', kein Extra-Schub'}`);
}

// 3. Sprung von der Schräge: wird sie zur Schanze?
{
  const flat=(()=>{ const n=new BO.Ninja(world, 5*C.TILE, FLOOR*C.TILE - C.RADIUS -1);
    for(let f=0;f<60;f++){n.setInput(1,0);n.tick();}
    const y0=n.ypos; let top=n.ypos;
    for(let f=0;f<200;f++){n.setInput(1,1);n.tick();top=Math.min(top,n.ypos);if(!n.airborn&&f>10)break;}
    return (y0-top)/C.TILE; })();
  console.log(`\nSprung von flachem Boden bei Tempo: ${flat.toFixed(2)} Kacheln hoch`);
}
