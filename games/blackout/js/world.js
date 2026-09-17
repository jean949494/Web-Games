/**
 * Blackout – Weltgeometrie.
 *
 * Ein Raum ist ein Kachelraster. Für die Kollision wird es (wie im Original)
 * in orientierte Liniensegmente zerlegt: Jede Kante weiß, welche Seite die
 * Außenseite ist. Der Ninja ist ein Kreis, der gegen diese Segmente getestet
 * wird - nicht Box gegen Box. Genau das erlaubt später Schrägen, an denen
 * Fallgeschwindigkeit in Laufgeschwindigkeit umgelenkt wird.
 *
 * Wicklungs-Konvention (Bildschirmkoordinaten, y zeigt nach unten):
 * Die Außenseite eines Segments liegt dort, wo das Kreuzprodukt
 * (p2-p1) x (pos-p1) positiv ist. Für einen massiven Block heißt das:
 * Oberkante rechts->links, linke Kante oben->unten, Unterkante links->rechts,
 * rechte Kante unten->oben.
 *
 * Segmente werden pro Zelle abgelegt, damit Abfragen nur die Nachbarschaft
 * durchsuchen müssen (im Original: gather_segments_from_region).
 */
(function (global) {
  'use strict';

  var BO = global.BO = global.BO || {};
  var C = BO.constants;

  function makeSegment(x1, y1, x2, y2) {
    return { x1: x1, y1: y1, x2: x2, y2: y2 };
  }

  /**
   * Zerlegt eine einzelne Kachel in ihre Außensegmente.
   * Kanten, hinter denen eine weitere massive Kachel liegt, werden
   * weggelassen - sonst würde der Ninja an inneren Nähten hängenbleiben.
   */
  function segmentsForTile(type, cx, cy, neighbours) {
    var T = C.TILE;
    var x0 = cx * T, y0 = cy * T, x1 = x0 + T, y1 = y0 + T;
    var segs = [];
    var solidUp = neighbours.up, solidDown = neighbours.down;
    var solidLeft = neighbours.left, solidRight = neighbours.right;

    if (type === C.T_SOLID) {
      if (!solidUp) segs.push(makeSegment(x1, y0, x0, y0)); // oben: rechts -> links
      if (!solidLeft) segs.push(makeSegment(x0, y0, x0, y1)); // links: oben -> unten
      if (!solidDown) segs.push(makeSegment(x0, y1, x1, y1)); // unten: links -> rechts
      if (!solidRight) segs.push(makeSegment(x1, y1, x1, y0)); // rechts: unten -> oben
      return segs;
    }

    // 45-Grad-Schrägen: Hypotenuse immer, die beiden Katheten nur nach außen.
    //
    // ACHTUNG, hier lag ein Fehler: Alle vier Hypotenusen waren verkehrt
    // herum gewickelt, die Außenseite lag also auf der massiven Seite. Die
    // Katheten stimmten, damit widersprachen sich die Segmente ein und
    // derselben Kachel. Beim Laufen über eine Rampe fiel das nicht auf, weil
    // dort meist die Kante der massiven Nachbarkachel näher liegt und
    // gewinnt. Aufgefallen ist es erst, als ein Schalter direkt über einer
    // einzeln stehenden Schräge lag: Die Spielfigur galt dort als "in der
    // Wand" und wurde in einem einzigen Bild 80 Pixel weit weggeschoben.
    if (type === C.T_SLOPE_BL) {
      // massiv unten links: Hypotenuse unten-rechts -> oben-links,
      // damit die Außenseite oben rechts liegt
      segs.push(makeSegment(x1, y1, x0, y0));
      if (!solidLeft) segs.push(makeSegment(x0, y0, x0, y1));
      if (!solidDown) segs.push(makeSegment(x0, y1, x1, y1));
    } else if (type === C.T_SLOPE_BR) {
      // massiv unten rechts: Hypotenuse oben-rechts -> unten-links
      segs.push(makeSegment(x1, y0, x0, y1));
      if (!solidDown) segs.push(makeSegment(x0, y1, x1, y1));
      if (!solidRight) segs.push(makeSegment(x1, y1, x1, y0));
    } else if (type === C.T_SLOPE_TL) {
      // massiv oben links: Hypotenuse unten-links -> oben-rechts
      segs.push(makeSegment(x0, y1, x1, y0));
      if (!solidUp) segs.push(makeSegment(x1, y0, x0, y0));
      if (!solidLeft) segs.push(makeSegment(x0, y0, x0, y1));
    } else if (type === C.T_SLOPE_TR) {
      // massiv oben rechts: Hypotenuse oben-links -> unten-rechts
      segs.push(makeSegment(x0, y0, x1, y1));
      if (!solidUp) segs.push(makeSegment(x1, y0, x0, y0));
      if (!solidRight) segs.push(makeSegment(x1, y1, x1, y0));
    }
    return segs;
  }

  function isSolidType(t) {
    return t !== C.T_EMPTY;
  }

  /** Nur volle Blöcke verdecken eine Nachbarkante vollständig. */
  function blocksEdge(t) {
    return t === C.T_SOLID;
  }

  function World(grid) {
    this.grid = grid; // grid[y][x]
    this.w = grid[0].length;
    this.h = grid.length;
    this.cellSegments = [];
    this.build();
  }

  World.prototype.tileAt = function (cx, cy) {
    if (cx < 0 || cy < 0 || cx >= this.w || cy >= this.h) return C.T_SOLID;
    return this.grid[cy][cx];
  };

  World.prototype.build = function () {
    this.cellSegments = new Array(this.w * this.h);
    for (var cy = 0; cy < this.h; cy++) {
      for (var cx = 0; cx < this.w; cx++) {
        var t = this.grid[cy][cx];
        if (!isSolidType(t)) continue;
        var segs = segmentsForTile(t, cx, cy, {
          up: blocksEdge(this.tileAt(cx, cy - 1)),
          down: blocksEdge(this.tileAt(cx, cy + 1)),
          left: blocksEdge(this.tileAt(cx - 1, cy)),
          right: blocksEdge(this.tileAt(cx + 1, cy)),
        });
        if (segs.length) this.cellSegments[cy * this.w + cx] = segs;
      }
    }
  };

  /** Alle Segmente aus den Zellen, die das Rechteck berühren. */
  World.prototype.gatherSegments = function (x1, y1, x2, y2) {
    var T = C.TILE;
    var cx1 = Math.max(0, Math.floor(x1 / T) - 1);
    var cy1 = Math.max(0, Math.floor(y1 / T) - 1);
    var cx2 = Math.min(this.w - 1, Math.floor(x2 / T) + 1);
    var cy2 = Math.min(this.h - 1, Math.floor(y2 / T) + 1);
    var out = [];
    for (var cy = cy1; cy <= cy2; cy++) {
      for (var cx = cx1; cx <= cx2; cx++) {
        var segs = this.cellSegments[cy * this.w + cx];
        if (segs) {
          for (var i = 0; i < segs.length; i++) out.push(segs[i]);
        }
      }
    }
    return out;
  };

  /**
   * Nächster Punkt auf einem Segment. backFacing ist wahr, wenn die Position
   * auf der Innenseite liegt (dann zählt die Kollision schwächer).
   */
  function closestPointOnSegment(seg, xpos, ypos) {
    var px = seg.x2 - seg.x1;
    var py = seg.y2 - seg.y1;
    var dx = xpos - seg.x1;
    var dy = ypos - seg.y1;
    var segLenSq = px * px + py * py;
    var u = (dx * px + dy * py) / segLenSq;
    if (u < 0) u = 0;
    if (u > 1) u = 1;
    var a = seg.x1 + u * px;
    var b = seg.y1 + u * py;
    var backFacing = (dy * px - dx * py) < 0;
    return { backFacing: backFacing, a: a, b: b };
  }

  /**
   * Der eine nächstgelegene Punkt in Reichweite. result: 0 = keiner,
   * 1 = Außenkante, -1 = Innenkante. Außenkanten werden leicht bevorzugt
   * (0.1 Bonus), damit bei mehreren nahen Segmenten die richtige Seite gewinnt.
   */
  World.prototype.getSingleClosestPoint = function (xpos, ypos, radius) {
    var segments = this.gatherSegments(xpos - radius, ypos - radius, xpos + radius, ypos + radius);
    var shortest = 9999999;
    var result = 0;
    var ax = 0, ay = 0;
    for (var i = 0; i < segments.length; i++) {
      var cp = closestPointOnSegment(segments[i], xpos, ypos);
      var ddx = xpos - cp.a, ddy = ypos - cp.b;
      var distSq = ddx * ddx + ddy * ddy;
      if (!cp.backFacing) distSq -= 0.1;
      if (distSq < shortest) {
        shortest = distSq;
        ax = cp.a;
        ay = cp.b;
        result = cp.backFacing ? -1 : 1;
      }
    }
    return { result: result, a: ax, b: ay };
  };

  // ---- Durchdringungsschutz: Kreis entlang der Frame-Bewegung sweepen ----

  function timeCircleVsCircle(xpos, ypos, vx, vy, a, b, radius) {
    var dx = xpos - a, dy = ypos - b;
    var distSq = dx * dx + dy * dy;
    var velSq = vx * vx + vy * vy;
    var dot = dx * vx + dy * vy;
    if (distSq - radius * radius > 0) {
      var radicand = dot * dot - velSq * (distSq - radius * radius);
      if (velSq > 0.0001 && dot < 0 && radicand >= 0) {
        return (-dot - Math.sqrt(radicand)) / velSq;
      }
      return 1;
    }
    return 0;
  }

  function timeCircleVsLineseg(xpos, ypos, dx, dy, a1, b1, a2, b2, radius) {
    var wx = a2 - a1, wy = b2 - b1;
    var segLen = Math.sqrt(wx * wx + wy * wy);
    var nx = wx / segLen, ny = wy / segLen;
    var normalProj = (xpos - a1) * ny - (ypos - b1) * nx;
    var horProj = (xpos - a1) * nx + (ypos - b1) * ny;
    if (Math.abs(normalProj) >= radius) {
      var dir = dx * ny - dy * nx;
      if (dir * normalProj < 0) {
        var t = Math.min((Math.abs(normalProj) - radius) / Math.abs(dir), 1);
        var horProj2 = horProj + t * (dx * nx + dy * ny);
        if (horProj2 >= 0 && horProj2 <= segLen) return t;
      }
    } else if (horProj >= 0 && horProj <= segLen) {
      return 0;
    }
    return 1;
  }

  World.prototype.sweepCircle = function (xposOld, yposOld, dx, dy, radius) {
    var xNew = xposOld + dx, yNew = yposOld + dy;
    var width = radius + 1;
    var segments = this.gatherSegments(
      Math.min(xposOld, xNew) - width, Math.min(yposOld, yNew) - width,
      Math.max(xposOld, xNew) + width, Math.max(yposOld, yNew) + width
    );
    var shortest = 1;
    for (var i = 0; i < segments.length; i++) {
      var s = segments[i];
      var t1 = timeCircleVsCircle(xposOld, yposOld, dx, dy, s.x1, s.y1, radius);
      var t2 = timeCircleVsCircle(xposOld, yposOld, dx, dy, s.x2, s.y2, radius);
      var t3 = timeCircleVsLineseg(xposOld, yposOld, dx, dy, s.x1, s.y1, s.x2, s.y2, radius);
      var t = Math.min(t1, t2, t3);
      if (t < shortest) shortest = t;
    }
    return shortest;
  };

  /** Sichtlinie für Geschütze: frei, wenn kein Segment dazwischen liegt. */
  World.prototype.hasLineOfSight = function (x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    var segments = this.gatherSegments(
      Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)
    );
    for (var i = 0; i < segments.length; i++) {
      if (segmentsIntersect(x1, y1, x2, y2, segments[i])) return false;
    }
    return true;
  };

  function segmentsIntersect(ax, ay, bx, by, seg) {
    var cx = seg.x1, cy = seg.y1, dx2 = seg.x2, dy2 = seg.y2;
    var d1 = cross(dx2 - cx, dy2 - cy, ax - cx, ay - cy);
    var d2 = cross(dx2 - cx, dy2 - cy, bx - cx, by - cy);
    var d3 = cross(bx - ax, by - ay, cx - ax, cy - ay);
    var d4 = cross(bx - ax, by - ay, dx2 - ax, dy2 - ay);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
           ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  }

  function cross(ax, ay, bx, by) {
    return ax * by - ay * bx;
  }

  BO.World = World;
  BO.closestPointOnSegment = closestPointOnSegment;
})(typeof window !== 'undefined' ? window : globalThis);
