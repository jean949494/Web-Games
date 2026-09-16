/**
 * Kurve Solo – Spiellogik & Rendering (Endlos-Modus, Hardcore-Tuning).
 *
 * Der Punkt steigt endlos nach oben (Kamera folgt, wie bei Ninja
 * Wandsprung), zieht dabei seine (durchgehende, lückenlose) Linie
 * hinter sich her. Kollision mit Spielfeldrand, Hindernis, Gegner oder
 * eigener Linie = Tod. Spielfeld, Hindernis-Lücke und Gegner werden mit
 * der Höhe OHNE Plateau immer enger/knapper/verzwickter (siehe
 * constants.js, `approach()`).
 *
 * Power-Ups geben kurz Tempo + Unverwundbarkeit, sind aber absichtlich
 * weit von der sicheren Lücke platziert – ein riskanter Bonus.
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

  var player, camera, obstacles, powerups, enemies;
  var nextObstacleY, lastGapX, score, best, shakeFrames, controlHintFrames, elapsedFrames, accMs, lastTs, rafId;

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
      trail: [{ x: C.CANVAS_W / 2, y: sy }],
      startY: sy,
      maxHeight: 0,
      invincibleFrames: 0,
      buffGraceFrames: 0,
    };
    camera = { y: 0 };
    obstacles = [];
    powerups = [];
    enemies = [];
    lastGapX = C.CANVAS_W / 2;
    nextObstacleY = sy - C.OBSTACLE_FIRST_CLEARANCE;
    score = 0;
    shakeFrames = 0;
    controlHintFrames = C.CONTROL_HINT_FRAMES;
    elapsedFrames = 0;
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

  function currentSpeed() {
    if (player.invincibleFrames <= 0) return C.SPEED;
    if (player.invincibleFrames > C.POWERUP_WARNING_FRAMES) return C.SPEED * C.POWERUP_SPEED_MULT;
    // Sanftes Abbremsen in der Vorwarnphase statt hartem Schnitt auf
    // Normaltempo – fühlt sich sonst wie ein Stolpern kurz vor der Wand an.
    var t = player.invincibleFrames / C.POWERUP_WARNING_FRAMES; // 1 -> 0
    return C.SPEED * (1 + (C.POWERUP_SPEED_MULT - 1) * t);
  }

  // Nicht mitten in einer Wand, einem Hindernis-Balken, der eigenen
  // Linie oder direkt an einem Gegner enden lassen – sonst crasht man,
  // sobald die Unverwundbarkeit endet, ohne jede Reaktionschance
  // (`checkSelfCollision` weiter unten definiert, wird hier vorab genutzt).
  function isSafeToEndBuff() {
    var halfW = C.fieldHalfWidthAt(heightClimbed());
    var cx = C.CANVAS_W / 2;
    if (player.x < cx - halfW || player.x > cx + halfW) return false;

    var margin = Math.sqrt(C.HIT_FACTOR_SQ) * C.THICK;
    for (var i = 0; i < obstacles.length; i++) {
      var o = obstacles[i];
      // Nur unsicher, wenn man in der Höhenbande des Balkens UND
      // außerhalb der Lücke ist (exakt wie checkObstacleCollision) –
      // sonst gilt jede sauber durchquerte Lücke fälschlich als
      // "unsicher", weil Hindernisse inzwischen so dicht stehen, dass
      // man fast immer in irgendeiner Balken-Höhenbande ist. Das ließ
      // die Kulanzzeit fast immer bis zum Deckel volllaufen und den
      // Boost dann zwangsweise (und potenziell unsicher) beenden.
      if (Math.abs(player.y - o.y) < C.OBSTACLE_THICK / 2 + margin) {
        if (player.x < o.gapX - o.gapHalf + margin || player.x > o.gapX + o.gapHalf - margin) return false;
      }
    }
    for (var j = 0; j < enemies.length; j++) {
      var e = enemies[j];
      var dx = player.x - e.x, dy = player.y - e.y;
      var minDist = e.r + margin;
      if (dx * dx + dy * dy < minDist * minDist) return false;
    }
    if (checkSelfCollision()) return false;
    return true;
  }

  function ensureObstaclesAhead() {
    // Sorgt dafür, dass immer genug Hindernisse oberhalb der Kamera vorhanden sind.
    var horizon = camera.y - C.CANVAS_H * 2.2;
    while (nextObstacleY > horizon) {
      var h = player.startY - nextObstacleY; // Höhe dieser Reihe (für die Rampen)
      var gapHalf = C.approach(h, C.OBSTACLE_GAP_START, C.OBSTACLE_GAP_TARGET, C.GAP_HALF_LIFE, C.RAMP_GRACE) / 2;
      var jitter = C.approach(h, C.OBSTACLE_JITTER_START, C.OBSTACLE_JITTER_TARGET, C.JITTER_HALF_LIFE, C.RAMP_GRACE);
      var spacing = C.approach(h, C.OBSTACLE_SPACING_START, C.OBSTACLE_SPACING_TARGET, C.SPACING_HALF_LIFE, C.RAMP_GRACE);
      var halfW = C.fieldHalfWidthAt(h);
      var cx = C.CANVAS_W / 2;
      var minX = cx - halfW + gapHalf + 4;
      var maxX = cx + halfW - gapHalf - 4;

      var gapX = lastGapX + (Math.random() * 2 - 1) * jitter;
      gapX = maxX > minX ? Math.max(minX, Math.min(maxX, gapX)) : cx;
      lastGapX = gapX;

      obstacles.push({ y: nextObstacleY, gapX: gapX, gapHalf: gapHalf });

      // Power-Up: absichtlich weit von der Lücken-Mitte entfernt, kurz
      // "vor" dem Balken (Richtung Spieler) – riskant zu holen, weil man
      // danach scharf zurück zur Lücke lenken muss.
      if (Math.random() < C.POWERUP_CHANCE_PER_OBSTACLE) {
        var side = Math.random() < 0.5 ? -1 : 1;
        var offset = C.POWERUP_MIN_OFFSET_FROM_GAP + Math.random() * C.POWERUP_OFFSET_SPREAD;
        var px = Math.max(cx - halfW + 12, Math.min(cx + halfW - 12, gapX + side * offset));
        powerups.push({ x: px, y: nextObstacleY + C.POWERUP_Y_LEAD, taken: false });
      }

      // Gegner: tauchen erst ab einer gewissen Höhe auf ("später"),
      // irgendwo im offenen Korridor zwischen dieser und der nächsten
      // Reihe – man muss um sie herum schlängeln.
      if (h > C.ENEMY_START_HEIGHT && Math.random() < C.ENEMY_CHANCE_PER_GAP) {
        var ey = nextObstacleY - spacing * (0.3 + Math.random() * 0.4);
        var eHalfW = C.fieldHalfWidthAt(player.startY - ey);
        var reach = Math.max(0, eHalfW - C.ENEMY_RADIUS - 10);
        var ex = cx + (Math.random() * 2 - 1) * reach;
        var moving = h > C.ENEMY_MOVE_START_HEIGHT;
        enemies.push({ x: ex, baseX: ex, y: ey, r: C.ENEMY_RADIUS, moving: moving, phase: Math.random() * Math.PI * 2 });
      }

      nextObstacleY -= spacing;
    }
  }

  function killPlayer(reason) {
    if (state !== STATES.PLAYING) return;
    if (player.invincibleFrames > 0) return; // unschlagbar während des Power-Ups
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

  function checkEnemyCollision() {
    var r = Math.sqrt(C.HIT_FACTOR_SQ) * C.THICK;
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      var dx = player.x - e.x, dy = player.y - e.y;
      var minDist = e.r + r;
      if (dx * dx + dy * dy < minDist * minDist) return true;
    }
    return false;
  }

  function checkSelfCollision() {
    var thresholdSq = C.HIT_FACTOR_SQ * C.THICK * C.THICK;
    var trail = player.trail;
    // Die letzten paar Punkte ignorieren, sonst crasht man sofort in die
    // gerade selbst gezogene Linie.
    var ignoreFrom = trail.length - C.SELF_IGNORE_RECENT_POINTS;
    for (var j = 0; j < ignoreFrom; j++) {
      var pt = trail[j];
      var dx = player.x - pt.x, dy = player.y - pt.y;
      if (dx * dx + dy * dy < thresholdSq) return true;
    }
    return false;
  }

  function checkPowerupPickup() {
    for (var i = 0; i < powerups.length; i++) {
      var p = powerups[i];
      if (p.taken) continue;
      var dx = player.x - p.x, dy = player.y - p.y;
      if (dx * dx + dy * dy < C.POWERUP_PICKUP_RADIUS * C.POWERUP_PICKUP_RADIUS) {
        p.taken = true;
        player.invincibleFrames = C.POWERUP_DURATION_FRAMES;
        player.buffGraceFrames = 0;
        KS.particles.spawnBurst(p.x, p.y, C.POWERUP_COLOR);
        KS.sounds.playPowerup();
        SG.analytics.track('powerup', {});
      }
    }
  }

  function pruneOld() {
    while (obstacles.length && obstacles[0].y - camera.y > C.CANVAS_H + C.PRUNE_MARGIN) obstacles.shift();
    while (powerups.length && powerups[0].y - camera.y > C.CANVAS_H + C.PRUNE_MARGIN) powerups.shift();
    while (enemies.length && enemies[0].y - camera.y > C.CANVAS_H + C.PRUNE_MARGIN) enemies.shift();
    var trail = player.trail;
    var cut = 0;
    var keepFrom = trail.length - C.SELF_IGNORE_RECENT_POINTS;
    while (cut < keepFrom && trail[cut].y - camera.y > C.CANVAS_H + C.PRUNE_MARGIN) {
      cut++;
    }
    if (cut > 0) trail.splice(0, cut);
  }

  // Ab ENEMY_MOVE_START_HEIGHT gespawnte Gegner pendeln langsam um ihre
  // Basis-Position seitlich hin und her ("bewegen sich irgendwann auch").
  function updateEnemies() {
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (e.moving) {
        e.x = e.baseX + Math.sin(elapsedFrames * C.ENEMY_MOVE_SPEED + e.phase) * C.ENEMY_MOVE_AMPLITUDE;
      }
    }
  }

  function updatePhysics() {
    player.angle += player.turnInput * C.TURN;

    var spd = currentSpeed();
    player.x += Math.cos(player.angle) * spd;
    player.y += Math.sin(player.angle) * spd;

    // Während der Unverwundbarkeit lässt man Hindernisse/Gegner/die
    // eigene Linie durchlässig (bewusst "unschlagbar"), aber die
    // Seitenwand NICHT wirklich verlassen – man rutscht höchstens daran
    // entlang. Sonst kann man beim unaufmerksamen "bin doch eh
    // unschlagbar"-Fahren beliebig weit außerhalb des Feldes landen,
    // und selbst die Kulanzzeit am Boost-Ende reicht dann nicht mehr,
    // um rechtzeitig zurückzulenken, bevor der Kulanz-Deckel greift und
    // man mitten im Nichts crasht.
    if (player.invincibleFrames > 0) {
      var wHalfW = C.fieldHalfWidthAt(heightClimbed());
      var wCx = C.CANVAS_W / 2;
      var wallMargin = Math.sqrt(C.HIT_FACTOR_SQ) * C.THICK;
      player.x = Math.max(wCx - wHalfW + wallMargin, Math.min(wCx + wHalfW - wallMargin, player.x));
    }

    player.trail.push({ x: player.x, y: player.y });

    player.maxHeight = Math.max(player.maxHeight, heightClimbed());
    if (state === STATES.PLAYING) score = currentScore();

    if (player.invincibleFrames > 0) {
      // Timer läuft ab, aber nicht mitten in einer Wand/einem Hindernis
      // enden lassen ("hinter der nächsten Wand ausgehen") – sonst
      // crasht man ohne jede Reaktionschance direkt nach dem Boost.
      // Gedeckelt, damit man sich damit nicht dauerhaft unschlagbar hält.
      if (player.invincibleFrames === 1 && !isSafeToEndBuff() && player.buffGraceFrames < C.POWERUP_MAX_GRACE_FRAMES) {
        player.buffGraceFrames++;
      } else {
        player.invincibleFrames--;
      }
    }
    if (controlHintFrames > 0) controlHintFrames--;
    elapsedFrames++;
    updateEnemies();

    // Kamera folgt nur nach oben (nie zurück nach unten)
    var targetCamY = player.y - C.CANVAS_H * C.CAMERA_FOLLOW_RATIO;
    if (targetCamY < camera.y) camera.y = targetCamY;

    ensureObstaclesAhead();
    checkPowerupPickup();

    if (checkWallCollision()) { killPlayer('wall'); return; }
    if (checkObstacleCollision()) { killPlayer('obstacle'); return; }
    if (checkEnemyCollision()) { killPlayer('enemy'); return; }
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
      drawEnemies();
      drawPowerups();
      drawTrail();
    }
    drawHead();
    KS.particles.draw(ctx);
    if (state === STATES.PLAYING) drawControlHint();

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

  function drawEnemies() {
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      var sy = e.y - camera.y;
      if (sy < -30 || sy > C.CANVAS_H + 30) continue;
      ctx.fillStyle = C.ENEMY_COLOR;
      ctx.beginPath();
      ctx.arc(e.x, sy, e.r, 0, Math.PI * 2);
      ctx.fill();
      // freundliche Augen statt bedrohlicher Optik
      ctx.fillStyle = '#10141f';
      ctx.beginPath();
      ctx.arc(e.x - e.r * 0.35, sy - e.r * 0.15, e.r * 0.16, 0, Math.PI * 2);
      ctx.arc(e.x + e.r * 0.35, sy - e.r * 0.15, e.r * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPowerups() {
    var pulse = 1 + Math.sin(Date.now() / 180) * 0.18;
    for (var i = 0; i < powerups.length; i++) {
      var p = powerups[i];
      if (p.taken) continue;
      var sy = p.y - camera.y;
      if (sy < -30 || sy > C.CANVAS_H + 30) continue;
      ctx.fillStyle = C.POWERUP_COLOR;
      ctx.beginPath();
      ctx.arc(p.x, sy, C.POWERUP_RADIUS * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, sy, C.POWERUP_RADIUS * pulse + 3, 0, Math.PI * 2);
      ctx.stroke();
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
    ctx.moveTo(trail[0].x, trail[0].y - camera.y);
    for (var j = 1; j < trail.length; j++) {
      ctx.lineTo(trail[j].x, trail[j].y - camera.y);
    }
    ctx.stroke();
  }

  function drawHead() {
    var sy = player.y - camera.y;
    var invincible = player.invincibleFrames > 0;
    var endingSoon = invincible && player.invincibleFrames <= C.POWERUP_WARNING_FRAMES;

    // Solange der Boost aktiv ist: steady Power-Up-Farbring als klares
    // "gerade unschlagbar"-Signal. Erst kurz bevor er endet, blinkt der
    // Kopf selbst – gezielte "gleich vorbei"-Vorwarnung statt Dauerblinken.
    if (invincible) {
      ctx.strokeStyle = C.POWERUP_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, sy, C.THICK * 1.6 + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (endingSoon && Math.floor(player.invincibleFrames / C.POWERUP_BLINK_FRAMES) % 2 === 0) {
      ctx.fillStyle = '#ffffff';
    } else {
      ctx.fillStyle = C.PLAYER_COLOR;
    }
    ctx.beginPath();
    ctx.arc(player.x, sy, C.THICK * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Kurze, transparente Einblendung am Rundenstart: linke Hälfte
  // drücken = links, rechte Hälfte = rechts – ganz ohne Text.
  function drawControlHint() {
    if (controlHintFrames <= 0) return;
    var fade = Math.min(1, controlHintFrames / C.CONTROL_HINT_FADE_FRAMES);
    var alpha = C.CONTROL_HINT_MAX_ALPHA * fade;
    if (alpha <= 0) return;
    var midX = C.CANVAS_W / 2;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    ctx.globalAlpha = Math.min(1, alpha + 0.35);
    ctx.fillStyle = '#10141f';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('◀', midX / 2, C.CANVAS_H / 2);
    ctx.fillText('▶', midX + midX / 2, C.CANVAS_H / 2);

    ctx.fillRect(midX - 1, 0, 2, C.CANVAS_H);
    ctx.restore();
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
      var nearestPowerup = null;
      if (powerups && player) {
        for (var p = 0; p < powerups.length; p++) {
          if (!powerups[p].taken && powerups[p].y < player.y) { nearestPowerup = powerups[p]; break; }
        }
      }
      var nearestEnemy = null;
      if (enemies && player) {
        for (var e = 0; e < enemies.length; e++) {
          if (enemies[e].y < player.y) { nearestEnemy = enemies[e]; break; }
        }
      }
      return {
        state: state,
        score: Math.floor(score || 0),
        best: best,
        playerX: player ? player.x : null,
        playerY: player ? player.y : null,
        angle: player ? player.angle : null,
        invincible: player ? player.invincibleFrames > 0 : false,
        buffGraceFrames: player ? player.buffGraceFrames : 0,
        fieldHalfWidth: player ? C.fieldHalfWidthAt(heightClimbed()) : null,
        nextObstacle: nextObstacle,
        nearestPowerup: nearestPowerup,
        nearestEnemy: nearestEnemy,
        powerupCount: powerups ? powerups.filter(function (p) { return !p.taken; }).length : 0,
        enemyCount: enemies ? enemies.length : 0,
      };
    },
  };

  KS.game = game;
})(window);
