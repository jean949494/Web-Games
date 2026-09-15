/**
 * Kurve Solo – Spiellogik & Rendering (Endlos-Modus).
 *
 * Der Punkt steigt endlos nach oben (Kamera folgt, wie bei Ninja
 * Wandsprung), zieht dabei seine Linie mit gelegentlichen Lücken.
 * Kollision mit dem Spielfeldrand, einem Hindernis oder der eigenen
 * Linie = Tod. Das Spielfeld wird mit der Höhe schmaler, die Lücken in
 * den Hindernissen werden enger und ihre Position springt stärker hin
 * und her – siehe constants.js für alle Rampen-Werte.
 *
 * Score = höchster je erreichter Punkt (px Höhe), analog zu Ninja
 * Wandsprung: fällt nicht mit, falls kurz rückwärts gelenkt wird.
 */
(function (global) {
  'use strict';

  var KS = global.KS = global.KS || {};
  var SG = global.SG;
  var C = KS.constants;

  var STEP_MS = 1000 / 60; // Physik läuft fix mit 60Hz, Werte sind "pro Frame" kalibriert
  var MAX_STEPS_PER_FRAME = 8; // Schutz gegen Spiral-of-Death bei Tab-Wechsel

  var STATES = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', GAMEOVER: 'gameover' };

  var canvas, ctx;
  var state = STATES.MENU;
  var changeListeners = [];

  var player, camera, obstacles, nextObstacleY, lastGapX, score, best, shakeFrames, accMs, lastTs, rafId;

  function emitChange(extra) {
    var payload = Object.assign({ state: state, score: Math.floor(score || 0), best: best || 0 }, extra || {});
    changeListeners.forEach(function (cb) {
      try { cb(payload); } catch (e) { /* Listener-Fehler nie das Spiel stören lassen */ }
    });
  }

  function startY() {
    return C.CANVAS_H - C.START_Y_FROM_BOTTOM;
  }

  function resetWorld() {
    var sy = startY();
    player = {
      x: C.CANVAS_W / 2,
      y: sy,
      angle: -Math.PI / 2, // nach oben
      turnInput: 0,
      trail: [{ x: C.CANVAS_W / 2, y: sy, draw: false }],
      gapFrames: 0,
      startY: sy,
      maxHeight: 0,
    };
    camera = { y: 0 };
    obstacles = [];
    lastGapX = C.CANVAS_W / 2;
    nextObstacleY = sy - C.OBSTACLE_FIRST_CLEARANCE;
    score = 0;
    shakeFrames = 0;
    KS.particles.reset();
    ensureObstaclesAhead();
  }

  function heightClimbed() {
    return Math.max(0, player.startY - player.y);
  }

  // Score = höchster je erreichter Punkt, nicht die aktuelle Position
  // (die beim Ausweichen/Zurücklenken kurz sinken kann).
  function currentScore() {
    return Math.floor(player.maxHeight);
  }

  function ensureObstaclesAhead() {
    // Sorgt dafür, dass immer genug Hindernisse oberhalb der Kamera vorhanden sind.
    var horizon = camera.y - C.CANVAS_H * 2.2;
    while (nextObstacleY > horizon) {
      var h = player.startY - nextObstacleY; // Höhe dieser Reihe (für die Rampen)
      var tGap = C.rampT(h, C.OBSTACLE_RAMP_START_HEIGHT, C.OBSTACLE_RAMP_RANGE);
      var gapHalf = C.lerp(C.OBSTACLE_GAP_START, C.OBSTACLE_GAP_MIN, tGap) / 2;
      var jitter = C.lerp(C.OBSTACLE_JITTER_START, C.OBSTACLE_JITTER_MAX, tGap);
      var spacing = C.lerp(C.OBSTACLE_SPACING_START, C.OBSTACLE_SPACING_MIN, tGap);
      var halfW = C.fieldHalfWidthAt(h);
      var cx = C.CANVAS_W / 2;
      var minX = cx - halfW + gapHalf + 4;
      var maxX = cx + halfW - gapHalf - 4;

      var gapX = lastGapX + (Math.random() * 2 - 1) * jitter;
      gapX = maxX > minX ? Math.max(minX, Math.min(maxX, gapX)) : cx;
      lastGapX = gapX;

      obstacles.push({ y: nextObstacleY, gapX: gapX, gapHalf: gapHalf });
      nextObstacleY -= spacing;
    }
  }

  function killPlayer(reason) {
    if (state !== STATES.PLAYING) return;
    KS.particles.spawnBurst(player.x, player.y, C.PLAYER_COLOR);
    KS.sounds.playCrash();
    shakeFrames = C.SHAKE_FRAMES;
    SG.analytics.track('player_down', { reason: reason });
    endRound();
  }

  function endRound() {
    state = STATES.GAMEOVER;
    var finalScore = currentScore();
    score = finalScore;
    var isNewBest = SG.storage.setBest(KS.GAME_ID, finalScore);
    best = SG.storage.getBest(KS.GAME_ID);
    SG.audio.playGameOver();
    SG.poki.gameplayStop();
    SG.analytics.track('game_over', { score: finalScore, best: best, newBest: isNewBest });
    emitChange({ newBest: isNewBest });
  }

  function checkWallCollision() {
    var halfW = C.fieldHalfWidthAt(heightClimbed());
    var cx = C.CANVAS_W / 2;
    return player.x < cx - halfW || player.x > cx + halfW;
  }

  // Hindernis = Balken über die volle Breite mit einer Lücke. Kollision,
  // sobald man in der Höhenbande des Balkens ist UND außerhalb der
  // Lücke (mit demselben großzügigen Kollisionsradius wie bei Linien).
  function checkObstacleCollision() {
    var r = Math.sqrt(C.HIT_FACTOR_SQ) * C.THICK;
    for (var i = 0; i < obstacles.length; i++) {
      var o = obstacles[i];
      if (Math.abs(player.y - o.y) < C.OBSTACLE_THICK / 2 + r) {
        if (player.x < o.gapX - o.gapHalf + r || player.x > o.gapX + o.gapHalf - r) {
          return true;
        }
      }
    }
    return false;
  }

  function checkSelfCollision() {
    var thresholdSq = C.HIT_FACTOR_SQ * C.THICK * C.THICK;
    var trail = player.trail;
    // Die letzten paar Punkte ignorieren, sonst crasht man sofort in die
    // gerade selbst gezogene Linie (siehe Spec).
    var ignoreFrom = trail.length - C.SELF_IGNORE_RECENT_POINTS;
    for (var j = 0; j < ignoreFrom; j++) {
      var pt = trail[j];
      if (!pt.draw) continue; // Lücke -> keine Kollision
      var dx = player.x - pt.x, dy = player.y - pt.y;
      if (dx * dx + dy * dy < thresholdSq) return true;
    }
    return false;
  }

  function pruneOld() {
    while (obstacles.length && obstacles[0].y - camera.y > C.CANVAS_H + C.PRUNE_MARGIN) {
      obstacles.shift();
    }
    var trail = player.trail;
    var cut = 0;
    var keepFrom = trail.length - C.SELF_IGNORE_RECENT_POINTS;
    while (cut < keepFrom && trail[cut].y - camera.y > C.CANVAS_H + C.PRUNE_MARGIN) {
      cut++;
    }
    if (cut > 0) trail.splice(0, cut);
  }

  function updatePhysics() {
    player.angle += player.turnInput * C.TURN;

    // Zufällige Lücke: pro Frame ca. GAP_CHANCE, sobald keine aktive
    // Lücke läuft (Kernfairness-Mechanik aus dem Original).
    var inGap = player.gapFrames > 0;
    if (inGap) {
      player.gapFrames--;
    } else if (Math.random() < C.GAP_CHANCE) {
      player.gapFrames = C.GAP_LENGTH_FRAMES - 1;
      inGap = true;
    }

    player.x += Math.cos(player.angle) * C.SPEED;
    player.y += Math.sin(player.angle) * C.SPEED;
    player.trail.push({ x: player.x, y: player.y, draw: !inGap });

    player.maxHeight = Math.max(player.maxHeight, heightClimbed());
    if (state === STATES.PLAYING) score = currentScore();

    // Kamera folgt nur nach oben (nie zurück nach unten)
    var targetCamY = player.y - C.CANVAS_H * C.CAMERA_FOLLOW_RATIO;
    if (targetCamY < camera.y) camera.y = targetCamY;

    ensureObstaclesAhead();

    if (checkWallCollision()) { killPlayer('wall'); return; }
    if (checkObstacleCollision()) { killPlayer('obstacle'); return; }
    if (checkSelfCollision()) { killPlayer('self'); return; }
    // Sicherheitsnetz: weit unterhalb der Kamera "verbummelt"
    if (player.y - camera.y > C.CANVAS_H + C.FALL_MARGIN) { killPlayer('fell'); return; }

    pruneOld();
  }

  // ---------- Rendering ----------

  function draw() {
    ctx.clearRect(0, 0, C.CANVAS_W, C.CANVAS_H);
    ctx.fillStyle = '#10141f';
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    ctx.save();
    if (shakeFrames > 0) {
      var mag = (shakeFrames / C.SHAKE_FRAMES) * C.SHAKE_MAGNITUDE;
      ctx.translate((Math.random() * 2 - 1) * mag, (Math.random() * 2 - 1) * mag);
    }

    drawWalls();
    if (state !== STATES.MENU) {
      drawObstacles();
      drawTrail();
    }
    drawHead();
    KS.particles.draw(ctx);

    ctx.restore();
  }

  function drawWalls() {
    var halfW = C.fieldHalfWidthAt(heightClimbed());
    var cx = C.CANVAS_W / 2;
    ctx.fillStyle = C.WALL_COLOR;
    ctx.fillRect(0, 0, cx - halfW, C.CANVAS_H);
    ctx.fillRect(cx + halfW, 0, C.CANVAS_W - (cx + halfW), C.CANVAS_H);
  }

  function roundedBar(x, y, w, h) {
    if (w <= 0) return;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, h / 2);
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.fill();
  }

  function drawObstacles() {
    ctx.fillStyle = C.OBSTACLE_COLOR;
    var half = C.OBSTACLE_THICK / 2;
    for (var i = 0; i < obstacles.length; i++) {
      var o = obstacles[i];
      var sy = o.y - camera.y;
      if (sy < -40 || sy > C.CANVAS_H + 40) continue;
      var leftEnd = o.gapX - o.gapHalf;
      var rightStart = o.gapX + o.gapHalf;
      // Volle Breite minus Lücke zeichnen; die Seitenwände werden
      // danach obendrauf gemalt und decken den Überstand sauber ab.
      roundedBar(0, sy - half, leftEnd, C.OBSTACLE_THICK);
      roundedBar(rightStart, sy - half, C.CANVAS_W - rightStart, C.OBSTACLE_THICK);
    }
  }

  function drawTrail() {
    var trail = player.trail;
    if (trail.length < 2) return;
    ctx.strokeStyle = C.PLAYER_COLOR;
    ctx.lineWidth = C.THICK;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    var penDown = false;
    for (var j = 1; j < trail.length; j++) {
      var prev = trail[j - 1], cur = trail[j];
      if (cur.draw) {
        if (!penDown) { ctx.moveTo(prev.x, prev.y - camera.y); penDown = true; }
        ctx.lineTo(cur.x, cur.y - camera.y);
      } else {
        penDown = false;
      }
    }
    ctx.stroke();
  }

  function drawHead() {
    var sy = player.y - camera.y;
    ctx.fillStyle = C.PLAYER_COLOR;
    ctx.beginPath();
    ctx.arc(player.x, sy, C.THICK * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---------- Loop ----------

  function tick(ts) {
    rafId = global.requestAnimationFrame(tick);
    if (lastTs == null) lastTs = ts;
    var frameMs = ts - lastTs;
    lastTs = ts;
    if (frameMs > 250) frameMs = 250; // Tab war im Hintergrund

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

    if (state !== STATES.PAUSED) {
      KS.particles.update();
      if (shakeFrames > 0) shakeFrames--;
    }

    draw();
  }

  // ---------- Öffentliche API ----------

  var game = {
    STATES: STATES,

    init: function (canvasEl) {
      canvas = canvasEl;
      ctx = canvas.getContext('2d');
      best = SG.storage.getBest(KS.GAME_ID);
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

    // side: -1 (links), 0 (geradeaus), 1 (rechts).
    setTurn: function (side) {
      if (!player) return;
      player.turnInput = side;
    },

    toggleSound: function () {
      var on = SG.audio.toggle();
      SG.analytics.track('sound_toggle', { enabled: on });
      return on;
    },

    // Für manuelle/automatisierte Tests (siehe README).
    getDebugState: function () {
      var nextObstacle = null;
      if (obstacles && player) {
        for (var i = 0; i < obstacles.length; i++) {
          if (obstacles[i].y < player.y) { nextObstacle = obstacles[i]; break; }
        }
      }
      return {
        state: state,
        score: Math.floor(score || 0),
        best: best,
        playerX: player ? player.x : null,
        playerY: player ? player.y : null,
        angle: player ? player.angle : null,
        fieldHalfWidth: player ? C.fieldHalfWidthAt(heightClimbed()) : null,
        nextObstacle: nextObstacle,
      };
    },
  };

  KS.game = game;
})(window);
