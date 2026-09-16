/**
 * Staubpartikel bei Landung.
 */
(function (global) {
  'use strict';

  var ET = global.ET = global.ET || {};
  var C = ET.constants;

  var list = [];

  var particles = {
    reset: function () {
      list.length = 0;
    },

    spawnLandDust: function (x, y) {
      for (var i = 0; i < C.DUST_PARTICLE_COUNT; i++) {
        var angle = Math.PI + Math.random() * Math.PI; // nach oben halbkreisförmig weg
        var speed = 0.8 + Math.random() * 1.6;
        list.push({
          x: x,
          y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed * 0.6,
          life: 1,
          decay: 0.04 + Math.random() * 0.03,
          size: 1.4 + Math.random() * 1.6,
          color: '#d8d2c4',
        });
      }
    },

    update: function () {
      for (var i = list.length - 1; i >= 0; i--) {
        var p = list[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06;
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

  ET.particles = particles;
})(window);
