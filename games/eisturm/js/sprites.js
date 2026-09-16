/**
 * Zeichnen von Figur und Etagen – alles prozedural mit Canvas-Primitiven,
 * keine Bilddateien (bleibt beim Repo-Prinzip "läuft ohne Build-Schritt").
 *
 * Die Figur ist in einem lokalen System gezeichnet: (0,0) ist ihr
 * Mittelpunkt, der Fußpunkt liegt bei +CHAR_R, der Scheitel bei -CHAR_R.
 * Gestaucht/gestreckt wird um den Fußpunkt, damit sie bei der Landung
 * auf der Plattform stehen bleibt statt in sie hineinzurutschen.
 */
(function (global) {
  'use strict';

  var ET = global.ET = global.ET || {};
  var C = ET.constants;

  var SKIN = '#ffd9a8';
  var CAP = '#e63946';
  var CAP_DARK = '#b02a37';
  var SHIRT = '#ffb03a';
  var SHIRT_DARK = '#e08a1e';
  var ARM = '#f59824'; // etwas dunkler als das Shirt, damit sich die Arme absetzen
  var ARM_DARK = '#d17d16';
  var PANTS = '#2d4a6b';
  var SHOE = '#f4f1ea';

  var ICE = '#bfe9ff';
  var ICE_TOP = '#ffffff';
  var ICE_DEEP = '#6ba7cc';
  var ICE_MARK = '#ffd15c';
  var ICE_MARK_DEEP = '#c9962c';

  function roundRect(ctx, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
    ctx.fill();
  }

  // ---------- Etagen ----------

  var sprites = {
    drawFloor: function (ctx, floor, screenY, marked) {
      var x = floor.plankX;
      var w = floor.plankWidth;
      var h = C.FLOOR_THICK;
      var y = screenY - h / 2;

      // Körper der Eisplatte
      ctx.fillStyle = marked ? ICE_MARK : ICE;
      roundRect(ctx, x, y, w, h, 3);

      // Unterkante als Tiefe
      ctx.fillStyle = marked ? ICE_MARK_DEEP : ICE_DEEP;
      roundRect(ctx, x, y + h - 2.5, w, 2.5, 1.2);

      // Glanzkante oben – darauf steht die Figur
      ctx.fillStyle = ICE_TOP;
      ctx.globalAlpha = marked ? 0.75 : 0.9;
      roundRect(ctx, x + 1.5, y, w - 3, 1.6, 0.8);
      ctx.globalAlpha = 1;

      // Ein paar Eis-Sprenkel für Struktur
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      var step = 26;
      for (var sx = x + 8; sx < x + w - 6; sx += step) {
        ctx.fillRect(sx, y + h - 4, 4, 1);
      }
    },

    drawGround: function (ctx, screenY, width) {
      var h = 10;
      var grad = ctx.createLinearGradient(0, screenY - h / 2, 0, screenY + h * 2);
      grad.addColorStop(0, '#8ef0ff');
      grad.addColorStop(1, '#1b4a6b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, screenY - h / 2, width, h * 3);
      ctx.fillStyle = ICE_TOP;
      ctx.fillRect(0, screenY - h / 2, width, 2);
    },

    // ---------- Figur ----------
    //
    // Bewusst höher gezeichnet als der (unsichtbare) Kollisionskreis:
    // die Sohle liegt exakt auf +CHAR_R, nach oben darf die Figur über
    // -CHAR_R hinausragen. Bei nur 24 px Kreisdurchmesser würde sie sonst
    // zum Klotz. Aufbau von oben nach unten:
    //   Bommel -16 | Cap -15..-10 | Kopf -14..-4 | Körper -4..+4
    //   Beine +3.5..+10 | Schuhe +9..+12
    //
    // pose: { vx, vy, grounded, facing, squash, runPhase, speedFactor }
    drawChar: function (ctx, screenX, screenY, pose) {
      var R = C.CHAR_R;
      var s = Math.max(-0.7, Math.min(0.7, pose.squash));
      var sx = 1 + s * 0.45;
      var sy = 1 - s * 0.45;
      var dir = pose.facing || 1;
      var airborne = !pose.grounded;
      var rising = airborne && pose.vy < 0;
      var speed = Math.min(1, Math.abs(pose.vx) / C.MAX_RUN_SPEED);
      var swing = pose.grounded ? Math.sin(pose.runPhase) * speed : 0;

      ctx.save();
      ctx.translate(screenX, screenY + R);
      ctx.scale(sx, sy);
      ctx.translate(0, -R);

      // Weicher Schimmer bei Höchsttempo (dezent, nur ein Hauch)
      if (speed > 0.7) {
        var glow = ctx.createRadialGradient(0, -3, R * 0.4, 0, -3, R * 2.1);
        glow.addColorStop(0, 'rgba(255, 209, 92, ' + ((speed - 0.7) * 0.6).toFixed(2) + ')');
        glow.addColorStop(1, 'rgba(255, 209, 92, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, -3, R * 2.1, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.scale(dir, 1); // Figur ist nach rechts gezeichnet, dir spiegelt sie

      // --- hinterer Arm (liegt hinter dem Körper) ---
      ctx.fillStyle = ARM_DARK;
      if (rising) roundRect(ctx, -8.4, -9.6, 3, 7, 1.5);
      else if (airborne) roundRect(ctx, -8.6, -4.5, 3, 7, 1.5);
      else roundRect(ctx, -7.8 - swing * 1.5, -3.4 + swing * 1.2, 3, 7, 1.5);
      ctx.fillStyle = SKIN;
      if (rising) { ctx.beginPath(); ctx.arc(-6.9, -2.9, 1.75, 0, Math.PI * 2); ctx.fill(); }
      else if (airborne) { ctx.beginPath(); ctx.arc(-7.1, 2.2, 1.75, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(-6.3 - swing * 1.5, 3.3 + swing * 1.2, 1.75, 0, Math.PI * 2); ctx.fill(); }

      // --- Beine ---
      ctx.fillStyle = PANTS;
      if (rising) {
        roundRect(ctx, -4.2, 3.2, 3.8, 4.6, 1.6); // angezogen
        roundRect(ctx, 0.5, 3.6, 3.8, 4.4, 1.6);
      } else if (airborne) {
        roundRect(ctx, -4.4, 3.5, 3.8, 6.8, 1.6); // gestreckt im Fall
        roundRect(ctx, 0.7, 3.5, 3.8, 5.8, 1.6);
      } else {
        roundRect(ctx, -4.2 + swing * 2.5, 3.5, 3.8, 6.6, 1.6);
        roundRect(ctx, 0.5 - swing * 2.5, 3.5, 3.8, 6.6, 1.6);
      }

      // --- Schuhe (Sohle immer bei +R = auf der Plattform) ---
      ctx.fillStyle = SHOE;
      if (rising) {
        roundRect(ctx, -5.2, 7.0, 4.8, 2.8, 1.4);
        roundRect(ctx, 0.2, 7.4, 4.8, 2.8, 1.4);
      } else if (airborne) {
        roundRect(ctx, -5.4, 9.4, 4.8, 2.6, 1.3);
        roundRect(ctx, 0.4, 8.6, 5.0, 2.6, 1.3);
      } else {
        roundRect(ctx, -5.2 + swing * 2.5, 9.3, 4.9, 2.7, 1.35);
        roundRect(ctx, 0.3 - swing * 2.5, 9.3, 4.9, 2.7, 1.35);
      }

      // --- Körper ---
      ctx.fillStyle = SHIRT;
      roundRect(ctx, -5, -4.2, 10, 8.4, 2.8);
      ctx.fillStyle = SHIRT_DARK;
      roundRect(ctx, -5, 2.4, 10, 1.8, 0.9); // Saum

      // --- vorderer Arm + Hand ---
      ctx.fillStyle = ARM;
      var armX, armY;
      if (rising) { armX = 5.4; armY = -9.6; }
      else if (airborne) { armX = 5.6; armY = -4.5; }
      else { armX = 4.8 + swing * 1.5; armY = -3.4 - swing * 1.2; }
      roundRect(ctx, armX, armY, 3, 7, 1.5);
      ctx.fillStyle = SKIN;
      ctx.beginPath();
      ctx.arc(armX + 1.5, armY + 6.8, 1.75, 0, Math.PI * 2);
      ctx.fill();

      // --- Kopf ---
      ctx.fillStyle = SKIN;
      ctx.beginPath();
      ctx.arc(0, -9, 5.2, 0, Math.PI * 2);
      ctx.fill();

      // --- Augen ---
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(2.2, -8.8, 2.0, 0, Math.PI * 2);
      ctx.arc(-1.7, -8.8, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1b2430';
      ctx.beginPath();
      ctx.arc(2.9, -8.8, 1.0, 0, Math.PI * 2);
      ctx.arc(-1.1, -8.8, 0.9, 0, Math.PI * 2);
      ctx.fill();

      // --- Mund: offen beim Fliegen, Grinsen am Boden ---
      ctx.strokeStyle = '#a8563a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (airborne) ctx.arc(0.8, -5.8, 1.4, 0, Math.PI);
      else ctx.arc(0.8, -6.4, 1.7, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();

      // --- Cap: Kuppel oben auf dem Kopf, Schirm nach vorn ---
      ctx.fillStyle = CAP;
      ctx.beginPath();
      ctx.arc(0, -10.8, 5.4, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(-5.4, -11, 10.8, 1.3);
      ctx.fillStyle = CAP_DARK;
      roundRect(ctx, 3.8, -11.1, 5.4, 1.9, 0.95); // Schirm
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, -15.6, 1.4, 0, Math.PI * 2); // Bommel
      ctx.fill();

      ctx.restore();
    },
  };

  ET.sprites = sprites;
})(window);
