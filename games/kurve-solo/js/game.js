/**
 * Kurve Solo – Spiellogik & Rendering.
 *
 * Werte 1:1 aus der Spec übernommen (siehe constants.js). Diese Datei
 * implementiert die Zustandsmaschine (Menü/Spiel/Pause/Game Over), die
 * Kernmechanik (konstante Geschwindigkeit, Lenken, Linien mit Lücken,
 * Kollision mit Wand/eigener/fremder Linie) sowie die Bot-Runde: Solo
 * gegen 3 KI-Bots, Ziel ist möglichst lange zu überleben. Score = Anzahl
 * überlebter Physik-Frames (fix 60Hz).
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

  var players, score, best, shakeFrames, accMs, lastTs, rafId;

  function emitChange(extra) {
    var payload = Object.assign({ state: state, score: Math.floor(score || 0), best: best || 0 }, extra || {});
    changeListeners.forEach(function (cb) {
      try { cb(payload); } catch (e) { /* Listener-Fehler nie das Spiel stören lassen */ }
    });
  }

  function makePlayer(id, isBot, pos, color) {
    return {
      id: id,
      isBot: isBot,
      x: pos.x,
      y: pos.y,
      angle: pos.angle,
      color: color,
      alive: true,
      trail: [{ x: pos.x, y: pos.y, draw: false }], // erster Punkt startet ohne Rückwärtslinie
      gapFrames: 0,
      turnInput: 0, // nur für den menschlichen Spieler relevant
      avoidDir: 0, avoidHold: 0, wobbleDir: 0, wobbleHold: 0, // nur für Bots relevant
    };
  }

  function resetWorld() {
    var layout = C.START_LAYOUT();
    players = [makePlayer('you', false, layout[0], C.PLAYER_COLOR)];
    for (var i = 0; i < C.BOT_COUNT; i++) {
      players.push(makePlayer('bot' + i, true, layout[i + 1], C.BOT_COLORS[i % C.BOT_COLORS.length]));
    }
    score = 0;
    shakeFrames = 0;
    KS.particles.reset();
  }

  function checkLineCollision(p) {
    var thresholdSq = C.HIT_FACTOR_SQ * C.THICK * C.THICK;
    for (var i = 0; i < players.length; i++) {
      var other = players[i];
      var trail = other.trail;
      // Eigene Linie: die letzten paar Punkte ignorieren, sonst crasht man
      // sofort in die gerade selbst gezogene Linie (siehe Spec).
      var ignoreFrom = other === p ? trail.length - C.SELF_IGNORE_RECENT_POINTS : trail.length;
      for (var j = 0; j < ignoreFrom; j++) {
        var pt = trail[j];
        if (!pt.draw) continue; // Lücke -> keine Kollision
        var dx = p.x - pt.x, dy = p.y - pt.y;
        if (dx * dx + dy * dy < thresholdSq) return true;
      }
    }
    return false;
  }

  function killPlayer(p, reason) {
    p.alive = false;
    KS.particles.spawnBurst(p.x, p.y, p.color);
    SG.analytics.track('player_down', { id: p.id, reason: reason, isBot: p.isBot });

    if (p.id === 'you') {
      KS.sounds.playCrash();
      shakeFrames = C.SHAKE_FRAMES;
      endRound();
    } else {
      KS.sounds.playBotDown();
    }
  }

  function endRound() {
    state = STATES.GAMEOVER;
    var finalScore = score;
    var isNewBest = SG.storage.setBest(KS.GAME_ID, finalScore);
    best = SG.storage.getBest(KS.GAME_ID);
    SG.audio.playGameOver();
    SG.poki.gameplayStop();
    SG.analytics.track('game_over', { score: finalScore, best: best, newBest: isNewBest });
    emitChange({ newBest: isNewBest });
  }

  function updatePlayer(p) {
    if (!p.alive) return;

    var turn = p.isBot ? KS.bots.decideTurn(p, players) : p.turnInput;
    p.angle += turn * C.TURN;

    // Zufällige Lücke: pro Frame ca. GAP_CHANCE, sobald keine aktive
    // Lücke läuft (Kernfairness-Mechanik aus dem Original).
    var inGap = p.gapFrames > 0;
    if (inGap) {
      p.gapFrames--;
    } else if (Math.random() < C.GAP_CHANCE) {
      p.gapFrames = C.GAP_LENGTH_FRAMES - 1;
      inGap = true;
    }

    p.x += Math.cos(p.angle) * C.SPEED;
    p.y += Math.sin(p.angle) * C.SPEED;
    p.trail.push({ x: p.x, y: p.y, draw: !inGap });

    var m = C.FIELD_MARGIN;
    if (p.x < m || p.x > C.CANVAS_W - m || p.y < m || p.y > C.CANVAS_H - m) {
      killPlayer(p, 'wall');
      return;
    }
    if (checkLineCollision(p)) {
      killPlayer(p, 'line');
    }
  }

  function updatePhysics() {
    for (var i = 0; i < players.length; i++) {
      updatePlayer(players[i]);
    }
    if (state === STATES.PLAYING) score++;
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

    drawField();
    if (players) {
      drawTrails();
      drawHeads();
    }
    KS.particles.draw(ctx);

    ctx.restore();
  }

  function drawField() {
    var m = C.FIELD_MARGIN;
    ctx.strokeStyle = 'rgba(244, 241, 234, 0.18)';
    ctx.lineWidth = 2;
    ctx.strokeRect(m, m, C.CANVAS_W - m * 2, C.CANVAS_H - m * 2);
  }

  function drawTrails() {
    for (var i = 0; i < players.length; i++) {
      var p = players[i];
      if (p.trail.length < 2) continue;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = C.THICK;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // Tote Spieler: Linie bleibt als Hindernis stehen, aber gedimmt.
      ctx.globalAlpha = p.alive ? 1 : 0.5;
      ctx.beginPath();
      var penDown = false;
      for (var j = 1; j < p.trail.length; j++) {
        var prev = p.trail[j - 1], cur = p.trail[j];
        if (cur.draw) {
          if (!penDown) { ctx.moveTo(prev.x, prev.y); penDown = true; }
          ctx.lineTo(cur.x, cur.y);
        } else {
          penDown = false;
        }
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawHeads() {
    for (var i = 0; i < players.length; i++) {
      var p = players[i];
      if (!p.alive) continue;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, C.THICK * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
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

    // Partikel/Screen-Shake laufen unabhängig von der festen Physik-Rate
    // weiter aus, auch kurz nach Game Over, für einen sauberen Ausklang.
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

    // side: -1 (links), 0 (geradeaus), 1 (rechts) – nur für den
    // menschlichen Spieler; Bots lenken über bots.js.
    setTurn: function (side) {
      if (!players || !players.length) return;
      players[0].turnInput = side;
    },

    toggleSound: function () {
      var on = SG.audio.toggle();
      SG.analytics.track('sound_toggle', { enabled: on });
      return on;
    },

    // Für manuelle/automatisierte Tests (siehe README).
    getDebugState: function () {
      return {
        state: state,
        score: Math.floor(score || 0),
        best: best,
        aliveCount: players ? players.filter(function (p) { return p.alive; }).length : 0,
      };
    },
  };

  KS.game = game;
})(window);
