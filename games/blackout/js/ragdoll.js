/**
 * Blackout – Ragdoll beim Tod.
 *
 * In N ist der Tod nicht bloß ein Game-Over, sondern die Pointe: Die Figur
 * klappt zusammen und purzelt mit dem Schwung weiter, den sie hatte. Genau
 * das macht das Sterben komisch statt frustrierend - und in einem Spiel,
 * in dem man ständig stirbt, ist das der Unterschied zwischen "nochmal!"
 * und "weg damit".
 *
 * Umsetzung: Verlet-Punkte mit Abstands-Zwangsbedingungen (Kopf, Rumpf,
 * zwei Arme, zwei Beine), die gegen dieselbe Weltgeometrie kollidieren wie
 * die Spielfigur. Kein Skelett-Framework nötig, ~6 Punkte reichen völlig.
 */
(function (global) {
  'use strict';

  var BO = global.BO = global.BO || {};
  var C = BO.constants;

  // Dieselbe Schwerkraft wie die Spielfigur (Originalwert, auf 60 Bilder/s
  // umgerechnet). Vorher stand hier ein frei gegriffener, viermal zu hoher
  // Wert - dadurch fiel die Puppe wie ein Stein statt zu purzeln.
  var GRAVITY = 0.0667;
  var DAMPING = 0.985;
  var CONSTRAINT_PASSES = 4;
  var POINT_RADIUS = 3.2;
  // Ohne Begrenzung beschleunigt die Schwerkraft die Punkte in wenigen
  // Frames auf über 8 px/Frame - dann tunneln sie durch die nur 3 px dicke
  // Kollisionshülle und die Puppe fällt durch den Boden. Eine Begrenzung
  // der Schrittweite ist hier einfacher als kontinuierliche Kollision und
  // sieht obendrein ruhiger aus.
  var MAX_STEP = 5;

  function Ragdoll(world, x, y, vx, vy) {
    this.world = world;
    this.life = 1;
    // Startgeschwindigkeit etwas dämpfen, sonst schießt die Puppe aus dem Bild
    var sx = vx * 0.55;
    var sy = vy * 0.55;

    // Punkte relativ zur Todesstelle: Kopf oben, Rumpf, Arme, Beine
    var layout = [
      { x: 0, y: -6 },   // 0 Kopf
      { x: 0, y: 0 },    // 1 Brust
      { x: 0, y: 6 },    // 2 Becken
      { x: -5, y: 1 },   // 3 linker Arm
      { x: 5, y: 1 },    // 4 rechter Arm
      { x: -3, y: 11 },  // 5 linkes Bein
      { x: 3, y: 11 },   // 6 rechtes Bein
    ];

    this.points = layout.map(function (p, i) {
      var px = x + p.x;
      var py = y + p.y;
      // Etwas Drall: Gliedmaßen bekommen leicht abweichende Startgeschwindigkeit
      var spin = (i >= 3) ? (Math.random() - 0.5) * 1.6 : 0;
      return {
        x: px, y: py,
        ox: px - (sx + spin), oy: py - (sy + spin * 0.5),
      };
    });

    // Punkte, die in der Geometrie stecken, nach oben herausschieben.
    // Wer auf dem Boden stirbt, hätte sonst die Beine IM Boden - und ein
    // Punkt im Inneren wird beim Entpenetrieren in die falsche Richtung
    // gedrückt, wodurch die ganze Puppe durch den Boden sinkt.
    var T = C.TILE;
    this.points.forEach(function (p) {
      for (var tries = 0; tries < 4; tries++) {
        var cx = Math.floor(p.x / T), cy = Math.floor(p.y / T);
        if (world.tileAt(cx, cy) === C.T_EMPTY) break;
        p.y -= T * 0.6;
        p.oy -= T * 0.6;
      }
    });

    this.sticks = [
      [0, 1, 6], [1, 2, 6], [1, 3, 5], [1, 4, 5],
      [2, 5, 5], [2, 6, 5], [0, 2, 12], [3, 4, 10], [5, 6, 6],
    ].map(function (s) { return { a: s[0], b: s[1], len: s[2] }; });
  }

  Ragdoll.prototype.update = function () {
    this.life -= 0.006;
    var i, p;

    // Verlet-Integration
    for (i = 0; i < this.points.length; i++) {
      p = this.points[i];
      var vx = (p.x - p.ox) * DAMPING;
      var vy = (p.y - p.oy) * DAMPING + GRAVITY;
      var speed = Math.sqrt(vx * vx + vy * vy);
      if (speed > MAX_STEP) {
        vx = vx / speed * MAX_STEP;
        vy = vy / speed * MAX_STEP;
      }
      p.ox = p.x;
      p.oy = p.y;
      p.x += vx;
      p.y += vy;
      // Sicherheitsnetz: nie aus dem Raum herausfallen
      if (p.x < 4) { p.x = 4; p.ox = 4; }
      if (p.x > C.ROOM_PX_W - 4) { p.x = C.ROOM_PX_W - 4; p.ox = p.x; }
      if (p.y < 4) { p.y = 4; p.oy = 4; }
      if (p.y > C.ROOM_PX_H - 4) { p.y = C.ROOM_PX_H - 4; p.oy = p.y; }
    }

    // Abstände einhalten
    for (var pass = 0; pass < CONSTRAINT_PASSES; pass++) {
      for (i = 0; i < this.sticks.length; i++) {
        var s = this.sticks[i];
        var a = this.points[s.a], b = this.points[s.b];
        var dx = b.x - a.x, dy = b.y - a.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
        var diff = (d - s.len) / d * 0.5;
        var ox2 = dx * diff, oy2 = dy * diff;
        a.x += ox2; a.y += oy2;
        b.x -= ox2; b.y -= oy2;
      }
      // Kollision gegen dieselbe Weltgeometrie wie die Spielfigur
      for (i = 0; i < this.points.length; i++) {
        this.collidePoint(this.points[i]);
      }
    }
  };

  Ragdoll.prototype.collidePoint = function (p) {
    var cp = this.world.getSingleClosestPoint(p.x, p.y, POINT_RADIUS);
    if (cp.result === 0) return;
    var dx = p.x - cp.a, dy = p.y - cp.b;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.0001) return;
    var depth = POINT_RADIUS - dist * cp.result;
    if (depth <= 0) return;
    p.x += dx / dist * depth;
    p.y += dy / dist * depth;
    // Etwas Reibung an der Oberfläche, damit die Puppe liegen bleibt
    p.ox = p.x - (p.x - p.ox) * 0.6;
    p.oy = p.y - (p.y - p.oy) * 0.6;
  };

  Ragdoll.prototype.draw = function (ctx) {
    var alpha = Math.max(0, Math.min(1, this.life * 1.4));
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#eef3ff';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    var P = this.points;
    // Rumpf und Gliedmaßen
    var limbs = [[1, 3], [1, 4], [2, 5], [2, 6], [1, 2]];
    ctx.beginPath();
    for (var i = 0; i < limbs.length; i++) {
      ctx.moveTo(P[limbs[i][0]].x, P[limbs[i][0]].y);
      ctx.lineTo(P[limbs[i][1]].x, P[limbs[i][1]].y);
    }
    ctx.stroke();
    // Kopf
    ctx.fillStyle = '#eef3ff';
    ctx.beginPath();
    ctx.arc(P[0].x, P[0].y, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  BO.Ragdoll = Ragdoll;
})(typeof window !== 'undefined' ? window : globalThis);
