/**
 * Astro Ascent – Spiellogik & Rendering.
 *
 * Gleiche Grundmechanik wie Ninja Wandsprung (Wandrutsch, Ladesprung,
 * endlos nach oben), aber eigenständig abgestimmt statt nur reskinnt:
 *
 * - Astronaut statt Ninja, Weltraum-Schacht statt Dojo, Sternenfeld +
 *   vorbeiziehende Planeten im Hintergrund (Parallax, per Modulo endlos
 *   gekachelt statt wachsender Arrays).
 * - Physik floatiger (niedrigere Basis-Schwerkraft + niedrigerer
 *   Gravitations-Multiplikator pro Stufe + "Apex-Float": nahe des
 *   Scheitelpunkts wirkt kurz zusätzlich weniger Schwerkraft) – fühlt
 *   sich nach kurzem freiem Fliegen an, nicht nur nach höherem Sprung.
 * - Zweiter Hindernis-Typ: Laser-Geschütze mit festem Rhythmus
 *   (sicher -> Warnung -> Feuer). Erfordert Anschleichen/Timing statt
 *   nur seitliches Ausweichen wie bei den Asteroidenbrocken.
 */
(function (global) {
  'use strict';

  var NW = global.NW = global.NW || {};
  var C = NW.constants;

  var STEP_MS = 1000 / 60;
  var MAX_STEPS_PER_FRAME = 8;

  var STATES = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', GAMEOVER: 'gameover' };

  var canvas, ctx;
  var state = STATES.MENU;
  var changeListeners = [];

  var astro, camera, obstacles, nextObstacleY, lvl, score, best, flashes, accMs, lastTs, rafId, simMs;
  var stars, planets;

  function emitChange(extra) {
    var payload = Object.assign({ state: state, score: Math.floor(score || 0), best: best || 0 }, extra || {});
    changeListeners.forEach(function (cb) {
      try { cb(payload); } catch (e) { /* Listener-Fehler nie das Spiel stören lassen */ }
    });
  }

  // ---------- Hintergrund: Sterne & Planeten (fest, endlos gekachelt) ----------
  //
  // Statt eines wachsenden Arrays (das Spiel endet nie außer durch Tod)
  // bekommt jeder Stern/Planet nur eine feste Zufalls-"Saat" (seedY, x, ...)
  // und wird per Modulo auf die aktuelle Kamera-Position abgebildet – dadurch
  // kachelt der Hintergrund nahtlos endlos, ohne dass je etwas neu erzeugt
  // oder aufgeräumt werden müsste.

  function initBackground() {
    stars = [];
    for (var i = 0; i < 55; i++) {
      stars.push({
        seedY: Math.random() * (C.CANVAS_H + 40),
        x: C.WALL_W * 0.3 + Math.random() * (C.CANVAS_W - C.WALL_W * 0.6),
        parallax: 0.35 + Math.random() * 0.35,
        size: 0.6 + Math.random() * 1.4,
        twinkleSpeed: 0.5 + Math.random() * 1.5,
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }

    var period = C.CANVAS_H * 6;
    var palette = ['#e0956b', '#6ba8d6', '#c7a5e0', '#e0c56b'];
    planets = [];
    for (var p = 0; p < 4; p++) {
      planets.push({
        seedY: (p / 4) * period + Math.random() * (period / 4),
        period: period,
        x: C.CANVAS_W * 0.5 + (Math.random() - 0.5) * 90,
        parallax: 0.12 + Math.random() * 0.1,
        radius: 34 + Math.random() * 46,
        color: palette[p % palette.length],
        ringed: p === 1,
      });
    }
  }

  function wrapY(seed, parallax, period) {
    var raw = seed - camera.y * parallax;
    var m = raw % period;
    if (m < 0) m += period;
    return m;
  }

  function resetWorld() {
    astro = {
      side: 'left',
      x: C.WALL_W + C.NINJA_R,
      y: C.CANVAS_H - 90,
      vx: 0,
      vy: 0,
      onWall: true,
      chargingMs: 0,
      charging: false,
      gm: 1,
      squash: 0,
      startY: C.CANVAS_H - 90,
      maxHeight: 0,
    };
    camera = { y: 0 };
    obstacles = [];
    lvl = 1;
    nextObstacleY = astro.y - (C.SPIKE_GAP_BASE + Math.random() * C.SPIKE_GAP_RAND) / lvl;
    score = 0;
    flashes = [];
    simMs = 0;
    NW.particles.reset();
    initBackground();
    ensureObstaclesAhead();
  }

  function heightClimbed() {
    return Math.max(0, astro.startY - astro.y);
  }

  function currentScore() {
    return Math.floor(astro.maxHeight);
  }

  function computeLvl() {
    var h = heightClimbed();
    if (h <= C.LEVEL_RAMP_START_HEIGHT) return 1;
    var t = Math.min(1, (h - C.LEVEL_RAMP_START_HEIGHT) / C.LEVEL_RAMP_RANGE);
    return 1 + t * (C.LEVEL_CAP - 1);
  }

  var lastRockSide = null;

  function ensureObstaclesAhead() {
    var horizon = camera.y - C.CANVAS_H * 2.2;
    while (nextObstacleY > horizon) {
      var heightHere = astro.startY - nextObstacleY;
      var useLaser = heightHere >= C.LASER_GATE_START_HEIGHT && Math.random() < C.LASER_GATE_CHANCE;

      if (useLaser) {
        obstacles.push({
          kind: 'laser',
          y: nextObstacleY,
          phaseOffsetMs: Math.random() * (C.LASER_IDLE_MS + C.LASER_WARNING_MS + C.LASER_FIRING_MS),
          passed: false,
          timedFlash: false,
        });
      } else {
        var side = Math.random() < 0.5 ? 'left' : 'right';
        if (side === lastRockSide && Math.random() < 0.6) {
          side = side === 'left' ? 'right' : 'left';
        }
        lastRockSide = side;
        var protrusion = C.SPIKE_PROTRUSION_MIN + Math.random() * (C.SPIKE_PROTRUSION_MAX - C.SPIKE_PROTRUSION_MIN);
        obstacles.push({
          kind: 'rock',
          side: side,
          y: nextObstacleY,
          protrusion: protrusion,
          checked: false,
          minDist: Infinity,
        });
      }

      var gap = (C.SPIKE_GAP_BASE + Math.random() * C.SPIKE_GAP_RAND) / lvl;
      nextObstacleY -= gap;
    }
  }

  function rockTip(rock) {
    if (rock.side === 'left') {
      return { x: C.WALL_W + rock.protrusion, y: rock.y };
    }
    return { x: C.CANVAS_W - C.WALL_W - rock.protrusion, y: rock.y };
  }

  function wallXFor(side) {
    return side === 'left' ? C.WALL_W + C.NINJA_R : C.CANVAS_W - C.WALL_W - C.NINJA_R;
  }

  // idle-Fenster schrumpft leicht mit lvl (etwas engeres Timing weiter oben)
  function laserPeriod() {
    var idle = C.LASER_IDLE_MS / lvl;
    return { idle: idle, total: idle + C.LASER_WARNING_MS + C.LASER_FIRING_MS };
  }

  function laserPhase(gate) {
    var p = laserPeriod();
    var t = (simMs + gate.phaseOffsetMs) % p.total;
    if (t < p.idle) return 'idle';
    if (t < p.idle + C.LASER_WARNING_MS) return 'warning';
    return 'firing';
  }

  function startCharge() {
    if (state !== STATES.PLAYING) return;
    if (!astro.onWall || astro.charging) return;
    astro.charging = true;
    astro.chargingMs = 0;
    NW.audio.unlock();
  }

  function releaseCharge() {
    if (state !== STATES.PLAYING) return;
    if (!astro.charging) return;
    var tier = C.tierForChargeMs(astro.chargingMs);
    astro.charging = false;
    astro.onWall = false;
    var dir = astro.side === 'left' ? 1 : -1;
    astro.vx = C.jumpVXForTier(tier) * dir;
    astro.vy = C.TIER_JY[tier];
    astro.gm = C.TIER_GM[tier];
    NW.audio.playJump(tier);
    NW.analytics.track('jump', { tier: tier });
  }

  function killAstro(reason) {
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
    simMs += STEP_MS;

    var targetCamY = astro.y - C.CANVAS_H * C.CAMERA_FOLLOW_RATIO;
    if (targetCamY < camera.y) camera.y = targetCamY;

    astro.maxHeight = Math.max(astro.maxHeight, heightClimbed());
    lvl = computeLvl();
    ensureObstaclesAhead();

    if (astro.onWall) {
      astro.y += C.WALL_SLIDE_SPEED;
      astro.x = wallXFor(astro.side);
      if (astro.charging) {
        astro.chargingMs = Math.min(C.CHARGE_MAX_MS, astro.chargingMs + STEP_MS);
      }
    } else {
      var g = C.GRAVITY * astro.gm;
      // Apex-Float: nahe des Scheitelpunkts wirkt kurz zusätzlich weniger
      // Schwerkraft -> fühlt sich wie ein kurzer freier Flug an.
      if (Math.abs(astro.vy) < C.APEX_FLOAT_VY_THRESHOLD) {
        g *= C.APEX_FLOAT_GRAVITY_MULT;
      }
      astro.vy += g;
      astro.x += astro.vx;
      astro.y += astro.vy;

      // Trieb-Partikel während des Flugs
      if (Math.random() < 0.7) {
        NW.particles.spawnThrust(astro.x, astro.y + C.NINJA_R * 0.6, astro.side === 'left' ? -1 : 1);
      }

      var targetSide = astro.side === 'left' ? 'right' : 'left';
      var targetX = wallXFor(targetSide);
      var reached = targetSide === 'right' ? astro.x >= targetX : astro.x <= targetX;
      if (reached) {
        astro.x = targetX;
        astro.side = targetSide;
        astro.onWall = true;
        astro.vx = 0;
        astro.vy = 0;
        astro.gm = 1;
        astro.squash = C.SQUASH_INITIAL;
        var dustDir = targetSide === 'left' ? 1 : -1;
        NW.particles.spawnDust(astro.x, astro.y, dustDir);
        NW.audio.playLand();
        NW.analytics.track('land', { side: targetSide });
      }
    }

    if (astro.squash !== 0) {
      if (astro.squash > 0) astro.squash = Math.max(0, astro.squash - C.SQUASH_DECAY);
      else astro.squash = Math.min(0, astro.squash + C.SQUASH_DECAY);
    }

    NW.particles.update();
    updateObstacles();

    if (astro.y - camera.y > C.CANVAS_H + C.FALL_MARGIN) {
      killAstro('fell');
      return;
    }

    while (obstacles.length && obstacles[0].y - camera.y > C.CANVAS_H + 200) {
      obstacles.shift();
    }
  }

  function updateObstacles() {
    var astroHitR = C.NINJA_R * C.SPIKE_HIT_RADIUS_FACTOR;

    for (var i = 0; i < obstacles.length; i++) {
      var o = obstacles[i];

      if (o.kind === 'rock') {
        if (o.checked) continue;
        var tip = rockTip(o);
        var dx = astro.x - tip.x;
        var dy = astro.y - tip.y;
        var dist = Math.sqrt(dx * dx + dy * dy);

        if (Math.abs(astro.y - o.y) < 60) {
          if (dist < o.minDist) o.minDist = dist;
          if (dist < astroHitR + C.SPIKE_BASE_HALF) {
            killAstro('rock');
            return;
          }
        }

        if (astro.y < o.y - 24) {
          o.checked = true;
          if (o.minDist < C.KNAPP_DISTANCE_PX) {
            flashes.push({ x: tip.x, y: o.y, life: 1, text: 'Knapp!' });
            NW.audio.playKnapp();
            NW.analytics.track('close_call', { type: 'rock' });
          }
        }
        continue;
      }

      // kind === 'laser'
      var phase = laserPhase(o);
      if (phase === 'firing') {
        var beamDist = Math.abs(astro.y - o.y);
        if (beamDist < C.LASER_BEAM_HALF_THICKNESS + astroHitR) {
          killAstro('laser');
          return;
        }
      }

      if (!o.passed && astro.y < o.y - 20) {
        o.passed = true;
        if (phase === 'warning') {
          flashes.push({ x: astro.x, y: o.y, life: 1, text: 'Getimt!' });
          NW.audio.playKnapp();
          NW.analytics.track('close_call', { type: 'laser' });
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

    drawSpaceBackground();

    // Wände: Metall-Schacht statt Dojo-Wand
    ctx.fillStyle = '#2e3a4d';
    ctx.fillRect(0, 0, C.WALL_W, C.CANVAS_H);
    ctx.fillRect(C.CANVAS_W - C.WALL_W, 0, C.WALL_W, C.CANVAS_H);
    ctx.fillStyle = '#232c3c';
    ctx.fillRect(C.WALL_W - 4, 0, 4, C.CANVAS_H);
    ctx.fillRect(C.CANVAS_W - C.WALL_W, 0, 4, C.CANVAS_H);
    drawRivets();

    if (state === STATES.MENU) {
      drawAstronaut();
      return;
    }

    drawObstacles();
    NW.particles.draw(ctx, camera.y);
    drawAstronaut();
    drawChargeRings();
    drawFlashes();
  }

  function drawSpaceBackground() {
    var grad = ctx.createLinearGradient(0, 0, 0, C.CANVAS_H);
    grad.addColorStop(0, '#0a0e1c');
    grad.addColorStop(1, '#141b31');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    for (var p = 0; p < planets.length; p++) {
      var pl = planets[p];
      var py = wrapY(pl.seedY, pl.parallax, pl.period) - pl.period * 0.08;
      if (py < -pl.radius * 2 || py > C.CANVAS_H + pl.radius * 2) continue;
      ctx.save();
      ctx.fillStyle = pl.color;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(pl.x, py, pl.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.arc(pl.x + pl.radius * 0.3, py + pl.radius * 0.3, pl.radius * 0.75, 0, Math.PI * 2);
      ctx.fill();
      if (pl.ringed) {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = pl.radius * 0.16;
        ctx.beginPath();
        ctx.ellipse(pl.x, py, pl.radius * 1.55, pl.radius * 0.4, -0.35, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var sy = wrapY(s.seedY, s.parallax, C.CANVAS_H + 40) - 20;
      var twinkle = 0.5 + 0.5 * Math.sin(simMs / 1000 * s.twinkleSpeed + s.twinklePhase);
      ctx.globalAlpha = 0.35 + twinkle * 0.65;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, sy, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawRivets() {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    var step = 40;
    var offset = (-camera.y) % step;
    for (var y = -offset; y < C.CANVAS_H; y += step) {
      ctx.beginPath();
      ctx.arc(10, y, 2, 0, Math.PI * 2);
      ctx.arc(C.CANVAS_W - 10, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawObstacles() {
    for (var i = 0; i < obstacles.length; i++) {
      var o = obstacles[i];
      var screenY = o.y - camera.y;
      if (screenY < -50 || screenY > C.CANVAS_H + 50) continue;

      if (o.kind === 'rock') {
        drawRock(o, screenY);
      } else {
        drawLaserGate(o, screenY);
      }
    }
  }

  function drawRock(rock, screenY) {
    var tip = rockTip(rock);
    var baseX = rock.side === 'left' ? C.WALL_W : C.CANVAS_W - C.WALL_W;
    var half = 10;

    ctx.fillStyle = '#8a7a6b';
    ctx.beginPath();
    ctx.moveTo(baseX, screenY - half);
    ctx.lineTo(tip.x, screenY);
    ctx.lineTo(baseX, screenY + half);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.moveTo(baseX, screenY - half * 0.4);
    ctx.lineTo(tip.x, screenY);
    ctx.lineTo(baseX, screenY - half * 0.1);
    ctx.closePath();
    ctx.fill();
  }

  function drawLaserGate(gate, screenY) {
    var phase = laserPhase(gate);
    var leftX = C.WALL_W;
    var rightX = C.CANVAS_W - C.WALL_W;

    var lensColor = '#4fd6e0';
    if (phase === 'warning') {
      var flicker = 0.5 + 0.5 * Math.sin(simMs / 60);
      lensColor = flicker > 0.4 ? '#ff9a4a' : '#5a3a24';
    } else if (phase === 'firing') {
      lensColor = '#ff4a4a';
    }

    // Turmsockel an beiden Wänden
    ctx.fillStyle = '#556074';
    ctx.fillRect(leftX - 2, screenY - 6, 10, 12);
    ctx.fillRect(rightX - 8, screenY - 6, 10, 12);
    ctx.fillStyle = lensColor;
    ctx.beginPath();
    ctx.arc(leftX + 6, screenY, 3.5, 0, Math.PI * 2);
    ctx.arc(rightX - 6, screenY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    if (phase === 'firing') {
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = '#ff4a4a';
      ctx.lineWidth = C.LASER_BEAM_HALF_THICKNESS * 2.4;
      ctx.beginPath();
      ctx.moveTo(leftX + 8, screenY);
      ctx.lineTo(rightX - 8, screenY);
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.strokeStyle = '#ffdede';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(leftX + 8, screenY);
      ctx.lineTo(rightX - 8, screenY);
      ctx.stroke();
    }
  }

  function drawAstronaut() {
    var screenY = astro.y - camera.y;
    var sx = 1 - Math.max(-0.5, Math.min(0.5, astro.squash)) * 0.5;
    var sy = 1 + Math.max(-0.5, Math.min(0.5, astro.squash)) * 0.5;

    ctx.save();
    ctx.translate(astro.x, screenY);
    ctx.scale(sx, sy);

    // Anzug (weißes Kollar, etwas größer als das Helmglas)
    ctx.fillStyle = '#e9edf2';
    ctx.beginPath();
    ctx.arc(0, 0, C.NINJA_R, 0, Math.PI * 2);
    ctx.fill();

    // Helmglas
    ctx.fillStyle = '#1c2a3d';
    ctx.beginPath();
    ctx.arc(0, 0.5, C.NINJA_R * 0.78, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7fd8e8';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Glas-Reflexion
    var lookDir = astro.side === 'left' ? 1 : -1;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(lookDir * 2.4, -2.6, 2.6, 1.6, 0.5, 0, Math.PI * 2);
    ctx.fill();

    // kleine Antenne
    ctx.strokeStyle = '#c7cdd6';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -C.NINJA_R);
    ctx.lineTo(0, -C.NINJA_R - 3);
    ctx.stroke();
    ctx.fillStyle = '#ff9a4a';
    ctx.beginPath();
    ctx.arc(0, -C.NINJA_R - 3, 1.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawChargeRings() {
    if (!astro.charging) return;
    var tier = C.tierForChargeMs(astro.chargingMs);
    var screenY = astro.y - camera.y;
    for (var t = 0; t <= tier; t++) {
      var radius = C.NINJA_R + 6 + t * 5;
      ctx.strokeStyle = 'rgba(79, 214, 224, ' + (0.85 - t * 0.12) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(astro.x, screenY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawFlashes() {
    for (var i = 0; i < flashes.length; i++) {
      var f = flashes[i];
      var screenY = f.y - camera.y;
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = '#7fd8e8';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, astro.x, screenY - 16);
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

    getDebugState: function () {
      return {
        state: state,
        score: currentScore(),
        best: best,
        lvl: lvl,
        astroY: astro ? astro.y : null,
        cameraY: camera ? camera.y : null,
        obstacleCount: obstacles ? obstacles.length : 0,
      };
    },
  };

  NW.game = game;
})(window);
