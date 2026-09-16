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

  // Auswählbare Skins. Gleiche Silhouette, aber eigenes Kopfstück
  // (`head`), Gesicht (`face`) und Farbsatz.
  var CHARACTERS = [
    // Kopf komplett vermummt, nur ein schmaler Sehschlitz
    { id: 'ninja', name: 'Shadow', skin: '#2b2f3a', shirt: '#343b4a', shirtDark: '#232936',
      arm: '#2e3542', armDark: '#1e242f', pants: '#1b2029', shoe: '#4a5364',
      head: 'ninjaBand', face: 'ninjaSlit', cap: '#e63946', capDark: '#a02330' },

    { id: 'robot', name: 'Steel', skin: '#b9c3d1', shirt: '#7e8b9e', shirtDark: '#5c6878',
      arm: '#8e9aab', armDark: '#66727f', pants: '#4f5a68', shoe: '#39424e',
      head: 'antenna', face: 'visor', cap: '#5ee6ff', capDark: '#2a9cb8' },

    { id: 'penguin', name: 'Emperor', skin: '#20242e', shirt: '#2b303c', shirtDark: '#1d222c',
      arm: '#252a35', armDark: '#181d26', pants: '#20242e', shoe: '#ffb03a',
      head: 'none', face: 'beak', belly: '#f4f1ea', beak: '#ffb03a' },

    { id: 'wizard', name: 'Arcane', skin: '#ffd9a8', shirt: '#6b4ec4', shirtDark: '#4c3593',
      arm: '#5f45b0', armDark: '#3f2c7d', pants: '#2f2160', shoe: '#ffd15c',
      head: 'hat', face: 'beard', cap: '#8a6fe0', capDark: '#57409e', beard: '#f4f1ea' },
  ];

  var charById = {};
  CHARACTERS.forEach(function (c) { charById[c.id] = c; });


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

  function drawDeco(ctx, t, x, y, w, h) {
    var i;
    switch (t.deco) {
      case 'icicles': // Eiszapfen an der Unterkante
        ctx.fillStyle = t.base;
        for (i = x + 7; i < x + w - 5; i += 19) {
          var len = 3 + ((i * 7) % 4);
          ctx.beginPath();
          ctx.moveTo(i - 2, y + h);
          ctx.lineTo(i + 2, y + h);
          ctx.lineTo(i, y + h + len);
          ctx.closePath();
          ctx.fill();
        }
        break;

      case 'leaves': // Blätterbüschel obendrauf
        ctx.fillStyle = t.top;
        for (i = x + 6; i < x + w - 4; i += 22) {
          ctx.beginPath();
          ctx.ellipse(i, y - 1.5, 4, 2.2, ((i % 3) - 1) * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
        break;

      case 'cracks': // glühende Risse im dunklen Gestein
        ctx.strokeStyle = t.top;
        ctx.lineWidth = 1.2;
        for (i = x + 8; i < x + w - 6; i += 17) {
          ctx.beginPath();
          ctx.moveTo(i, y + 1);
          ctx.lineTo(i + 3, y + h - 1.5);
          ctx.stroke();
        }
        break;

      case 'circuit': // Leuchtkante mit Kontaktpunkten
        ctx.fillStyle = t.top;
        ctx.fillRect(x + 2, y + h - 1.4, w - 4, 1.2);
        for (i = x + 10; i < x + w - 8; i += 15) {
          ctx.beginPath();
          ctx.arc(i, y + h / 2, 1.3, 0, Math.PI * 2);
          ctx.fill();
        }
        break;

      case 'sprinkles': // bunte Streusel
        var cols = ['#5ee6ff', '#ffe66b', '#7dffb5', '#ff8fa3'];
        for (i = x + 6; i < x + w - 5; i += 11) {
          ctx.fillStyle = cols[(i / 11 | 0) % cols.length];
          ctx.fillRect(i, y + 1.4 + ((i % 2) * 1.6), 3, 1.3);
        }
        break;

      case 'bricks': // Fugen wie gemauert
        ctx.strokeStyle = t.deep;
        ctx.lineWidth = 1;
        for (i = x + 14; i < x + w - 6; i += 18) {
          ctx.beginPath();
          ctx.moveTo(i, y + 1);
          ctx.lineTo(i, y + h - 1);
          ctx.stroke();
        }
        break;

      case 'stars': // Sternenglitzer
        ctx.fillStyle = t.top;
        for (i = x + 9; i < x + w - 6; i += 16) {
          var r = 0.9 + ((i * 5) % 3) * 0.35;
          ctx.beginPath();
          ctx.arc(i, y + 2 + ((i % 3) * 1.2), r, 0, Math.PI * 2);
          ctx.fill();
        }
        break;

      case 'rivets': // Nieten wie an Stahlträgern
        for (i = x + 8; i < x + w - 6; i += 16) {
          ctx.fillStyle = t.deep;
          ctx.beginPath();
          ctx.arc(i, y + h / 2, 1.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = t.top;
          ctx.beginPath();
          ctx.arc(i - 0.4, y + h / 2 - 0.4, 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
    }
  }

  // Augen/Mund – manche Charaktere haben stattdessen Schnabel, Visier
  // oder Maske.
  function drawFace(ctx, CH, airborne) {
    if (CH.face === 'visor') {
      ctx.fillStyle = '#1b2430';
      roundRect(ctx, -4.4, -10.6, 8.8, 4.2, 2);
      ctx.fillStyle = '#5ee6ff';
      roundRect(ctx, -3.2, -9.8, 6.4, 2, 1);
      return;
    }
    if (CH.face === 'ninjaSlit') {
      // schmaler Sehschlitz im Tuch – nur die Augen blitzen heraus
      ctx.fillStyle = '#12161f';
      roundRect(ctx, -4.8, -10.2, 9.6, 3.4, 1.6);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(2.1, -8.5, 1.7, 1.3, 0, 0, Math.PI * 2);
      ctx.ellipse(-1.8, -8.5, 1.5, 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1b2430';
      ctx.beginPath();
      ctx.arc(2.7, -8.5, 0.85, 0, Math.PI * 2);
      ctx.arc(-1.3, -8.5, 0.8, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (CH.face === 'mask') {
      ctx.fillStyle = 'rgba(200, 240, 255, 0.55)';
      roundRect(ctx, -4.6, -11.4, 9.2, 5.6, 2.4);
      ctx.fillStyle = '#1b2430';
      ctx.beginPath();
      ctx.arc(2.0, -8.8, 1.3, 0, Math.PI * 2);
      ctx.arc(-1.6, -8.8, 1.2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    // Standard-Augen
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

    if (CH.face === 'lashes') {
      ctx.strokeStyle = '#1b2430';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(4.2, -10.2); ctx.lineTo(5.3, -10.9);
      ctx.moveTo(-3.6, -10.2); ctx.lineTo(-4.6, -10.8);
      ctx.stroke();
      ctx.strokeStyle = '#c2415c';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0.8, -6.4, 1.6, 0.12 * Math.PI, 0.88 * Math.PI);
      ctx.stroke();
      return;
    }
    if (CH.face === 'beak') {
      ctx.fillStyle = CH.beak || '#ffb03a';
      ctx.beginPath();
      ctx.moveTo(1.2, -7.2);
      ctx.lineTo(6.6, -6.2);
      ctx.lineTo(1.2, -4.8);
      ctx.closePath();
      ctx.fill();
      return;
    }
    if (CH.face === 'beard') {
      ctx.fillStyle = CH.beard || '#f4f1ea';
      ctx.beginPath();
      ctx.ellipse(0.4, -4.4, 4.6, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    ctx.strokeStyle = '#a8563a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (airborne) ctx.arc(0.8, -5.8, 1.4, 0, Math.PI);
    else ctx.arc(0.8, -6.4, 1.7, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  }

  // Kopfstück: Cap, Mütze, Helm, Hörner, Irokese ...
  function drawHead(ctx, CH) {
    var i;
    switch (CH.head) {
      case 'cap':
        ctx.fillStyle = CH.cap;
        ctx.beginPath();
        ctx.arc(0, -10.8, 5.4, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(-5.4, -11, 10.8, 1.3);
        ctx.fillStyle = CH.capDark;
        roundRect(ctx, 3.8, -11.1, 5.4, 1.9, 0.95);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, -15.6, 1.4, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'tuft': // Federbüschel über den Augen
        ctx.strokeStyle = CH.cap;
        ctx.lineWidth = 1.5;
        for (i = -1; i <= 1; i += 2) {
          ctx.beginPath();
          ctx.moveTo(i * 3.2, -12.4);
          ctx.quadraticCurveTo(i * 6.6, -14.4, i * 8.4, -12.2);
          ctx.stroke();
        }
        break;

      case 'ninjaBand': // Stirnband über der Maske, Ende flattert nach hinten
        ctx.fillStyle = CH.cap;
        ctx.fillRect(-5.3, -12.4, 10.6, 2.3);
        ctx.fillStyle = CH.capDark;
        roundRect(ctx, -10.2, -12.2, 5.2, 1.9, 0.9);
        roundRect(ctx, -9.4, -9.8, 4.2, 1.6, 0.8);
        break;

      case 'headband': // Stirnband der Kletterin
        ctx.fillStyle = CH.cap;
        roundRect(ctx, -5.4, -12.6, 10.8, 2.2, 1);
        ctx.fillStyle = CH.capDark;
        roundRect(ctx, 1.4, -12.5, 3.4, 2, 0.9);
        break;

      case 'band': // Stirnband mit flatterndem Ende
        ctx.fillStyle = CH.cap;
        ctx.fillRect(-5.3, -11.8, 10.6, 2.6);
        ctx.fillStyle = CH.capDark;
        roundRect(ctx, -9.4, -11.4, 4.6, 1.8, 0.9);
        break;

      case 'beanie': // Zipfelmütze
        ctx.fillStyle = CH.cap;
        ctx.beginPath();
        ctx.arc(0, -10.6, 5.4, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = CH.capDark;
        roundRect(ctx, -5.6, -11.2, 11.2, 2.2, 1.1);
        ctx.fillStyle = '#f4f1ea';
        ctx.beginPath();
        ctx.arc(-0.5, -16.4, 1.9, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'horns':
        ctx.fillStyle = CH.cap;
        for (i = -1; i <= 1; i += 2) {
          ctx.beginPath();
          ctx.moveTo(i * 3.4, -12.4);
          ctx.lineTo(i * 5.6, -16.4);
          ctx.lineTo(i * 1.8, -13.4);
          ctx.closePath();
          ctx.fill();
        }
        break;

      case 'antenna':
        ctx.strokeStyle = CH.capDark;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, -13.4);
        ctx.lineTo(0, -16.6);
        ctx.stroke();
        ctx.fillStyle = CH.cap;
        ctx.beginPath();
        ctx.arc(0, -17.4, 1.8, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'mohawk':
        ctx.fillStyle = CH.cap;
        for (i = 0; i < 5; i++) {
          var hx = -3.6 + i * 1.8;
          var hh = 4.4 - Math.abs(i - 2) * 1.1;
          ctx.beginPath();
          ctx.moveTo(hx - 0.9, -12.6);
          ctx.lineTo(hx, -12.6 - hh);
          ctx.lineTo(hx + 0.9, -12.6);
          ctx.closePath();
          ctx.fill();
        }
        break;

      case 'helmet':
        ctx.strokeStyle = CH.cap;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, -9, 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(158, 216, 255, 0.28)';
        ctx.beginPath();
        ctx.arc(0, -9, 6.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.beginPath();
        ctx.ellipse(-3, -11.6, 2, 1.1, -0.5, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'spikes':
        ctx.fillStyle = CH.cap;
        for (i = 0; i < 3; i++) {
          var sx2 = -3.4 + i * 3.2;
          ctx.beginPath();
          ctx.moveTo(sx2 - 1.3, -12.4);
          ctx.lineTo(sx2, -15.8);
          ctx.lineTo(sx2 + 1.3, -12.4);
          ctx.closePath();
          ctx.fill();
        }
        break;

      case 'hat': // Spitzhut
        ctx.fillStyle = CH.cap;
        ctx.beginPath();
        ctx.moveTo(-7.4, -12.2);
        ctx.lineTo(7.4, -12.2);
        ctx.lineTo(0.6, -21.8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = CH.capDark;
        roundRect(ctx, -7.8, -13, 15.6, 2, 1);
        break;

      case 'goggles': // Brille auf die Stirn geschoben
        ctx.fillStyle = CH.cap;
        roundRect(ctx, -5.6, -13.4, 11.2, 2.4, 1.1);
        ctx.fillStyle = CH.capDark;
        roundRect(ctx, -2.2, -13.2, 4.4, 2, 0.9);
        break;
    }
  }

  var sprites = {
    // theme: Eintrag aus C.PLANK_THEMES (wechselt alle 100 Etagen)
    drawFloor: function (ctx, floor, screenY, marked, theme) {
      var t = theme || C.PLANK_THEMES[0];
      var x = floor.plankX;
      var w = floor.plankWidth;
      var h = C.FLOOR_THICK;
      var y = screenY - h / 2;

      // Körper der Platte
      ctx.fillStyle = marked ? t.mark : t.base;
      roundRect(ctx, x, y, w, h, 3);

      // Unterkante als Tiefe
      ctx.fillStyle = marked ? t.markDeep : t.deep;
      roundRect(ctx, x, y + h - 2.5, w, 2.5, 1.2);

      // Glanzkante oben – darauf steht die Figur
      ctx.fillStyle = t.top;
      ctx.globalAlpha = marked ? 0.75 : 0.9;
      roundRect(ctx, x + 1.5, y, w - 3, 1.6, 0.8);
      ctx.globalAlpha = 1;

      drawDeco(ctx, t, x, y, w, h);
    },

    // Eigene Deko je Welt – ohne die wären die Welten nur Farbvarianten.
    drawDeco: function (ctx, theme, x, y, w, h) {
      drawDeco(ctx, theme, x, y, w, h);
    },

    drawGround: function (ctx, screenY, width) {
      var h = 10;
      var grad = ctx.createLinearGradient(0, screenY - h / 2, 0, screenY + h * 2);
      grad.addColorStop(0, '#8ef0ff');
      grad.addColorStop(1, '#1b4a6b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, screenY - h / 2, width, h * 3);
      ctx.fillStyle = '#ffffff';
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
    // charId: Eintrag aus CHARACTERS, Standard ist der erste.
    drawChar: function (ctx, screenX, screenY, pose, charId) {
      var CH = charById[charId] || CHARACTERS[0];
      var SKIN = CH.skin, SHIRT = CH.shirt, SHIRT_DARK = CH.shirtDark;
      var ARM = CH.arm, ARM_DARK = CH.armDark, PANTS = CH.pants, SHOE = CH.shoe;
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
      if (CH.belly) {
        ctx.fillStyle = CH.belly;
        roundRect(ctx, -3.2, -3.2, 6.4, 7, 2.6);
      } else {
        ctx.fillStyle = SHIRT_DARK;
        roundRect(ctx, -5, 2.4, 10, 1.8, 0.9); // Saum
      }

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

      drawFace(ctx, CH, airborne);
      drawHead(ctx, CH);

      ctx.restore();
    },
  };

  sprites.CHARACTERS = CHARACTERS;

  ET.sprites = sprites;
})(window);
