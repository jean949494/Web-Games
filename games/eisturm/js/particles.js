/**
 * Staubpartikel bei Landung, Funken beim Wandabprall.
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

    // dirX: Richtung, in die die Funken wegfliegen (weg von der Wand)
    // power: 0..1, skaliert Menge und Wucht des Funkenschlags
    spawnWallSpark: function (x, y, dirX, power) {
      var p = Math.max(0, Math.min(1, power == null ? 0.5 : power));
      var count = Math.round(6 + p * 12);
      for (var i = 0; i < count; i++) {
        var spread = (Math.random() - 0.5) * (1.6 + p * 2.2);
        var speed = (1.2 + Math.random() * 1.8) * (1 + p * 1.3);
        list.push({
          x: x,
          y: y,
          vx: dirX * speed,
          vy: spread,
          life: 1,
          decay: 0.055 + Math.random() * 0.03,
          size: (1.5 + Math.random() * 1.3) * (1 + p * 0.5),
          color: p > 0.6 ? '#ffd15c' : '#5ee6ff',
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
