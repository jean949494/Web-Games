/**
 * Eisturm – Spiellogik & Rendering.
 *
 * Icy-Tower-Mechanik: Etagen (schmale Plattformen, nicht die volle
 * Breite) erklimmen, Anlauftempo bestimmt Sprunghöhe/-weite, "Combo"
 * fürs Überspringen mehrerer Etagen in einem einzigen Sprung. Neu
 * (statt Tastatur/Timing) ist die Steuerung per Neigung/Tippen/Halten –
 * siehe input.js. Diese Datei kennt nur zwei Eingaben: setSteer(-1..1)
 * (stufenlose Laufrichtung/-tempo) und jump() (löst einen Sprung aus,
 * wenn gerade auf einer Etage gestanden wird).
 *
 * Kollisionsmodell: Etagen sind "Von-unten-durchspringbare" Plattformen
 * (wie bei Doodle Jump) – beim Steigen nie ein Hindernis, ganz gleich wo
 * man gerade ist. Beim Fallen wird man von der Plattform aufgefangen,
 * sobald man über ihr steht; steht man daneben, fällt man einfach weiter
 * zur nächsten Etage darunter. Verliert man dabei zu viel Höhe
 * gegenüber der (nur nach oben mitlaufenden) Kamera, ist die Runde vorbei
 * – wie im Original, wo der sichtbare Ausschnitt nach oben wandert und
 * man nicht zurückfallen darf.
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

  var chr, camera, floors, nextFloorY, floorSeq, score, best, bonusScore, jumpFromSeq, flashes, accMs, lastTs, rafId;
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

  // Ist x (mit Radius r) über der Plattform dieser Etage? Nur das
  // entscheidet, ob man beim Fallen darauf landet. Die Boden-Etage ist
  // immer volle Breite (plankWidth = CANVAS_W), also immer "true".
  function onPlank(floor, x, r) {
    return x + r > floor.plankX && x - r < floor.plankX + floor.plankWidth;
  }

  function resetWorld() {
    var groundY = C.CANVAS_H - C.START_Y_FROM_BOTTOM;
    var groundFloor = { y: groundY, plankX: 0, plankWidth: C.CANVAS_W, seq: 0, isGround: true };

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
    floorSeq = 0;
    nextFloorY = groundY - (C.FLOOR_SPACING + Math.random() * C.FLOOR_SPACING_JITTER);
    score = 0;
    bonusScore = 0;
    jumpFromSeq = 0;
    flashes = [];
    steerFactor = 0;
    ET.particles.reset();
    ensureFloorsAhead();
  }

  function ensureFloorsAhead() {
    var horizon = camera.y - C.CANVAS_H * 2.2;
    while (nextFloorY > horizon) {
      var plankWidth = C.plankWidthAt(heightClimbed());
      var margin = C.EDGE_MARGIN;
      var plankX = margin + Math.random() * Math.max(10, C.CANVAS_W - margin * 2 - plankWidth);
      floorSeq++;
      floors.push({ y: nextFloorY, plankX: plankX, plankWidth: plankWidth, seq: floorSeq });
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
    jumpFromSeq = chr.floor.seq;
    chr.grounded = false;
    chr.floor = null;
    chr.vy = C.JUMP_VY_BASE + C.JUMP_VY_BONUS * speedFactor;
    SG.audio.unlock();
    ET.sounds.playJump(speedFactor);
    SG.analytics.track('jump', { speedFactor: Math.round(speedFactor * 100) / 100 });
  }

  function onLand(floor) {
    var comboCount = Math.max(0, floor.seq - jumpFromSeq - 1);
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

  // Nur beim Fallen relevant: Etagen sind von unten immer durchspringbar
  // (wie bei Doodle Jump), man kann beim Steigen also nie "anstoßen".
  // Steht man beim Fallen über der Plattform, wird man aufgefangen,
  // sonst fällt man einfach weiter zur nächsten Etage darunter.
  function handleFloorCrossing(prevY) {
    var newY = chr.y;
    if (chr.vy <= 0) return; // nur beim Fallen (vy>0), Steigen ist immer frei

    for (var i = 0; i < floors.length; i++) {
      var floor = floors[i];
      if (prevY < floor.y && newY >= floor.y && onPlank(floor, chr.x, C.CHAR_R)) {
        onLand(floor);
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
      if (chr.floor && !onPlank(chr.floor, chr.x, C.CHAR_R)) {
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
      ctx.fillRect(floor.plankX, screenY - C.FLOOR_THICK / 2, floor.plankWidth, C.FLOOR_THICK);
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
