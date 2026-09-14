/**
 * Explosions-Partikel beim Tod eines Spielers (Ninja-Stil, aber als
 * Ring statt Staub – siehe DEV/README "Game Feel/Juice ergänzen").
 */
(function (global) {
  'use strict';

  var KS = global.KS = global.KS || {};
  var C = KS.constants;

  var list = [];

  var particles = {
    reset: function () {
      list.length = 0;
    },

    spawnBurst: function (x, y, color) {
      for (var i = 0; i < C.DEATH_PARTICLE_COUNT; i++) {
        var a = (i / C.DEATH_PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        var speed = 1 + Math.random() * 2.2;
        list.push({
          x: x,
          y: y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          life: 1,
          decay: 0.025 + Math.random() * 0.02,
          size: 1.5 + Math.random() * 2,
          color: color,
        });
      }
    },

    update: function () {
      for (var i = list.length - 1; i >= 0; i--) {
        var p = list[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96;
        p.vy *= 0.96;
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

  KS.particles = particles;
})(window);
