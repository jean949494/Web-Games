/**
 * Kollisionsgeometrie prüfen: Liegt "außen" wirklich außen?
 *
 * Die Welt wird in orientierte Liniensegmente zerlegt; jede Kante weiß, auf
 * welcher Seite die Außenseite liegt. Bei allen vier Schrägen war diese
 * Wicklung einmal verkehrt herum, und weil die Katheten stimmten,
 * widersprachen sich die Segmente derselben Kachel. Im Spiel fiel das
 * monatelang nicht auf - erst als ein Schalter über einer einzeln stehenden
 * Schräge lag und die Figur in einem Bild 80 Pixel weit weggeschoben wurde.
 *
 * Dieser Test stellt jede Kachelform einzeln in einen leeren Raum und fragt
 * die Kollisionsabfrage an vielen Punkten. Verglichen wird mit der wahren
 * Geometrie, ausgerechnet ohne Segmente.
 *
 * Punkte nahe an einer Kante werden übersprungen: Dort ist "innen oder
 * außen" auch in der echten Physik eine Frage von Bruchteilen eines Pixels,
 * und die Antwort hängt an Rundung, nicht an der Wicklung.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const BASE = path.join(__dirname, '..', 'js') + path.sep;
for (const f of ['constants.js', 'world.js']) {
  vm.runInThisContext(fs.readFileSync(BASE + f, 'utf8'), { filename: f });
}
const C = BO.constants;
const T = C.TILE;

const CX = 5, CY = 5;                 // Prüfkachel, ringsum frei
const X0 = CX * T, Y0 = CY * T;
const RAND = 2.5;                     // Sicherheitsabstand zu jeder Kante

function leererRaum() {
  const g = [];
  for (let y = 0; y < C.ROOM_H; y++) {
    const r = [];
    for (let x = 0; x < C.ROOM_W; x++) {
      r.push((x === 0 || y === 0 || x === C.ROOM_W - 1 || y === C.ROOM_H - 1) ? C.T_SOLID : C.T_EMPTY);
    }
    g.push(r);
  }
  return g;
}

/** Wahre Geometrie: liegt (px,py) im massiven Teil der Prüfkachel? */
function istMassiv(type, px, py) {
  const u = px - X0, v = py - Y0;       // 0..T innerhalb der Kachel
  if (u < 0 || v < 0 || u > T || v > T) return false;
  if (type === C.T_SOLID) return true;
  if (type === C.T_SLOPE_BL) return v > u;        // unten links
  if (type === C.T_SLOPE_BR) return v > T - u;    // unten rechts
  if (type === C.T_SLOPE_TL) return v < T - u;    // oben links
  if (type === C.T_SLOPE_TR) return v < u;        // oben rechts
  return false;
}

/** Abstand zur nächsten Begrenzung der massiven Fläche. */
function randAbstand(type, px, py) {
  const u = px - X0, v = py - Y0;
  const kanten = [u, v, T - u, T - v];            // die vier Kachelkanten
  if (type === C.T_SLOPE_BL || type === C.T_SLOPE_TR) kanten.push(Math.abs(v - u) / Math.SQRT2);
  if (type === C.T_SLOPE_BR || type === C.T_SLOPE_TL) kanten.push(Math.abs(v - (T - u)) / Math.SQRT2);
  return Math.min.apply(null, kanten.map(Math.abs));
}

const FORMEN = [
  [C.T_SOLID, 'voller Block'],
  [C.T_SLOPE_BL, 'Schräge, massiv unten links'],
  [C.T_SLOPE_BR, 'Schräge, massiv unten rechts'],
  [C.T_SLOPE_TL, 'Schräge, massiv oben links'],
  [C.T_SLOPE_TR, 'Schräge, massiv oben rechts'],
];

let fehlerGesamt = 0;
console.log('Prüft für jede Kachelform, ob die Kollisionsabfrage "innen" und');
console.log('"außen" genauso sieht wie die echte Geometrie.\n');

for (const [type, name] of FORMEN) {
  const g = leererRaum();
  g[CY][CX] = type;
  const w = new BO.World(g);
  let geprueft = 0, falsch = 0;
  const beispiele = [];

  // Raster über die Kachel und einen Ring von einer Kachel drumherum
  for (let px = X0 - T; px <= X0 + 2 * T; px += 1.5) {
    for (let py = Y0 - T; py <= Y0 + 2 * T; py += 1.5) {
      const nahKante = randAbstand(type, px, py) < RAND;
      const imRing = px < X0 || py < Y0 || px > X0 + T || py > Y0 + T;
      if (nahKante && !imRing) continue;
      if (imRing && Math.min(Math.abs(px - X0), Math.abs(px - (X0 + T)),
                             Math.abs(py - Y0), Math.abs(py - (Y0 + T))) < RAND) continue;

      const cp = w.getSingleClosestPoint(px, py, 0.5);
      const sagtInnen = cp.result === -1;
      const istInnen = istMassiv(type, px, py);
      geprueft++;
      // Ein Punkt weit außerhalb hat oft gar kein Segment in Reichweite
      // (result === 0) - das ist kein Widerspruch, sondern "frei".
      if (istInnen !== sagtInnen && !(cp.result === 0 && !istInnen)) {
        falsch++;
        if (beispiele.length < 3) {
          beispiele.push(`(${px.toFixed(1)},${py.toFixed(1)}) echt ` +
            `${istInnen ? 'innen' : 'außen'}, Abfrage sagt ${sagtInnen ? 'innen' : 'außen'}`);
        }
      }
    }
  }

  fehlerGesamt += falsch;
  console.log(`${falsch === 0 ? 'OK  ' : 'FEHL'} ${name.padEnd(32)} ` +
    `${geprueft - falsch}/${geprueft} Punkte richtig`);
  beispiele.forEach(b => console.log(`       ${b}`));
}

console.log(fehlerGesamt === 0
  ? '\nAlle Kachelformen stimmen mit ihrer Kollisionsgeometrie überein.'
  : `\n${fehlerGesamt} widersprüchliche Punkte - die Wicklung stimmt irgendwo nicht.`);
process.exit(fehlerGesamt ? 1 : 0);
