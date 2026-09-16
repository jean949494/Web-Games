/**
 * Partikel: Eisstaub bei Wandkontakt, Triebwerk-Funken während des Flugs,
 * Laser-Funken (aktuell ungenutzt, für spätere Erweiterung vorbereitet).
 */
(function (global) {
  'use strict';

  var NW = global.NW = global.NW || {};
  var C = NW.constants;

  var list = [];

  function spawn(p) {
    list.push(p);
  }

  var particles = {
    reset: function () {
      list.length = 0;
    },

    // dirX: +1 = Partikel fliegen nach rechts weg (Astro landet an linker Wand), -1 = nach links
    spawnDust: function (x, y, dirX) {
      for (var i = 0; i < C.DUST_PARTICLE_COUNT; i++) {
        var spread = (Math.random() - 0.5) * 1.4;
        var speed = 1.2 + Math.random() * 1.8;
        spawn({
          x: x,
          y: y,
          vx: dirX * (0.6 + Math.random() * 1.2) + spread,
          vy: -speed * 0.4 - Math.random() * 0.6,
          life: 1,
          decay: 0.035 + Math.random() * 0.03,
          size: 1.5 + Math.random() * 1.8,
          color: '#cfe6f2',
        });
      }
    },

    // Kurzer Flammenstoß während des Flugs, entgegen der Flugrichtung.
    spawnThrust: function (x, y, dirX) {
      var flame = Math.random() < 0.5 ? '#ffb15c' : '#7fd8e8';
      spawn({
        x: x + (Math.random() - 0.5) * 2,
        y: y,
        vx: dirX * (0.3 + Math.random() * 0.5),
        vy: 0.8 + Math.random() * 0.8,
        life: 1,
        decay: 0.12 + Math.random() * 0.08,
        size: 1.2 + Math.random() * 1.4,
        color: flame,
      });
    },

    update: function () {
      for (var i = list.length - 1; i >= 0; i--) {
        var p = list[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.life -= p.decay;
        if (p.life <= 0) list.splice(i, 1);
      }
    },

    draw: function (ctx, cameraY) {
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y - cameraY, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
  };

  NW.particles = particles;
})(window);
