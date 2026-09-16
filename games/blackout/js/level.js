/**
 * Blackout – Raumgenerator.
 *
 * Ein Raum = ein Bildschirm (kein Scrollen), genau wie im Original: Man sieht
 * alle Gefahren auf einen Blick und kann seine Route planen, bevor man losläuft.
 * Das ist auf dem Handy auch der einzige Weg, Sichtlinien fair zu halten.
 *
 * Endlos wird daraus durch Aneinanderreihen: Schalter drücken -> Tür öffnet
 * -> durch die Tür -> nächster Raum, Uhr läuft weiter.
 *
 * LÖSBARKEIT: Bei dieser Physik wäre ein unschaffbarer Raum ein sofortiger
 * Spielabbruch. Deshalb wird nicht frei gewürfelt, sondern konstruktiv gebaut
 * und anschließend mit einem konservativen Erreichbarkeitsmodell geprüft
 * (Sprungreichweite absichtlich kleiner angesetzt als physikalisch möglich).
 * Fällt die Prüfung durch, wird neu gewürfelt; als letzte Rückfallebene gibt
 * es einen Raum, dessen Schalter direkt auf dem Boden steht.
 */
(function (global) {
  'use strict';

  var BO = global.BO = global.BO || {};
  var C = BO.constants;

  // Konservative Reichweiten (echte Physik schafft mehr: 3.09 Kacheln hoch,
  // bei vollem Tempo über 15 weit - wir lassen bewusst Luft).
  var REACH_UP = 2;
  var REACH_ACROSS = 6;
  var SAFE_DROP = 9;

  function rngFactory(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function emptyGrid() {
    var grid = [];
    for (var y = 0; y < C.ROOM_H; y++) {
      var row = [];
      for (var x = 0; x < C.ROOM_W; x++) {
        var border = (x === 0 || y === 0 || x === C.ROOM_W - 1 || y === C.ROOM_H - 1);
        row.push(border ? C.T_SOLID : C.T_EMPTY);
      }
      grid.push(row);
    }
    return grid;
  }

  function fillRect(grid, x1, y1, x2, y2, type) {
    for (var y = y1; y <= y2; y++) {
      for (var x = x1; x <= x2; x++) {
        if (y > 0 && y < C.ROOM_H - 1 && x > 0 && x < C.ROOM_W - 1) grid[y][x] = type;
      }
    }
  }

  // ---- Erreichbarkeit -----------------------------------------------------

  /** Alle Kacheln, auf denen man stehen kann (leer, darunter massiv). */
  function standableTiles(grid) {
    var tiles = [];
    for (var y = 1; y < C.ROOM_H; y++) {
      for (var x = 1; x < C.ROOM_W - 1; x++) {
        if (grid[y][x] === C.T_EMPTY && grid[y + 1] && grid[y + 1][x] !== C.T_EMPTY) {
          tiles.push({ x: x, y: y });
        }
      }
    }
    return tiles;
  }

  /** Zusammenhängende Standflächen zu Plattformen gruppieren. */
  function buildPlatforms(grid) {
    var tiles = standableTiles(grid);
    var byKey = {};
    tiles.forEach(function (t) { byKey[t.x + ',' + t.y] = t; });
    var platforms = [];
    var seen = {};
    tiles.forEach(function (t) {
      var key = t.x + ',' + t.y;
      if (seen[key]) return;
      var x1 = t.x, x2 = t.x;
      while (byKey[(x1 - 1) + ',' + t.y]) x1--;
      while (byKey[(x2 + 1) + ',' + t.y]) x2++;
      var p = { x1: x1, x2: x2, y: t.y, id: platforms.length };
      for (var x = x1; x <= x2; x++) seen[x + ',' + t.y] = true;
      platforms.push(p);
    });
    return platforms;
  }

  /**
   * Senkrechte Schächte: dort kann man sich per Wandsprung hocharbeiten.
   *
   * Wichtig ist die Zeile, nicht nur die Spalte. Eine frühere Fassung merkte
   * sich nur "in dieser Spalte gibt es irgendwo Wände links und rechts" -
   * dadurch galt eine Plattform als erreichbar, obwohl die Wandpaarung nur in
   * einer einzigen Zeile existierte und man in Wahrheit nirgends hochkam.
   * Ein Raum war deshalb nicht lösbar.
   */
  function shaftCells(grid) {
    var cells = {};
    for (var x = 1; x < C.ROOM_W - 1; x++) {
      for (var y = 1; y < C.ROOM_H - 1; y++) {
        if (grid[y][x] !== C.T_EMPTY) continue;
        var leftSolid = grid[y][x - 1] !== C.T_EMPTY;
        var rightSolid = grid[y][x + 1] !== C.T_EMPTY;
        var narrowPair = grid[y][x + 1] === C.T_EMPTY && x + 2 < C.ROOM_W &&
                         grid[y][x + 2] !== C.T_EMPTY && leftSolid;
        if ((leftSolid && rightSolid) || narrowPair) {
          cells[x + ',' + y] = true;
          if (narrowPair) cells[(x + 1) + ',' + y] = true;
        }
      }
    }
    return cells;
  }

  /** Reicht ein durchgehender Schacht von Zeile yLow bis yHigh? */
  function shaftSpans(cells, x, yHigh, yLow) {
    for (var y = yHigh; y <= yLow; y++) {
      if (!cells[x + ',' + y]) return false;
    }
    return true;
  }

  function platformsConnected(grid, platforms) {
    var shafts = shaftCells(grid);
    var adj = platforms.map(function () { return []; });
    for (var i = 0; i < platforms.length; i++) {
      for (var j = 0; j < platforms.length; j++) {
        if (i === j) continue;
        var a = platforms[i], b = platforms[j];
        var gap;
        if (b.x2 < a.x1) gap = a.x1 - b.x2;
        else if (b.x1 > a.x2) gap = b.x1 - a.x2;
        else gap = 0;
        var rise = a.y - b.y; // positiv = b liegt höher
        var reachable = false;
        if (rise > 0 && rise <= REACH_UP && gap <= REACH_ACROSS) reachable = true;
        if (rise <= 0 && -rise <= SAFE_DROP && gap <= REACH_ACROSS + 2) reachable = true;
        // Wandsprung-Schacht: senkrecht deutlich weiter hoch - aber nur,
        // wenn der Schacht die gesamte Höhe zwischen beiden Flächen abdeckt.
        if (!reachable && rise > 0 && rise <= 10 && gap <= 1) {
          var lo = Math.max(a.x1 - 1, 1), hi = Math.min(a.x2 + 1, C.ROOM_W - 2);
          for (var x = lo; x <= hi; x++) {
            if (shaftSpans(shafts, x, b.y, a.y - 1)) { reachable = true; break; }
          }
        }
        if (reachable) adj[i].push(j);
      }
    }
    return adj;
  }

  function reachableSet(adj, startId) {
    var seen = {};
    var queue = [startId];
    seen[startId] = true;
    while (queue.length) {
      var cur = queue.shift();
      adj[cur].forEach(function (n) {
        if (!seen[n]) { seen[n] = true; queue.push(n); }
      });
    }
    return seen;
  }

  function platformAt(platforms, x, y) {
    for (var i = 0; i < platforms.length; i++) {
      var p = platforms[i];
      if (p.y === y && x >= p.x1 && x <= p.x2) return p;
    }
    return null;
  }

  // ---- Raumbau ------------------------------------------------------------

  var FLOOR_Y = C.ROOM_H - 2; // begehbare Zeile direkt über dem Rand

  function buildPlatformRoom(grid, rnd) {
    var count = 3 + Math.floor(rnd() * 3);
    for (var i = 0; i < count; i++) {
      var w = 3 + Math.floor(rnd() * 5);
      var x = 2 + Math.floor(rnd() * (C.ROOM_W - 4 - w));
      var y = 4 + Math.floor(rnd() * 8);
      fillRect(grid, x, y, x + w - 1, y, C.T_SOLID);
    }
  }

  function buildShaftRoom(grid, rnd) {
    // Ein enger senkrechter Schacht, oben die Belohnung: zwingt zum
    // Wandsprung-Ketten, der Signaturbewegung des Originals.
    var sx = 6 + Math.floor(rnd() * (C.ROOM_W - 14));
    var top = 2 + Math.floor(rnd() * 3);
    fillRect(grid, sx, top, sx, C.ROOM_H - 3, C.T_SOLID);
    fillRect(grid, sx + 3, top, sx + 3, C.ROOM_H - 3, C.T_SOLID);
    // Podest oben im Schacht
    fillRect(grid, sx + 1, top, sx + 2, top, C.T_SOLID);
    // ein paar Stufen außerhalb, damit der Raum nicht leer wirkt
    fillRect(grid, 2, 9, 4, 9, C.T_SOLID);
    fillRect(grid, C.ROOM_W - 5, 7, C.ROOM_W - 3, 7, C.T_SOLID);
    return { shaftX: sx, shaftTop: top };
  }

  /**
   * Rampen-Raum: eine lange Abwärtsschräge als Beschleuniger, unten eine
   * Aufwärtsrampe als Schanze.
   *
   * Grund: Auf einer 45-Grad-Abwärtsschräge beschleunigt die Schwerkraft
   * entlang des Hangs weiter, während die Laufbeschleunigung gedeckelt ist -
   * man wird dort also SCHNELLER als auf flachem Boden. Kurze Rampen
   * schaffen das nicht, es braucht Länge. Danach wirkt die Gegenrampe als
   * Absprung, weil der Sprung der Hangnormalen folgt.
   */
  function buildRampRoom(grid, rnd) {
    var dir = rnd() < 0.5 ? 1 : -1;
    var len = 8 + Math.floor(rnd() * 4); // lang genug, um über das Lauftempo zu kommen
    var topY = 3 + Math.floor(rnd() * 2);
    var startX = dir > 0 ? 3 : C.ROOM_W - 4;

    // Abwärtsschräge: pro Schritt eine Kachel tiefer, darunter massiv
    for (var i = 0; i < len; i++) {
      var x = startX + dir * i;
      var y = topY + i;
      if (x < 2 || x > C.ROOM_W - 3 || y > FLOOR_Y) break;
      grid[y][x] = dir > 0 ? C.T_SLOPE_BL : C.T_SLOPE_BR;
      for (var yy = y + 1; yy <= FLOOR_Y; yy++) grid[yy][x] = C.T_SOLID;
    }

    // Gegenrampe als Schanze am anderen Ende
    var rampX = dir > 0 ? Math.min(C.ROOM_W - 4, startX + len + 3) : Math.max(3, startX - len - 3);
    addRamp(grid, rampX, 4 + Math.floor(rnd() * 3), -dir);

    // Podest oben auf der Startseite, damit der Schalter dort liegen kann
    var px1 = dir > 0 ? 2 : C.ROOM_W - 5;
    fillRect(grid, Math.min(px1, px1 + 2), topY - 1, Math.max(px1, px1 + 2), topY - 1, C.T_SOLID);
  }

  function buildPillarRoom(grid, rnd) {
    // Offener Raum mit Säulen: gut für Geschütze, weil es echte Deckung gibt.
    var pillars = 2 + Math.floor(rnd() * 3);
    for (var i = 0; i < pillars; i++) {
      var x = 4 + Math.floor(rnd() * (C.ROOM_W - 8));
      var h = 3 + Math.floor(rnd() * 6);
      fillRect(grid, x, C.ROOM_H - 2 - h, x, C.ROOM_H - 2, C.T_SOLID);
      if (rnd() < 0.5) fillRect(grid, x, C.ROOM_H - 2 - h, x + 1, C.ROOM_H - 2 - h, C.T_SOLID);
    }
  }

  function tileCenter(x, y) {
    return { x: x * C.TILE + C.TILE / 2, y: y * C.TILE + C.TILE / 2 };
  }

  /**
   * Rampe aus 45-Grad-Schrägen, die vom Boden aus ansteigt.
   *
   * Schrägen sind bei dieser Physik kein Deko-Element: Beim Aufprall zählt
   * nur die Normalkomponente, dadurch überlebt man auf einer Schräge Stürze,
   * die auf flachem Boden töten (nachgemessen: 15 statt 11 Kacheln). Und
   * herunterrutschen lenkt Fallgeschwindigkeit in Lauftempo um, statt sie zu
   * vernichten - das ist der "Flow", für den N bekannt ist.
   */
  function addRamp(grid, x0, len, dir) {
    for (var i = 0; i < len; i++) {
      var x = dir > 0 ? x0 + i : x0 - i;
      var y = FLOOR_Y - i;
      if (x < 2 || x > C.ROOM_W - 3 || y < 3) break;
      if (grid[y][x] !== C.T_EMPTY) break;
      grid[y][x] = dir > 0 ? C.T_SLOPE_BR : C.T_SLOPE_BL;
      for (var yy = y + 1; yy <= FLOOR_Y; yy++) grid[yy][x] = C.T_SOLID;
    }
  }

  /**
   * Spalten, in denen eine hohe senkrechte Wand steht (z.B. die Wände eines
   * Kletterschachts), plus je zwei Kacheln Sicherheitsabstand.
   *
   * Dort dürfen keine Rampen entstehen: Ein Schacht lässt unten bewusst eine
   * Zeile als Durchgang frei, und eine Rampe füllt genau die auf. Aus dem
   * Schacht wird dann eine raumhohe Mauer, die den Raum in zwei Hälften
   * teilt - ein Raum war dadurch nachweislich unlösbar.
   */
  function tallWallColumns(grid) {
    var blocked = {};
    for (var x = 1; x < C.ROOM_W - 1; x++) {
      var run = 0, maxRun = 0;
      for (var y = 1; y < C.ROOM_H - 1; y++) {
        if (grid[y][x] !== C.T_EMPTY) { run++; maxRun = Math.max(maxRun, run); }
        else run = 0;
      }
      if (maxRun >= 5) {
        for (var d = -2; d <= 2; d++) blocked[x + d] = true;
      }
    }
    return blocked;
  }

  function addRamps(grid, rnd) {
    var blocked = tallWallColumns(grid);
    var count = Math.floor(rnd() * 3); // 0 bis 2 Rampen
    for (var i = 0; i < count; i++) {
      var len = 2 + Math.floor(rnd() * 4);
      var dir = rnd() < 0.5 ? 1 : -1;
      for (var tries = 0; tries < 12; tries++) {
        var x0 = 4 + Math.floor(rnd() * (C.ROOM_W - 10));
        // Die ganze geplante Rampe muss frei von hohen Wänden sein
        var ok = true;
        for (var k = 0; k < len; k++) {
          if (blocked[x0 + dir * k]) { ok = false; break; }
        }
        if (ok) { addRamp(grid, x0, len, dir); break; }
      }
    }
  }

  /** Steht auf dieser Kachel schon eine begehbare Fläche? */
  function isStandable(grid, x, y) {
    if (x < 1 || x > C.ROOM_W - 2 || y < 1 || y > C.ROOM_H - 2) return false;
    return grid[y][x] === C.T_EMPTY && grid[y + 1][x] !== C.T_EMPTY;
  }

  /**
   * Setzt bei Bedarf Trittstufen zwischen Boden und Schalter, sodass der Weg
   * in Schritten von höchstens 2 Kacheln Höhe und 4 Kacheln Breite begehbar
   * ist - beides deutlich unter dem, was die Physik hergibt (3.09 hoch,
   * über 15 weit), also mit reichlich Sicherheitsabstand.
   */
  function ensureStaircase(grid, spawnX, targetX, targetY) {
    var y = targetY;
    var x = targetX;
    var guard = 0;
    while (y < FLOOR_Y - 2 && guard++ < 20) {
      var nextY = y + 2;
      // Richtung Start versetzen, damit eine echte Treppe entsteht
      var dir = spawnX < x ? -1 : 1;
      var nextX = x + dir * (2 + Math.floor(Math.random() * 2));
      nextX = Math.max(2, Math.min(C.ROOM_W - 3, nextX));

      // Gibt es auf dieser Höhe in Reichweite schon etwas Begehbares?
      var found = false;
      for (var probe = Math.max(2, nextX - 3); probe <= Math.min(C.ROOM_W - 3, nextX + 3); probe++) {
        for (var dy = -1; dy <= 1; dy++) {
          if (isStandable(grid, probe, nextY + dy)) {
            found = true;
            nextX = probe;
            nextY = nextY + dy;
            break;
          }
        }
        if (found) break;
      }

      if (!found) {
        // Eine kurze Stufe einziehen. Der Block kommt eine Zeile TIEFER als
        // die Standfläche - sonst lägen die Stufen nur eine Kachel auseinander.
        var w = 2 + Math.floor(Math.random() * 2);
        var x1 = Math.max(2, nextX);
        var x2 = Math.min(C.ROOM_W - 3, nextX + w - 1);
        var solidRow = nextY + 1;
        var blocked = solidRow >= C.ROOM_H - 1;
        for (var cx = x1; !blocked && cx <= x2; cx++) {
          if (grid[nextY][cx] !== C.T_EMPTY || grid[solidRow][cx] !== C.T_EMPTY) blocked = true;
        }
        if (!blocked) fillRect(grid, x1, solidRow, x2, solidRow, C.T_SOLID);
      }

      x = nextX;
      y = nextY;
    }
  }

  function attempt(index, rnd, archetype) {
    var grid = emptyGrid();
    if (archetype === 0) buildPlatformRoom(grid, rnd);
    else if (archetype === 1) buildShaftRoom(grid, rnd);
    else if (archetype === 2) buildPillarRoom(grid, rnd);
    else buildRampRoom(grid, rnd);
    // Rampen vor der Treppen-Garantie einziehen, damit die Treppe sie
    // berücksichtigt statt mit ihnen zu kollidieren.
    if (index >= 1) addRamps(grid, rnd);

    var platforms = buildPlatforms(grid);
    if (!platforms.length) return null;

    // Boden-Plattform finden (die breiteste auf Bodenhöhe)
    var floorPlat = null;
    platforms.forEach(function (p) {
      if (p.y === FLOOR_Y && (!floorPlat || (p.x2 - p.x1) > (floorPlat.x2 - floorPlat.x1))) floorPlat = p;
    });
    if (!floorPlat) return null;

    var adj = platformsConnected(grid, platforms);
    var reach = reachableSet(adj, floorPlat.id);
    var usable = platforms.filter(function (p) { return reach[p.id] && (p.x2 - p.x1) >= 0; });
    if (usable.length < 2) return null;

    // Start links unten, Tür in Startnähe, Schalter möglichst weit weg -
    // damit man hin und zurück muss, wie im Original.
    var spawnX = floorPlat.x1 + 1;
    var doorX = Math.min(floorPlat.x1 + 3, floorPlat.x2);

    var best = null, bestScore = -1;
    usable.forEach(function (p) {
      if (p === floorPlat && usable.length > 1) return;
      var px = (p.x1 + p.x2) / 2;
      var score = Math.abs(px - spawnX) + (FLOOR_Y - p.y) * 1.5;
      if (score > bestScore) { bestScore = score; best = p; }
    });
    if (!best) best = floorPlat;
    var switchX = Math.floor((best.x1 + best.x2) / 2);
    var switchY = best.y;

    if (switchX === spawnX && switchY === FLOOR_Y) return null;

    // GARANTIE: eine Treppe vom Boden zum Schalter einbauen. Sich darauf zu
    // verlassen, dass zufällig gesetzte Plattformen erreichbar sind, reicht
    // bei dieser Physik nicht - ein unschaffbarer Raum beendet den Lauf.
    ensureStaircase(grid, spawnX, switchX, switchY);
    platforms = buildPlatforms(grid);
    floorPlat = null;
    platforms.forEach(function (p) {
      if (p.y === FLOOR_Y && (!floorPlat || (p.x2 - p.x1) > (floorPlat.x2 - floorPlat.x1))) floorPlat = p;
    });
    if (!floorPlat) return null;

    return {
      grid: grid,
      archetype: archetype,
      spawn: tileCenter(spawnX, FLOOR_Y),
      door: tileCenter(doorX, FLOOR_Y),
      switchTile: { x: switchX, y: switchY },
      switchPos: tileCenter(switchX, switchY),
      platforms: usable,
      floorPlat: floorPlat,
    };
  }

  /** Rückfallebene: garantiert lösbar, Schalter steht auf dem Boden. */
  function fallbackRoom() {
    var grid = emptyGrid();
    fillRect(grid, 8, 9, 12, 9, C.T_SOLID);
    fillRect(grid, 16, 6, 20, 6, C.T_SOLID);
    return {
      grid: grid,
      archetype: 0,
      spawn: tileCenter(2, FLOOR_Y),
      door: tileCenter(4, FLOOR_Y),
      switchTile: { x: C.ROOM_W - 3, y: FLOOR_Y },
      switchPos: tileCenter(C.ROOM_W - 3, FLOOR_Y),
      platforms: [],
      floorPlat: null,
    };
  }

  // ---- Gefahren platzieren ------------------------------------------------

  function placeHazards(room, world, index, rnd) {
    var hazards = [];
    var golds = [];
    var grid = room.grid;

    // Schwierigkeit steigt langsam: erst Minen, dann Drohnen, dann Geschütze.
    // Raum 1 ist bewusst leer: dort lernt man ohne Strafe, wie sich die
    // Bewegung anfühlt. Danach kommt zügig alles dazu - besonders das
    // Geschütz, weil das Anschleichen der Kern des Spiels ist und nicht
    // erst nach Minuten auftauchen darf.
    var mineCount = index < 1 ? 0 : Math.min(5, 1 + Math.floor(index / 2));
    var droneCount = index < 2 ? 0 : Math.min(3, 1 + Math.floor((index - 2) / 4));
    var turretCount = index < 3 ? 0 : Math.min(3, 1 + Math.floor((index - 3) / 4));

    function freeTile(preferAir) {
      for (var tries = 0; tries < 60; tries++) {
        var x = 2 + Math.floor(rnd() * (C.ROOM_W - 4));
        var y = 2 + Math.floor(rnd() * (C.ROOM_H - 4));
        if (grid[y][x] !== C.T_EMPTY) continue;
        if (preferAir && grid[y + 1] && grid[y + 1][x] !== C.T_EMPTY) continue;
        var c = tileCenter(x, y);
        // Nicht direkt auf Start, Tür oder Schalter setzen
        if (Math.abs(c.x - room.spawn.x) < 60 && Math.abs(c.y - room.spawn.y) < 50) continue;
        if (Math.abs(c.x - room.switchPos.x) < 34 && Math.abs(c.y - room.switchPos.y) < 34) continue;
        if (Math.abs(c.x - room.door.x) < 50 && Math.abs(c.y - room.door.y) < 40) continue;
        return { tx: x, ty: y, x: c.x, y: c.y };
      }
      return null;
    }

    // Minen liegen auf begehbaren Flächen - deshalb nicht würfeln, sondern
    // aus der Liste der Standflächen ziehen. (Zufälliges Würfeln scheiterte
    // zu oft und ließ die ersten Räume leer.)
    // Minen NIE in einen engen Kletterschacht setzen: Dort führt der einzige
    // Weg nach oben über eine Wandsprung-Kette, und eine Mine mittendrin
    // macht den Raum praktisch unspielbar. (Die Lösbarkeitsprüfung mit Minen
    // scheiterte genau an solchen Räumen - ausnahmslos Schacht-Räume.)
    var shaftsForMines = shaftCells(grid);
    // Minen dürfen nur auf breiten, offenen Flächen liegen - nie in einem
    // Engpass. Ein Raum scheiterte genau daran: Zwei Minen lagen übereinander
    // in der einzigen Lücke zum Schalter. Die alte Regel hielt nur Minen
    // derselben Zeile auseinander und sah solche Stapel nicht.
    var minePlatforms = buildPlatforms(grid).filter(function (p) {
      return (p.x2 - p.x1 + 1) >= 5;
    });
    var onWidePlatform = {};
    minePlatforms.forEach(function (p) {
      // Ränder freihalten, damit man immer daneben landen kann
      for (var x = p.x1 + 1; x <= p.x2 - 1; x++) onWidePlatform[x + ',' + p.y] = true;
    });

    var standing = standableTiles(grid).filter(function (t) {
      if (shaftsForMines[t.x + ',' + t.y] || shaftsForMines[(t.x - 1) + ',' + t.y] ||
          shaftsForMines[(t.x + 1) + ',' + t.y]) return false;
      if (!onWidePlatform[t.x + ',' + t.y]) return false;
      var c = tileCenter(t.x, t.y);
      if (Math.abs(c.x - room.spawn.x) < 70 && Math.abs(c.y - room.spawn.y) < 40) return false;
      if (Math.abs(c.x - room.switchPos.x) < 40 && Math.abs(c.y - room.switchPos.y) < 30) return false;
      if (Math.abs(c.x - room.door.x) < 60 && Math.abs(c.y - room.door.y) < 40) return false;
      return true;
    });
    var i, spot;
    for (i = 0; i < mineCount && standing.length; i++) {
      var pick = Math.floor(rnd() * standing.length);
      var tile = standing.splice(pick, 1)[0];
      // Nachbarkacheln freihalten, damit nie ein Weg komplett dicht ist
      standing = standing.filter(function (t) {
        return !(t.y === tile.y && Math.abs(t.x - tile.x) < 3);
      });
      var mc = tileCenter(tile.x, tile.y);
      hazards.push(new BO.Mine(mc.x, mc.y + C.TILE / 2 - 4));
    }

    for (i = 0; i < droneCount; i++) {
      spot = freeTile(true);
      if (spot) hazards.push(new BO.Drone(world, spot.x, spot.y, Math.floor(rnd() * 4), Math.floor(rnd() * 4)));
    }

    for (i = 0; i < turretCount; i++) {
      // Geschütze sitzen an einer Wand und schauen in den Raum
      for (var tries = 0; tries < 40; tries++) {
        var x = 2 + Math.floor(rnd() * (C.ROOM_W - 4));
        var y = 2 + Math.floor(rnd() * (C.ROOM_H - 4));
        if (grid[y][x] !== C.T_EMPTY) continue;
        var onWall = (grid[y][x - 1] !== C.T_EMPTY) || (grid[y][x + 1] !== C.T_EMPTY) ||
                     (grid[y + 1] && grid[y + 1][x] !== C.T_EMPTY) || (grid[y - 1] && grid[y - 1][x] !== C.T_EMPTY);
        if (!onWall) continue;
        var c = tileCenter(x, y);
        if (Math.abs(c.x - room.spawn.x) < 80) continue;
        hazards.push(new BO.Turret(world, c.x, c.y, rnd() * Math.PI * 2));
        break;
      }
    }

    // Gold gibt Zeit - der Grund, Risiken einzugehen statt nur durchzurennen.
    var goldCount = 2 + Math.floor(rnd() * 3);
    for (i = 0; i < goldCount; i++) {
      spot = freeTile(false);
      if (spot) golds.push({ x: spot.x, y: spot.y, taken: false });
    }

    return { hazards: hazards, golds: golds };
  }

  /** Erzeugt Raum Nummer `index` (0-basiert) als fertiges Spielobjekt. */
  function generate(index, seed) {
    var rnd = rngFactory((seed == null ? Math.floor(Math.random() * 1e9) : seed) + index * 7919);
    // Archetyp reihum statt gewürfelt: Beim Würfeln mit Neuversuch
    // verschwanden ganze Typen aus der Rotation (Säulenräume kamen nur noch
    // in 1 % der Fälle vor), und gerade die liefern die Deckung, ohne die
    // sich niemand an einem Geschütz vorbeischleichen kann.
    var archetype = index < 2 ? 0 : ((index + (seed || 0)) % 4);
    var room = null;
    for (var tries = 0; tries < 20 && !room; tries++) {
      room = attempt(index, rnd, archetype);
    }
    // Klappt dieser Typ partout nicht, die anderen durchprobieren
    for (var alt = 0; alt < 4 && !room; alt++) {
      for (var t2 = 0; t2 < 10 && !room; t2++) room = attempt(index, rnd, alt);
    }
    if (!room) room = fallbackRoom();

    var world = new BO.World(room.grid);
    var extras = placeHazards(room, world, index, rnd);
    room.world = world;
    room.hazards = extras.hazards;
    room.golds = extras.golds;
    return room;
  }

  BO.level = { generate: generate, rngFactory: rngFactory, FLOOR_Y: FLOOR_Y };
})(typeof window !== 'undefined' ? window : globalThis);
