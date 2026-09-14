/**
 * Staubpartikel bei Wandkontakt.
 */
(function (global) {
  'use strict';

  var NW = global.NW = global.NW || {};
  var C = NW.constants;

  var list = [];

  var particles = {
    reset: function () {
      list.length = 0;
    },

    // dirX: +1 = Partikel fliegen nach rechts weg (Ninja landet an linker Wand), -1 = nach links
    spawnDust: function (x, y, dirX) {
      for (var i = 0; i < C.DUST_PARTICLE_COUNT; i++) {
        var spread = (Math.random() - 0.5) * 1.4;
        var speed = 1.2 + Math.random() * 1.8;
        list.push({
          x: x,
          y: y,
          vx: dirX * (0.6 + Math.random() * 1.2) + spread,
          vy: -speed * 0.4 - Math.random() * 0.6,
          life: 1,
          decay: 0.035 + Math.random() * 0.03,
          size: 1.5 + Math.random() * 1.8,
        });
      }
    },

    update: function () {
      for (var i = list.length - 1; i >= 0; i--) {
        var p = list[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // leichte Schwerkraft auf den Staub
        p.life -= p.decay;
        if (p.life <= 0) list.splice(i, 1);
      }
    },

    draw: function (ctx, cameraY) {
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = '#d8d2c4';
        ctx.beginPath();
        ctx.arc(p.x, p.y - cameraY, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
  };

  NW.particles = particles;
})(window);
