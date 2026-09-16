/**
 * Regenbogen-Schweif hinter der Figur – das optische Markenzeichen von
 * Icy Tower. Taucht erst ab einem gewissen Lauftempo auf, wird mit dem
 * Tempo breiter und bunter; während einer laufenden Combo-Serie bleibt
 * er zusätzlich an.
 */
(function (global) {
  'use strict';

  var ET = global.ET = global.ET || {};
  var C = ET.constants;

  var points = [];
  var hue = 0;

  var trail = {
    reset: function () {
      points.length = 0;
      hue = 0;
    },

    // intensity: 0..1 (aus Lauftempo bzw. Combo abgeleitet)
    push: function (x, y, intensity) {
      if (intensity <= 0) return;
      hue = (hue + C.TRAIL_HUE_STEP) % 360;
      points.push({ x: x, y: y, hue: hue, life: 1, intensity: intensity });
      if (points.length > C.TRAIL_MAX_POINTS) points.shift();
    },

    update: function () {
      for (var i = points.length - 1; i >= 0; i--) {
        points[i].life -= C.TRAIL_FADE;
        if (points[i].life <= 0) points.splice(i, 1);
      }
    },

    draw: function (ctx, cameraY) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter'; // Farben addieren sich -> leuchtet
      for (var i = 0; i < points.length; i++) {
        var p = points[i];
        var r = C.CHAR_R * (0.35 + 0.5 * p.intensity) * p.life;
        if (r <= 0.3) continue;
        ctx.globalAlpha = p.life * p.life * 0.55 * p.intensity;
        ctx.fillStyle = 'hsl(' + p.hue + ', 100%, 60%)';
        ctx.beginPath();
        ctx.arc(p.x, p.y - cameraY, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    },
  };

  ET.trail = trail;
})(window);
