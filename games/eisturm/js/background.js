/**
 * Hintergrund je Welt.
 *
 * Jede der zehn Welten (PLANK_THEMES in constants.js) bringt ihren eigenen
 * Himmel mit: einen Farbverlauf plus ein Deko-Feld, das mit Parallaxe
 * langsamer mitscrollt als die Etagen. Beim Weltenwechsel blendet game.js
 * den alten Hintergrund über BG_FADE_MS auf den neuen (siehe drawBackground
 * dort) – ein harter Schnitt mitten im Sprung würde sonst reißen.
 *
 * Das Deko-Feld ist NICHT zufällig gewürfelt, sondern aus den Zell-
 * koordinaten gehasht: derselbe Ausschnitt sieht beim Zurückfallen wieder
 * gleich aus, und es muss nichts gespeichert werden.
 */
(function (global) {
  'use strict';

  var ET = global.ET = global.ET || {};
  var C = ET.constants;

  // Deterministischer Pseudo-Zufall 0..1 aus zwei Zellkoordinaten.
  function hash(a, b, salt) {
    var h = (a | 0) * 374761393 + (b | 0) * 668265263 + (salt | 0) * 2246822519;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) >>> 0) / 4294967296;
  }

  /**
   * Läuft ein gekacheltes Feld ab und ruft draw(x, y, r1, r2, r3) für jede
   * sichtbare Zelle auf. cell = Kantenlänge, parallax = wie stark das Feld
   * mitwandert (0 = steht fest, 1 = wie die Etagen).
   */
  function field(camY, cell, parallax, salt, draw) {
    var offset = camY * parallax;
    var first = Math.floor((offset - cell) / cell);
    var last = Math.ceil((offset + C.CANVAS_H + cell) / cell);
    var cols = Math.ceil(C.CANVAS_W / cell) + 1;

    for (var row = first; row <= last; row++) {
      for (var col = 0; col < cols; col++) {
        var r1 = hash(col, row, salt);
        var r2 = hash(col, row, salt + 17);
        var r3 = hash(col, row, salt + 101);
        var x = col * cell + r1 * cell;
        var y = row * cell + r2 * cell - offset;
        draw(x, y, r1, r2, r3);
      }
    }
  }

  function clouds(ctx, camY, color) {
    ctx.fillStyle = color;
    field(camY, 150, 0.22, 3, function (x, y, r1, r2, r3) {
      if (r3 > 0.75) return;
      var w = 34 + r3 * 46;
      var h = w * 0.42;
      ctx.beginPath();
      ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
      ctx.ellipse(x + w * 0.65, y + h * 0.25, w * 0.6, h * 0.7, 0, 0, Math.PI * 2);
      ctx.ellipse(x - w * 0.6, y + h * 0.3, w * 0.55, h * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Rostwerk: schwere Träger und Rohre im Hintergrund
  function pipes(ctx, camY, color) {
    ctx.fillStyle = color;
    field(camY, 170, 0.3, 11, function (x, y, r1, r2, r3) {
      if (r3 > 0.8) return;
      if (r1 < 0.5) {
        ctx.fillRect(x - 60, y, 120, 13); // liegender Träger
        ctx.fillRect(x - 60, y + 13, 120, 3);
      } else {
        ctx.fillRect(x, y - 50, 15, 100); // stehendes Rohr
        ctx.beginPath();
        ctx.arc(x + 7.5, y - 50, 11, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  // Wüstenruine: zerbrochene Säulen in der Ferne
  function pillars(ctx, camY, color) {
    ctx.fillStyle = color;
    field(camY, 160, 0.26, 23, function (x, y, r1, r2, r3) {
      if (r3 > 0.62) return;
      var w = 20 + r1 * 16;
      var h = 60 + r3 * 70;
      ctx.fillRect(x, y, w, h);
      ctx.fillRect(x - 5, y, w + 10, 8); // Kapitell
    });
  }

  function bubbles(ctx, camY, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    field(camY, 90, 0.38, 31, function (x, y, r1, r2, r3) {
      if (r3 > 0.55) return;
      ctx.beginPath();
      ctx.arc(x, y, 3 + r3 * 9, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  function embers(ctx, camY, color, timeMs) {
    ctx.fillStyle = color;
    field(camY, 80, 0.45, 41, function (x, y, r1, r2, r3) {
      if (r3 > 0.5) return;
      // leichtes Flackern und Aufsteigen, damit die Glut lebt
      var drift = ((timeMs * (0.012 + r1 * 0.02)) % 80);
      var alpha = 0.25 + 0.55 * Math.abs(Math.sin(timeMs * 0.002 + r2 * 6.3));
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(x, y - drift, 1.2 + r3 * 3.2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  // Uhrwerk: große, langsam drehende Zahnräder
  function cogs(ctx, camY, color, timeMs) {
    ctx.fillStyle = color;
    field(camY, 190, 0.2, 53, function (x, y, r1, r2, r3) {
      if (r3 > 0.55) return;
      var rad = 26 + r3 * 34;
      var teeth = 10;
      var spin = timeMs * 0.0004 * (r1 < 0.5 ? 1 : -1);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(spin);
      ctx.beginPath();
      ctx.arc(0, 0, rad * 0.72, 0, Math.PI * 2);
      ctx.fill();
      for (var t = 0; t < teeth; t++) {
        var a = (t / teeth) * Math.PI * 2;
        ctx.save();
        ctx.rotate(a);
        ctx.fillRect(-rad * 0.14, -rad, rad * 0.28, rad * 0.32);
        ctx.restore();
      }
      ctx.restore();
    });
  }

  function candy(ctx, camY, color) {
    field(camY, 110, 0.3, 61, function (x, y, r1, r2, r3) {
      if (r3 > 0.7) return;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(r1 * Math.PI);
      ctx.fillStyle = color;
      if (r2 < 0.5) {
        ctx.beginPath(); // Bonbon
        ctx.arc(0, 0, 5 + r3 * 7, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-2, -11, 4, 22); // Streusel
      }
      ctx.restore();
    });
  }

  // Neonlabor: Leiterbahn-Raster mit glimmenden Knoten
  function grid(ctx, camY, color) {
    var cell = 46;
    var offset = (camY * 0.35) % cell;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var x = 0; x <= C.CANVAS_W; x += cell) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, C.CANVAS_H);
    }
    for (var y = -cell; y <= C.CANVAS_H + cell; y += cell) {
      var yy = Math.round(y - offset) + 0.5;
      ctx.moveTo(0, yy);
      ctx.lineTo(C.CANVAS_W, yy);
    }
    ctx.stroke();

    ctx.fillStyle = color;
    field(camY, cell, 0.35, 71, function (px, py, r1, r2, r3) {
      if (r3 > 0.22) return;
      ctx.beginPath();
      ctx.arc(Math.round(px / cell) * cell, Math.round(py / cell) * cell, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Gewitterfront: Wolkenbänke, dazu ab und zu ein Blitz über den Himmel
  function storm(ctx, camY, color, timeMs) {
    ctx.fillStyle = 'rgba(90, 100, 120, 0.18)';
    field(camY, 140, 0.24, 83, function (x, y, r1, r2, r3) {
      if (r3 > 0.7) return;
      ctx.beginPath();
      ctx.ellipse(x, y, 60 + r3 * 50, 16 + r3 * 12, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // Blitzzyklus: alle ~2,6 s ein kurzer Doppelschlag
    var cycle = timeMs % 2600;
    if (cycle < 160) {
      var flash = cycle < 60 ? 1 : (cycle < 100 ? 0.25 : 0.7);
      ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.16 * flash) + ')';
      ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

      var seed = Math.floor(timeMs / 2600);
      var bx = 40 + hash(seed, 7, 97) * (C.CANVAS_W - 80);
      ctx.strokeStyle = color;
      ctx.globalAlpha = flash;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx, -10);
      for (var s = 1; s <= 6; s++) {
        bx += (hash(seed, s, 13) - 0.5) * 46;
        ctx.lineTo(bx, s * (C.CANVAS_H / 6));
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function stars(ctx, camY, color, timeMs) {
    ctx.fillStyle = color;
    field(camY, 62, 0.12, 103, function (x, y, r1, r2, r3) {
      if (r3 > 0.62) return;
      ctx.globalAlpha = 0.25 + 0.65 * Math.abs(Math.sin(timeMs * 0.0012 + r1 * 6.3));
      var s = 0.8 + r3 * 1.9;
      ctx.fillRect(x, y, s, s);
    });
    ctx.globalAlpha = 1;

    // ein ferner Planet, langsam vorbeiziehend – einmal gerendert und
    // danach nur noch kopiert, statt je Bild einen Verlauf zu bauen
    field(camY, 460, 0.07, 113, function (x, y, r1, r2, r3) {
      if (r3 > 0.5) return;
      var pl = planetSprite(Math.round(26 + r3 * 26));
      ctx.drawImage(pl, x - pl.width / 2, y - pl.height / 2);
    });
  }

  // Farbverläufe einmal bauen und behalten. Sie hängen nur an der Welt
  // (bzw. am Radius), ändern sich also nie – sie in jedem Bild neu zu
  // erzeugen war auf schwachen Geräten der teuerste Teil des Hintergrunds.
  var skyCache = null;
  function skyFill(ctx, bg) {
    if (!skyCache) skyCache = {};
    var key = bg.sky[0] + bg.sky[1];
    if (!skyCache[key]) {
      var g = ctx.createLinearGradient(0, 0, 0, C.CANVAS_H);
      g.addColorStop(0, bg.sky[0]);
      g.addColorStop(1, bg.sky[1]);
      skyCache[key] = g;
    }
    return skyCache[key];
  }

  var planetCache = {};
  function planetSprite(rad) {
    if (planetCache[rad]) return planetCache[rad];
    var cv = global.document.createElement('canvas');
    cv.width = cv.height = rad * 2;
    var cx = cv.getContext('2d');
    var g = cx.createRadialGradient(rad * 0.7, rad * 0.7, rad * 0.2, rad, rad, rad);
    g.addColorStop(0, 'rgba(150, 120, 220, 0.55)');
    g.addColorStop(1, 'rgba(50, 35, 90, 0.35)');
    cx.fillStyle = g;
    cx.beginPath();
    cx.arc(rad, rad, rad, 0, Math.PI * 2);
    cx.fill();
    planetCache[rad] = cv;
    return cv;
  }

  var DECOS = {
    clouds: clouds, pipes: pipes, pillars: pillars, bubbles: bubbles, embers: embers,
    cogs: cogs, candy: candy, grid: grid, storm: storm, stars: stars,
  };

  ET.background = {
    /** Malt Himmel + Deko einer Welt vollflächig. */
    draw: function (ctx, theme, camY, timeMs) {
      var bg = theme.bg;
      ctx.fillStyle = skyFill(ctx, bg);
      ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

      var deco = DECOS[bg.deco];
      if (deco) deco(ctx, camY, bg.dec, timeMs);
    },
  };
})(window);
