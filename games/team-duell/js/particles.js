/**
 * "Poof"-Partikeleffekte für Treffer (Spec, Sicherheits-Reskin: Treffer
 * sind abstrakte Partikel-Effekte, keine Verletzungsdarstellung). Ein
 * Ring-Burst für Schuss-/Wand-Treffer, ein größerer Wasser-Splash für
 * Wurf-Einschläge.
 */
(function (global) {
  'use strict';

  var TD = global.TD = global.TD || {};

  var list = [];

  var particles = {
    reset: function () {
      list.length = 0;
    },

    spawnPoof: function (x, y, color, count) {
      count = count || 8;
      for (var i = 0; i < count; i++) {
        var a = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        var speed = 0.6 + Math.random() * 1.6;
        list.push({
          x: x, y: y,
          vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
          life: 1, decay: 0.04 + Math.random() * 0.03,
          size: 1.2 + Math.random() * 1.6,
          color: color, gravity: 0,
        });
      }
    },

    // Winziger, sehr kurzlebiger Blitz am Schützen beim Abfeuern – rein
    // kosmetisch (Juice), kein Partikel-Burst wie ein Treffer.
    spawnMuzzle: function (x, y, color) {
      for (var i = 0; i < 4; i++) {
        var a = Math.random() * Math.PI * 2;
        var speed = 0.4 + Math.random() * 0.6;
        list.push({
          x: x, y: y,
          vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
          life: 1, decay: 0.14 + Math.random() * 0.06,
          size: 1 + Math.random(),
          color: color, gravity: 0,
        });
      }
    },

    // Konfetti-Regen für den Sieg-Screen: startet oben quer über dem Feld
    // verteilt und fällt mit leichter Schwerkraft nach unten, statt wie
    // die anderen Effekte von einem Punkt nach außen zu "poofen".
    spawnConfetti: function (canvasW, colors) {
      for (var i = 0; i < 46; i++) {
        list.push({
          x: Math.random() * canvasW, y: -6 - Math.random() * 40,
          vx: (Math.random() - 0.5) * 1.6, vy: 0.4 + Math.random() * 0.8,
          life: 1, decay: 0.006 + Math.random() * 0.006,
          size: 2 + Math.random() * 2.2,
          color: colors[i % colors.length], gravity: 0.03,
        });
      }
    },

    // Größerer, langsamerer Splash für Wurf-Einschläge (Treffer wie
    // Fehlschuss – sichtbares Feedback, wo der Wurf gelandet ist).
    spawnSplash: function (x, y, color) {
      for (var i = 0; i < 14; i++) {
        var a = (i / 14) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        var speed = 0.8 + Math.random() * 2.4;
        list.push({
          x: x, y: y,
          vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
          life: 1, decay: 0.022 + Math.random() * 0.018,
          size: 1.8 + Math.random() * 2.4,
          color: color, gravity: 0,
        });
      }
    },

    update: function () {
      for (var i = list.length - 1; i >= 0; i--) {
        var p = list[i];
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.94;
        p.vy *= 0.94;
        p.life -= p.decay;
        if (p.life <= 0) list.splice(i, 1);
      }
    },

    draw: function (ctx) {
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
  };

  TD.particles = particles;
})(window);
