/**
 * Schutzmauer: 8 Segmente je Seite (Spec), jedes mit eigenem HP-Wert.
 * Ein Schuss trifft immer genau das Segment an seiner X-Position und
 * schwächt NUR dieses (Spec: "Segment für Segment nur an der getroffenen
 * Stelle"). Bei 0 HP ist das Segment zerstört -> Lücke, Schüsse fliegen
 * dort ungehindert durch.
 */
(function (global) {
  'use strict';

  var TD = global.TD = global.TD || {};
  var C = TD.constants;

  var segWidth = (C.CANVAS_W - C.FIELD_MARGIN * 2) / C.WALL_SEGMENTS;

  function create(y, color) {
    var segments = [];
    for (var i = 0; i < C.WALL_SEGMENTS; i++) {
      segments.push({ hp: C.WALL_SEGMENT_HP, x: C.FIELD_MARGIN + i * segWidth, w: segWidth });
    }
    return { y: y, color: color, segments: segments };
  }

  // Liefert den Segment-Index für eine X-Position, geklemmt auf 0..7,
  // damit auch Treffer knapp außerhalb der Mauerbreite (z.B. durch den
  // großzügigen Kollisionsradius) noch ein sinnvolles Segment treffen.
  function segmentIndexForX(x) {
    var idx = Math.floor((x - C.FIELD_MARGIN) / segWidth);
    if (idx < 0) idx = 0;
    if (idx > C.WALL_SEGMENTS - 1) idx = C.WALL_SEGMENTS - 1;
    return idx;
  }

  // Prüft, ob eine Kugel gerade das Kollisionsband dieser Mauer
  // durchquert und – falls das getroffene Segment noch HP hat – schwächt
  // es. Gibt zurück, ob die Kugel dabei verbraucht wurde (Treffer auf
  // intaktes Segment) oder ungehindert weiterfliegt (Lücke).
  function tryBlock(wall, bulletX, bulletY) {
    if (Math.abs(bulletY - wall.y) > C.WALL_BAND_HALF) return { inBand: false, blocked: false };
    var seg = wall.segments[segmentIndexForX(bulletX)];
    if (seg.hp <= 0) return { inBand: true, blocked: false }; // Lücke, fliegt durch
    seg.hp -= C.WALL_HIT_DAMAGE;
    return { inBand: true, blocked: true, segment: seg };
  }

  function draw(ctx, wall) {
    for (var i = 0; i < wall.segments.length; i++) {
      var seg = wall.segments[i];
      if (seg.hp <= 0) continue; // Lücke, nichts zeichnen
      var frac = seg.hp / C.WALL_SEGMENT_HP;
      ctx.globalAlpha = 0.35 + frac * 0.65; // stärker beschädigt -> blasser
      ctx.fillStyle = wall.color;
      ctx.fillRect(seg.x + 1, wall.y - C.WALL_THICKNESS / 2, seg.w - 2, C.WALL_THICKNESS);
      ctx.globalAlpha = 1;
    }
  }

  TD.wall = { create: create, tryBlock: tryBlock, draw: draw, segmentIndexForX: segmentIndexForX };
})(window);
