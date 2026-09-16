/**
 * Eisturm – Spiellogik & Rendering.
 *
 * Icy-Tower-Mechanik: Etagen mit einer Lücke, Anlauftempo bestimmt
 * Sprunghöhe/-weite, "Combo" fürs Überspringen mehrerer Etagen in einem
 * einzigen Sprung. Neu (statt Tastatur/Timing) ist die Steuerung per
 * Neigung/Tippen/Halten – siehe input.js. Diese Datei kennt nur zwei
 * Eingaben: setSteer(-1..1) (stufenlose Laufrichtung/-tempo) und jump()
 * (löst einen Sprung aus, wenn gerade auf einer Etage gestanden wird).
 *
 * Kollisionsmodell (bewusst vereinfacht, kein Sub-Pixel-Sweep):
 * Etagen sind waagerechte Linien mit einer Lücke. Wird eine Etage beim
 * Steigen (vy<0) außerhalb der Lücke gekreuzt, "stößt" die Figur an und
 * der Sprung endet sofort (Icy-Tower-typische Strafe fürs Verfehlen).
 * Wird sie beim Fallen (vy>0) außerhalb der Lücke gekreuzt, landet die
 * Figur darauf. Innerhalb der Lücke wird jede Etage einfach durchquert
 * (beim Steigen zählt das als "geschafft" fürs Combo, beim Fallen ist es
 * ein Durchfallen). Während des Stehens auf einer Etage fällt die Figur
 * durch, sobald sie in die Lücke hineinläuft (Icy-Tower-typisches
 * Herunterfallen bei zu forschem Auslaufen).
 */
(function (global) {
  'use strict';

  var ET = global.ET = global.ET || {};
  var SG = global.SG;
  var C = ET.constants;

  var STEP_MS = 1000 / 60;
  var MAX_STEPS_PER_FRAME = 8;

  var STATES = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', GAMEOVER: 'gameover' };

  var canvas, ctx;
  var state = STATES.MENU;
  var changeListeners = [];

  var chr, camera, floors, nextFloorY, score, best, bonusScore, airCombo, flashes, accMs, lastTs, rafId;
  var steerFactor = 0; // -1..1, von input.js gesetzt (Neigung, Zone-Halten oder Tastatur)

  function emitChange(extra) {
    var payload = Object.assign({ state: state, score: currentScore(), best: best || 0 }, extra || {});
    changeListeners.forEach(function (cb) {
      try { cb(payload); } catch (e) { /* Listener-Fehler nie das Spiel stören lassen */ }
    });
  }

  function heightClimbed() {
    return Math.max(0, chr.startY - chr.y);
  }

  function currentScore() {
    return Math.floor((chr ? chr.maxHeight : 0) + (bonusScore || 0));
  }

  function inGap(floor, x, r) {
    if (floor.gapWidth <= 0) return false; // Boden-Etage: keine Lücke
    return x - r >= floor.gapX && x + r <= floor.gapX + floor.gapWidth;
  }

  function resetWorld() {
    var groundY = C.CANVAS_H - C.START_Y_FROM_BOTTOM;
    var groundFloor = { y: groundY, gapX: 0, gapWidth: 0, passed: true, isGround: true };

    chr = {
      x: C.CANVAS_W / 2,
      y: groundY - C.CHAR_R,
      vx: 0,
      vy: 0,
      grounded: true,
      floor: groundFloor,
      facing: 1,
      squash: 0,
      startY: groundY - C.CHAR_R, // = chr.y beim Start, sonst würde die Höhe/Score schon mit CHAR_R starten
      maxHeight: 0,
    };
    camera = { y: 0 };
    floors = [groundFloor];
    nextFloorY = groundY - (C.FLOOR_SPACING + Math.random() * C.FLOOR_SPACING_JITTER);
    score = 0;
    bonusScore = 0;
    airCombo = 0;
    flashes = [];
    steerFactor = 0;
    ET.particles.reset();
    ensureFloorsAhead();
  }

  function ensureFloorsAhead() {
    var horizon = camera.y - C.CANVAS_H * 2.2;
    while (nextFloorY > horizon) {
      var gapWidth = C.gapWidthAt(heightClimbed());
      var margin = C.EDGE_MARGIN + C.CHAR_R + 4;
      var gapX = margin + Math.random() * Math.max(10, C.CANVAS_W - margin * 2 - gapWidth);
      floors.push({ y: nextFloorY, gapX: gapX, gapWidth: gapWidth, passed: false });
      nextFloorY -= C.FLOOR_SPACING + (Math.random() * C.FLOOR_SPACING_JITTER * 2 - C.FLOOR_SPACING_JITTER);
    }
  }

  function pruneOldFloors() {
    while (floors.length && !floors[0].isGround && floors[0].y - camera.y > C.CANVAS_H + C.PRUNE_MARGIN) {
      floors.shift();
    }
  }

  function killChar(reason) {
    if (state !== STATES.PLAYING) return;
    state = STATES.GAMEOVER;
    var finalScore = currentScore();
    score = finalScore;
    var isNewBest = SG.storage.setBest(ET.GAME_ID, finalScore);
    best = SG.storage.getBest(ET.GAME_ID);
    SG.audio.playGameOver();
    SG.poki.gameplayStop();
    SG.analytics.track('game_over', { reason: reason, score: finalScore, best: best, newBest: isNewBest });
    emitChange({ reason: reason, newBest: isNewBest });
  }

  function doJump() {
    if (state !== STATES.PLAYING) return;
    if (!chr.grounded) return;
    var speedFactor = Math.min(1, Math.abs(chr.vx) / C.MAX_RUN_SPEED);
    chr.grounded = false;
    chr.floor = null;
    chr.vy = C.JUMP_VY_BASE + C.JUMP_VY_BONUS * speedFactor;
    airCombo = 0;
    SG.audio.unlock();
    ET.sounds.playJump(speedFactor);
    SG.analytics.track('jump', { speedFactor: Math.round(speedFactor * 100) / 100 });
  }

  function onLand(floor, comboCount) {
    chr.grounded = true;
    chr.floor = floor;
    chr.vy = 0;
    chr.squash = C.SQUASH_LAND;
    ET.particles.spawnLandDust(chr.x, floor.y);
    ET.sounds.playLand();
    if (comboCount >= C.COMBO_MIN_FOR_BONUS) {
      bonusScore += comboCount * C.COMBO_BONUS_PER_FLOOR;
      flashes.push({ x: chr.x, y: floor.y, life: 1, text: (comboCount + 1) + ' Etagen!' });
      ET.sounds.playCombo(comboCount);
      SG.analytics.track('combo', { floors: comboCount });
    }
  }

  function onBonk(floor) {
    chr.vy = 0;
    chr.y = floor.y + C.CHAR_R * 0.4;
    chr.squash = C.SQUASH_BONK;
    ET.particles.spawnBonkSpark(chr.x, floor.y);
    ET.sounds.playBonk();
  }

  // Prüft, ob die Bewegung von prevY nach chr.y (in diesem Schritt) eine
  // Etage kreuzt, und behandelt Landung/Anstoßen/Durchqueren. Nur eine
  // Etage pro Schritt relevant, da Schrittweite << Etagenabstand ist.
  function handleFloorCrossing(prevY) {
    var newY = chr.y;
    var ascending = chr.vy < 0;
    var descending = chr.vy > 0;
    if (!ascending && !descending) return;

    for (var i = 0; i < floors.length; i++) {
      var floor = floors[i];
      if (floor.isGround) continue;

      if (ascending && prevY > floor.y && newY <= floor.y) {
        if (inGap(floor, chr.x, C.CHAR_R)) {
          if (!floor.passed) {
            floor.passed = true;
            airCombo++;
          }
        } else {
          onBonk(floor);
        }
        return;
      }

      if (descending && prevY < floor.y && newY >= floor.y) {
        if (!inGap(floor, chr.x, C.CHAR_R)) {
          onLand(floor, airCombo);
          airCombo = 0;
        }
        return;
      }
    }
  }

  function updatePhysics() {
    var targetCamY = chr.y - C.CANVAS_H * C.CAMERA_FOLLOW_RATIO;
    if (targetCamY < camera.y) camera.y = targetCamY;

    chr.maxHeight = Math.max(chr.maxHeight, heightClimbed());
    ensureFloorsAhead();

    var targetVx = steerFactor * C.MAX_RUN_SPEED;
    if (chr.vx < targetVx) chr.vx = Math.min(targetVx, chr.vx + C.RUN_ACCEL);
    else if (chr.vx > targetVx) chr.vx = Math.max(targetVx, chr.vx - C.RUN_ACCEL);
    if (chr.vx > 0.05) chr.facing = 1;
    else if (chr.vx < -0.05) chr.facing = -1;

    chr.x += chr.vx;
    var minX = C.EDGE_MARGIN + C.CHAR_R;
    var maxX = C.CANVAS_W - C.EDGE_MARGIN - C.CHAR_R;
    if (chr.x < minX) { chr.x = minX; chr.vx = 0; }
    if (chr.x > maxX) { chr.x = maxX; chr.vx = 0; }

    if (chr.grounded) {
      if (chr.floor && inGap(chr.floor, chr.x, C.CHAR_R)) {
        chr.grounded = false;
        chr.vy = 0;
      }
    } else {
      var prevY = chr.y;
      chr.vy += C.GRAVITY;
      chr.y += chr.vy;
      handleFloorCrossing(prevY);
    }

    if (chr.squash !== 0) {
      if (chr.squash > 0) chr.squash = Math.max(0, chr.squash - C.SQUASH_DECAY);
      else chr.squash = Math.min(0, chr.squash + C.SQUASH_DECAY);
    }

    ET.particles.update();

    for (var f = flashes.length - 1; f >= 0; f--) {
      flashes[f].life -= 0.018;
      flashes[f].y -= 0.4;
      if (flashes[f].life <= 0) flashes.splice(f, 1);
    }

    if (chr.y - camera.y > C.CANVAS_H + C.FALL_MARGIN) {
      killChar('fell');
      return;
    }

    pruneOldFloors();
  }

  // ---------- Rendering ----------

  function draw() {
    ctx.clearRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    var grad = ctx.createLinearGradient(0, 0, 0, C.CANVAS_H);
    grad.addColorStop(0, '#1c2f45');
    grad.addColorStop(1, '#101a2b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    if (state === STATES.MENU) {
      drawChar();
      return;
    }

    drawFloors();
    ET.particles.draw(ctx, camera.y);
    drawChar();
    drawFlashes();
  }

  function drawFloors() {
    for (var i = 0; i < floors.length; i++) {
      var floor = floors[i];
      var screenY = floor.y - camera.y;
      if (screenY < -20 || screenY > C.CANVAS_H + 20) continue;

      ctx.fillStyle = floor.isGround ? '#5ee6ff' : '#bfe9ff';
      if (floor.gapWidth <= 0) {
        ctx.fillRect(0, screenY - C.FLOOR_THICK / 2, C.CANVAS_W, C.FLOOR_THICK);
      } else {
        ctx.fillRect(0, screenY - C.FLOOR_THICK / 2, floor.gapX, C.FLOOR_THICK);
        ctx.fillRect(floor.gapX + floor.gapWidth, screenY - C.FLOOR_THICK / 2, C.CANVAS_W - floor.gapX - floor.gapWidth, C.FLOOR_THICK);
      }
    }
  }

  function drawChar() {
    var screenY = chr.y - camera.y;
    var sx = 1 - Math.max(-0.6, Math.min(0.6, chr.squash)) * 0.5;
    var sy = 1 + Math.max(-0.6, Math.min(0.6, chr.squash)) * 0.5;

    ctx.save();
    ctx.translate(chr.x, screenY);
    ctx.scale(sx, sy);

    ctx.fillStyle = '#2b2f3a';
    ctx.beginPath();
    ctx.arc(0, 0, C.CHAR_R, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e63946';
    ctx.fillRect(-C.CHAR_R, -3, C.CHAR_R * 2, 4);

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-3.5, -1, 2.2, 0, Math.PI * 2);
    ctx.arc(3.5, -1, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    var lookDir = chr.facing || 1;
    ctx.beginPath();
    ctx.arc(-3.5 + lookDir * 0.8, -1, 1.1, 0, Math.PI * 2);
    ctx.arc(3.5 + lookDir * 0.8, -1, 1.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawFlashes() {
    for (var i = 0; i < flashes.length; i++) {
      var f = flashes[i];
      var screenY = f.y - camera.y;
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = '#ffd15c';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, chr.x, screenY - 20);
      ctx.globalAlpha = 1;
    }
  }

  // ---------- Loop ----------

  function tick(ts) {
    rafId = global.requestAnimationFrame(tick);
    if (lastTs == null) lastTs = ts;
    var frameMs = ts - lastTs;
    lastTs = ts;
    if (frameMs > 250) frameMs = 250;

    if (state === STATES.PLAYING) {
      accMs += frameMs;
      var steps = 0;
      while (accMs >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
        updatePhysics();
        accMs -= STEP_MS;
        steps++;
        if (state !== STATES.PLAYING) { accMs = 0; break; }
      }
    }

    draw();
  }

  // ---------- Öffentliche API ----------

  var game = {
    STATES: STATES,

    init: function (canvasEl) {
      canvas = canvasEl;
      ctx = canvas.getContext('2d');
      best = SG.storage.getBest(ET.GAME_ID);
      resetWorld();
      draw();
      rafId = global.requestAnimationFrame(tick);
    },

    onChange: function (cb) {
      changeListeners.push(cb);
    },

    getState: function () {
      return state;
    },

    start: function () {
      resetWorld();
      state = STATES.PLAYING;
      accMs = 0;
      lastTs = null;
      SG.audio.unlock();
      SG.poki.gameplayStart();
      SG.analytics.track('game_start', {});
      emitChange();
    },

    restart: function () {
      game.start();
    },

    pause: function () {
      if (state !== STATES.PLAYING) return;
      state = STATES.PAUSED;
      SG.analytics.track('pause', {});
      emitChange();
    },

    resume: function () {
      if (state !== STATES.PAUSED) return;
      state = STATES.PLAYING;
      lastTs = null;
      SG.analytics.track('resume', {});
      emitChange();
    },

    togglePause: function () {
      if (state === STATES.PLAYING) game.pause();
      else if (state === STATES.PAUSED) game.resume();
    },

    // Stufenlose Laufrichtung/-tempo, -1..1. Von input.js aus Neigung,
    // gehaltener Bildschirmhälfte oder Tastatur gesetzt.
    setSteer: function (factor) {
      steerFactor = Math.max(-1, Math.min(1, factor));
    },

    jump: doJump,

    toggleSound: function () {
      var on = SG.audio.toggle();
      SG.analytics.track('sound_toggle', { enabled: on });
      return on;
    },

    getDebugState: function () {
      return {
        state: state,
        score: currentScore(),
        best: best,
        charY: chr ? chr.y : null,
        cameraY: camera ? camera.y : null,
        floorCount: floors ? floors.length : 0,
        grounded: chr ? chr.grounded : null,
      };
    },
  };

  ET.game = game;
})(window);
