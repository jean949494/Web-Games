/**
 * Ninja Wandsprung – Spiellogik & Rendering.
 *
 * Physik-Werte 1:1 aus der Spec übernommen (siehe constants.js). Diese
 * Datei implementiert die Zustandsmaschine (Menü/Spiel/Pause/Game Over),
 * die Kernmechanik (Wandrutsch, Ladesprung, Kamera), Stacheln mit
 * Schwierigkeitskurve sowie das "Juice" (Squash/Stretch, Staub, Knapp!,
 * Ladering).
 */
(function (global) {
  'use strict';

  var NW = global.NW = global.NW || {};
  var C = NW.constants;

  var STEP_MS = 1000 / 60; // Physik läuft fix mit 60Hz, Werte sind "pro Frame" kalibriert
  var MAX_STEPS_PER_FRAME = 8; // Schutz gegen Spiral-of-Death bei Tab-Wechsel

  var STATES = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', GAMEOVER: 'gameover' };

  var canvas, ctx;
  var state = STATES.MENU;
  var changeListeners = [];

  var ninja, camera, spikes, nextSpikeY, lvl, score, best, flashes, accMs, lastTs, rafId;

  function emitChange(extra) {
    var payload = Object.assign({ state: state, score: Math.floor(score || 0), best: best || 0 }, extra || {});
    changeListeners.forEach(function (cb) {
      try { cb(payload); } catch (e) { /* Listener-Fehler nie das Spiel stören lassen */ }
    });
  }

  function resetWorld() {
    ninja = {
      side: 'left',
      x: C.WALL_W + C.NINJA_R,
      y: C.CANVAS_H - 90,
      vx: 0,
      vy: 0,
      onWall: true,
      chargingMs: 0,
      charging: false,
      gm: 1,
      squash: 0, // >0 = gestaucht (breiter/flacher), <0 = gestreckt
      startY: C.CANVAS_H - 90,
      maxHeight: 0, // höchster je erreichter Punkt (= Score), fällt nicht mit dem Ninja
    };
    camera = { y: 0 };
    spikes = [];
    lvl = 1;
    // Erster Stachel: gleiche Formel wie alle folgenden Abstände (bei lvl=1
    // ergibt das großzügige 420-560px) – siehe Spec, "Zu enge Stacheln am Anfang".
    nextSpikeY = ninja.y - (C.SPIKE_GAP_BASE + Math.random() * C.SPIKE_GAP_RAND) / lvl;
    score = 0;
    flashes = [];
    NW.particles.reset();
    ensureSpikesAhead();
  }

  function heightClimbed() {
    return Math.max(0, ninja.startY - ninja.y);
  }

  // Score = höchster je erreichter Punkt, nicht die aktuelle Position
  // (die zwischen zwei Sprüngen durchs Wandrutschen leicht sinkt).
  function currentScore() {
    return Math.floor(ninja.maxHeight);
  }

  function computeLvl() {
    var h = heightClimbed();
    if (h <= C.LEVEL_RAMP_START_HEIGHT) return 1;
    var t = Math.min(1, (h - C.LEVEL_RAMP_START_HEIGHT) / C.LEVEL_RAMP_RANGE);
    return 1 + t * (C.LEVEL_CAP - 1);
  }

  var lastSpikeSide = null;

  function ensureSpikesAhead() {
    // Sorgt dafür, dass immer genug Stacheln oberhalb der Kamera vorhanden sind.
    var horizon = camera.y - C.CANVAS_H * 2.2;
    while (nextSpikeY > horizon) {
      var side = Math.random() < 0.5 ? 'left' : 'right';
      // leichte Fairness: nicht 3x hintereinander dieselbe Seite
      if (side === lastSpikeSide && Math.random() < 0.6) {
        side = side === 'left' ? 'right' : 'left';
      }
      lastSpikeSide = side;
      var protrusion = C.SPIKE_PROTRUSION_MIN + Math.random() * (C.SPIKE_PROTRUSION_MAX - C.SPIKE_PROTRUSION_MIN);
      spikes.push({
        side: side,
        y: nextSpikeY,
        protrusion: protrusion,
        checked: false,
        minDist: Infinity,
      });
      var gap = (C.SPIKE_GAP_BASE + Math.random() * C.SPIKE_GAP_RAND) / lvl;
      nextSpikeY -= gap;
    }
  }

  function spikeTip(spike) {
    if (spike.side === 'left') {
      return { x: C.WALL_W + spike.protrusion, y: spike.y };
    }
    return { x: C.CANVAS_W - C.WALL_W - spike.protrusion, y: spike.y };
  }

  function wallXFor(side) {
    return side === 'left' ? C.WALL_W + C.NINJA_R : C.CANVAS_W - C.WALL_W - C.NINJA_R;
  }

  function startCharge() {
    if (state !== STATES.PLAYING) return;
    if (!ninja.onWall || ninja.charging) return;
    ninja.charging = true;
    ninja.chargingMs = 0;
    NW.audio.unlock();
  }

  function releaseCharge() {
    if (state !== STATES.PLAYING) return;
    if (!ninja.charging) return;
    var tier = C.tierForChargeMs(ninja.chargingMs);
    ninja.charging = false;
    ninja.onWall = false;
    var dir = ninja.side === 'left' ? 1 : -1;
    ninja.vx = C.jumpVXForTier(tier) * dir;
    ninja.vy = C.TIER_JY[tier];
    ninja.gm = C.TIER_GM[tier];
    NW.audio.playJump(tier);
    NW.analytics.track('jump', { tier: tier });
  }

  function killNinja(reason) {
    if (state !== STATES.PLAYING) return;
    state = STATES.GAMEOVER;
    var finalScore = currentScore();
    score = finalScore;
    var isNewBest = NW.storage.setBest(finalScore);
    best = NW.storage.getBest();
    NW.audio.playGameOver();
    NW.poki.gameplayStop();
    NW.analytics.track('game_over', { reason: reason, score: finalScore, best: best, newBest: isNewBest });
    emitChange({ reason: reason, newBest: isNewBest });
  }

  function updatePhysics() {
    // Kamera folgt nur nach oben (nie zurück nach unten)
    var targetCamY = ninja.y - C.CANVAS_H * C.CAMERA_FOLLOW_RATIO;
    if (targetCamY < camera.y) camera.y = targetCamY;

    ninja.maxHeight = Math.max(ninja.maxHeight, heightClimbed());
    lvl = computeLvl();
    ensureSpikesAhead();

    if (ninja.onWall) {
      ninja.y += C.WALL_SLIDE_SPEED;
      ninja.x = wallXFor(ninja.side);
      if (ninja.charging) {
        ninja.chargingMs = Math.min(C.CHARGE_MAX_MS, ninja.chargingMs + STEP_MS);
      }
    } else {
      ninja.vy += C.GRAVITY * ninja.gm;
      ninja.x += ninja.vx;
      ninja.y += ninja.vy;

      var targetSide = ninja.side === 'left' ? 'right' : 'left';
      var targetX = wallXFor(targetSide);
      var reached = targetSide === 'right' ? ninja.x >= targetX : ninja.x <= targetX;
      if (reached) {
        ninja.x = targetX;
        ninja.side = targetSide;
        ninja.onWall = true;
        ninja.vx = 0;
        ninja.vy = 0;
        ninja.gm = 1;
        ninja.squash = C.SQUASH_INITIAL;
        var dustDir = targetSide === 'left' ? 1 : -1;
        NW.particles.spawnDust(ninja.x, ninja.y, dustDir);
        NW.audio.playLand();
        NW.analytics.track('land', { side: targetSide });
      }
    }

    if (ninja.squash !== 0) {
      if (ninja.squash > 0) ninja.squash = Math.max(0, ninja.squash - C.SQUASH_DECAY);
      else ninja.squash = Math.min(0, ninja.squash + C.SQUASH_DECAY);
    }

    NW.particles.update();
    updateSpikes();

    // Absturz: weit unterhalb der Kamera gefallen
    if (ninja.y - camera.y > C.CANVAS_H + C.FALL_MARGIN) {
      killNinja('fell');
      return;
    }

    // Aufräumen: Stacheln weit unterhalb der Kamera entfernen
    while (spikes.length && spikes[0].y - camera.y > C.CANVAS_H + 200) {
      spikes.shift();
    }
  }

  function updateSpikes() {
    var ninjaHitR = C.NINJA_R * C.SPIKE_HIT_RADIUS_FACTOR;
    for (var i = 0; i < spikes.length; i++) {
      var s = spikes[i];
      if (s.checked) continue;
      var tip = spikeTip(s);
      var dx = ninja.x - tip.x;
      var dy = ninja.y - tip.y;
      var dist = Math.sqrt(dx * dx + dy * dy);

      // Nur relevant, während der Ninja in der Nähe der Stachelhöhe ist
      if (Math.abs(ninja.y - s.y) < 60) {
        if (dist < s.minDist) s.minDist = dist;
        if (dist < ninjaHitR + C.SPIKE_BASE_HALF) {
          killNinja('spike');
          return;
        }
      }

      // Stachel wurde passiert (Ninja ist darüber hinausgeklettert)
      if (ninja.y < s.y - 24) {
        s.checked = true;
        if (s.minDist < C.KNAPP_DISTANCE_PX) {
          flashes.push({ x: tip.x, y: s.y, life: 1, text: 'Knapp!' });
          NW.audio.playKnapp();
          NW.analytics.track('close_call', {});
        }
      }
    }

    for (var f = flashes.length - 1; f >= 0; f--) {
      flashes[f].life -= 0.02;
      flashes[f].y -= 0.4;
      if (flashes[f].life <= 0) flashes.splice(f, 1);
    }
  }

  // ---------- Rendering ----------

  function draw() {
    ctx.clearRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    // Hintergrund
    ctx.fillStyle = '#1c2333';
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    // Wände
    ctx.fillStyle = '#3a4a63';
    ctx.fillRect(0, 0, C.WALL_W, C.CANVAS_H);
    ctx.fillRect(C.CANVAS_W - C.WALL_W, 0, C.WALL_W, C.CANVAS_H);
    ctx.fillStyle = '#2c3a52';
    ctx.fillRect(C.WALL_W - 4, 0, 4, C.CANVAS_H);
    ctx.fillRect(C.CANVAS_W - C.WALL_W, 0, 4, C.CANVAS_H);

    if (state === STATES.MENU) {
      drawNinja();
      return;
    }

    drawSpikes();
    NW.particles.draw(ctx, camera.y);
    drawNinja();
    drawChargeRings();
    drawFlashes();
  }

  function drawSpikes() {
    for (var i = 0; i < spikes.length; i++) {
      var s = spikes[i];
      var screenY = s.y - camera.y;
      if (screenY < -40 || screenY > C.CANVAS_H + 40) continue;
      var tip = spikeTip(s);
      var baseX = s.side === 'left' ? C.WALL_W : C.CANVAS_W - C.WALL_W;
      var half = 10;

      ctx.fillStyle = '#ef5a4c';
      ctx.beginPath();
      ctx.moveTo(baseX, screenY - half);
      ctx.lineTo(tip.x, screenY);
      ctx.lineTo(baseX, screenY + half);
      ctx.closePath();
      ctx.fill();

      // freundlicher Glanzpunkt statt aggressiver Kontur
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.moveTo(baseX, screenY - half * 0.4);
      ctx.lineTo(tip.x, screenY);
      ctx.lineTo(baseX, screenY - half * 0.1);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawNinja() {
    var screenY = ninja.y - camera.y;
    var sx = 1 - Math.max(-0.5, Math.min(0.5, ninja.squash)) * 0.5;
    var sy = 1 + Math.max(-0.5, Math.min(0.5, ninja.squash)) * 0.5;

    ctx.save();
    ctx.translate(ninja.x, screenY);
    ctx.scale(sx, sy);

    // Körper
    ctx.fillStyle = '#2b2f3a';
    ctx.beginPath();
    ctx.arc(0, 0, C.NINJA_R, 0, Math.PI * 2);
    ctx.fill();

    // Stirnband (freundlich, kindgerecht statt martialisch)
    ctx.fillStyle = '#e63946';
    ctx.fillRect(-C.NINJA_R, -3, C.NINJA_R * 2, 4);

    // Augen
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-3.5, -1, 2.2, 0, Math.PI * 2);
    ctx.arc(3.5, -1, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    var lookDir = ninja.side === 'left' ? 1 : -1;
    ctx.beginPath();
    ctx.arc(-3.5 + lookDir * 0.8, -1, 1.1, 0, Math.PI * 2);
    ctx.arc(3.5 + lookDir * 0.8, -1, 1.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawChargeRings() {
    if (!ninja.charging) return;
    var tier = C.tierForChargeMs(ninja.chargingMs);
    var screenY = ninja.y - camera.y;
    for (var t = 0; t <= tier; t++) {
      var radius = C.NINJA_R + 6 + t * 5;
      ctx.strokeStyle = 'rgba(255, 210, 90, ' + (0.85 - t * 0.12) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ninja.x, screenY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawFlashes() {
    for (var i = 0; i < flashes.length; i++) {
      var f = flashes[i];
      var screenY = f.y - camera.y;
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = '#ffd15c';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, ninja.x, screenY - 16);
      ctx.globalAlpha = 1;
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

    draw();
  }

  // ---------- Öffentliche API ----------

  var game = {
    STATES: STATES,

    init: function (canvasEl) {
      canvas = canvasEl;
      ctx = canvas.getContext('2d');
      best = NW.storage.getBest();
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
      NW.audio.unlock();
      NW.poki.gameplayStart();
      NW.analytics.track('game_start', {});
      emitChange();
    },

    restart: function () {
      game.start();
    },

    pause: function () {
      if (state !== STATES.PLAYING) return;
      state = STATES.PAUSED;
      NW.analytics.track('pause', {});
      emitChange();
    },

    resume: function () {
      if (state !== STATES.PAUSED) return;
      state = STATES.PLAYING;
      lastTs = null;
      NW.analytics.track('resume', {});
      emitChange();
    },

    togglePause: function () {
      if (state === STATES.PLAYING) game.pause();
      else if (state === STATES.PAUSED) game.resume();
    },

    chargeStart: startCharge,
    chargeRelease: releaseCharge,

    toggleSound: function () {
      var on = NW.audio.toggle();
      NW.analytics.track('sound_toggle', { enabled: on });
      return on;
    },

    // Für manuelle/automatisierte Tests (siehe README).
    getDebugState: function () {
      return {
        state: state,
        score: currentScore(),
        best: best,
        lvl: lvl,
        ninjaY: ninja ? ninja.y : null,
        cameraY: camera ? camera.y : null,
        spikeCount: spikes ? spikes.length : 0,
      };
    },
  };

  NW.game = game;
})(window);
