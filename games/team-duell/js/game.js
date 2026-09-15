/**
 * Team-Duell mit Mauer – Zustandsmaschine, Physik-Loop (fix 60Hz) und
 * Rendering. 3 gegen 3 (Spieler + 2 KI-Teammates gegen 3 KI-Gegner),
 * gemeinsamer Team-Lebenspool je Seite (Spec: "bewusste Vereinfachung").
 *
 * Orchestriert die anderen Module: `wall.js` (Mauer-Kollision),
 * `projectiles.js` (Schuss/Wurf), `ai.js` (Teammates + Gegner),
 * `particles.js`/`sounds.js` (Feedback). Eingaben kommen über die
 * öffentliche API von `input.js` (drei Sticks + Kommando-Buttons).
 */
(function (global) {
  'use strict';

  var TD = global.TD = global.TD || {};
  var SG = global.SG;
  var C = TD.constants;

  var STEP_MS = 1000 / 60;
  var MAX_STEPS_PER_FRAME = 8;

  var STATES = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', GAMEOVER: 'gameover' };

  var canvas, ctx;
  var state = STATES.MENU;
  var changeListeners = [];
  var best, accMs, lastTs, rafId;
  var world;

  function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }

  function emitChange(extra) {
    var payload = Object.assign({ state: state, best: best || 0 }, extra || {});
    changeListeners.forEach(function (cb) {
      try { cb(payload); } catch (e) { /* Listener-Fehler nie das Spiel stören lassen */ }
    });
  }

  function resetWorld() {
    var player = TD.ai.makeUnit('you', 'player', 'human', C.PLAYER_START_X[0], C.PLAYER_START_Y, C.PLAYER_COLOR, 0);
    var mateA = TD.ai.makeUnit('mate-a', 'player', 'teammate', C.PLAYER_START_X[1], C.PLAYER_START_Y, C.TEAMMATE_COLOR, 0);
    var mateB = TD.ai.makeUnit('mate-b', 'player', 'teammate', C.PLAYER_START_X[2], C.PLAYER_START_Y, C.TEAMMATE_COLOR, 1);
    var enemies = [];
    for (var i = 0; i < C.TEAM_SIZE; i++) {
      enemies.push(TD.ai.makeUnit('foe-' + i, 'enemy', 'enemy', C.ENEMY_START_X[i], C.ENEMY_START_Y, C.ENEMY_COLOR, i));
    }

    world = {
      playerUnits: [player, mateA, mateB],
      enemyUnits: enemies,
      wallPlayer: TD.wall.create(C.PLAYER_WALL_Y, C.WALL_PLAYER_COLOR),
      wallEnemy: TD.wall.create(C.ENEMY_WALL_Y, C.WALL_ENEMY_COLOR),
      teamHP: { player: C.TEAM_HP_MAX, enemy: C.TEAM_HP_MAX },
      bullets: [],
      throws: [],
      activeCommand: C.DEFAULT_COMMAND,
      moveVector: { dx: 0, dy: 0, magnitude: 0 },
      aimActive: false,
      aimAngle: 0,
      playerFireTimer: 0,
      throwAimActive: false,
      throwAimTarget: null,
      throwCooldown: 0,
      frameCount: 0,
      shakeFrames: 0,
    };
    TD.particles.reset();
  }

  // ---------- Schaden/Treffer-Feedback ----------

  function vibrate(pattern) {
    // Rein kosmetisch, nie das Spiel stören lassen: iOS Safari kennt die
    // API z.B. nicht, andere Browser können sie ablehnen (kein Nutzer-Tap
    // zuvor). try/catch statt Feature-Verzweigung, da manche Browser die
    // Methode zwar anbieten, aber wirft, statt still false zurückzugeben.
    try { if (global.navigator && global.navigator.vibrate) global.navigator.vibrate(pattern); } catch (e) { /* ignorieren */ }
  }

  function damageTeam(side, amount) {
    if (!amount) return;
    world.teamHP[side] = Math.max(0, world.teamHP[side] - amount);
    if (side === 'player') {
      world.shakeFrames = C.SHAKE_FRAMES;
      vibrate(15);
    }
  }

  function onBulletDamage(info) {
    if (info.kind === 'wall') {
      if (info.justBroke) {
        TD.particles.spawnPoof(info.x, info.y, '#dfe9ff', 14);
        TD.sounds.playWallBreak();
      } else {
        TD.particles.spawnPoof(info.x, info.y, '#dfe9ff', 6);
        TD.sounds.playWallHit();
      }
      return;
    }
    var color = info.defSide === 'player' ? C.PLAYER_COLOR : C.ENEMY_COLOR;
    TD.particles.spawnPoof(info.x, info.y, color, 9);
    TD.sounds.playUnitHit();
    if (info.unit) info.unit.flashFrames = C.HIT_FLASH_FRAMES;
    damageTeam(info.defSide, info.amount);
  }

  function onThrowLand(info) {
    var color = info.wasHit ? (info.defSide === 'player' ? C.PLAYER_COLOR : C.ENEMY_COLOR) : 'rgba(244,241,234,0.6)';
    TD.particles.spawnSplash(info.x, info.y, color);
    if (info.wasHit) {
      TD.sounds.playSplashHit();
      if (info.unit) info.unit.flashFrames = C.HIT_FLASH_FRAMES;
      damageTeam(info.defSide, info.amount);
    } else {
      TD.sounds.playSplashMiss();
    }
  }

  function decayFlash() {
    var i;
    for (i = 0; i < world.playerUnits.length; i++) {
      if (world.playerUnits[i].flashFrames > 0) world.playerUnits[i].flashFrames--;
    }
    for (i = 0; i < world.enemyUnits.length; i++) {
      if (world.enemyUnits[i].flashFrames > 0) world.enemyUnits[i].flashFrames--;
    }
  }

  // ---------- Physik ----------

  function updatePlayerMovement() {
    var player = world.playerUnits[0];
    var mv = world.moveVector;
    player.x = clamp(player.x + mv.dx * mv.magnitude * C.PLAYER_SPEED, C.FIELD_X_MIN, C.FIELD_X_MAX);
    player.y = clamp(player.y + mv.dy * mv.magnitude * C.PLAYER_SPEED, C.PLAYER_ZONE_Y_MIN, C.PLAYER_ZONE_Y_MAX);
    TD.ai.updateVelocity(player);
  }

  function updatePlayerFire() {
    world.playerFireTimer -= STEP_MS;
    if (world.aimActive && world.playerFireTimer <= 0) {
      var player = world.playerUnits[0];
      TD.projectiles.spawnBullet(world.bullets, player.x, player.y, world.aimAngle, 'player');
      TD.particles.spawnMuzzle(player.x, player.y, C.PLAYER_COLOR);
      TD.sounds.playShoot();
      world.playerFireTimer = C.PLAYER_FIRE_INTERVAL_MS;
    }
  }

  function updateAiUnits() {
    var i;
    for (i = 0; i < 2; i++) {
      TD.ai.updateTeammate(world.playerUnits[i + 1], i, world.playerUnits[0], world.activeCommand);
    }
    var enemyHpFrac = world.teamHP.enemy / C.TEAM_HP_MAX;
    for (i = 0; i < world.enemyUnits.length; i++) {
      TD.ai.updateEnemy(world.enemyUnits[i], i, world.frameCount, enemyHpFrac);
    }

    // Feuer-/Wurf-Entscheidungen für alle KI-Einheiten (Teammates greifen
    // Gegner an, Gegner greifen das gesamte Spieler-Team inkl. Mensch an).
    for (i = 1; i < world.playerUnits.length; i++) {
      var mate = world.playerUnits[i];
      var fire = TD.ai.decideFire(mate, world.enemyUnits, STEP_MS);
      if (fire) {
        TD.projectiles.spawnBullet(world.bullets, mate.x, mate.y, fire.angle, 'player');
        TD.particles.spawnMuzzle(mate.x, mate.y, C.TEAMMATE_COLOR);
      }
      var throwDecision = TD.ai.decideThrow(mate, world.enemyUnits, STEP_MS);
      if (throwDecision) TD.projectiles.spawnThrow(world.throws, mate.x, mate.y, throwDecision.x, throwDecision.y, 'player');
    }
    for (i = 0; i < world.enemyUnits.length; i++) {
      var foe = world.enemyUnits[i];
      var foeFire = TD.ai.decideFire(foe, world.playerUnits, STEP_MS);
      if (foeFire) {
        TD.projectiles.spawnBullet(world.bullets, foe.x, foe.y, foeFire.angle, 'enemy');
        TD.particles.spawnMuzzle(foe.x, foe.y, C.ENEMY_COLOR);
      }
      var foeThrow = TD.ai.decideThrow(foe, world.playerUnits, STEP_MS);
      if (foeThrow) TD.projectiles.spawnThrow(world.throws, foe.x, foe.y, foeThrow.x, foeThrow.y, 'enemy');
    }
  }

  function checkRoundEnd() {
    if (state !== STATES.PLAYING) return;
    if (world.teamHP.player <= 0) {
      endRound('lose');
    } else if (world.teamHP.enemy <= 0) {
      endRound('win');
    }
  }

  function updatePhysics() {
    world.frameCount++;
    updatePlayerMovement();
    updatePlayerFire();
    if (world.throwCooldown > 0) world.throwCooldown -= STEP_MS;
    updateAiUnits();

    TD.projectiles.updateBullets(world.bullets, world, onBulletDamage);
    TD.projectiles.updateThrows(world.throws, world, onThrowLand);
    decayFlash();

    checkRoundEnd();
  }

  function endRound(result) {
    state = STATES.GAMEOVER;
    // Annahme (Spec nennt kein Punktesystem): Score = verbleibendes
    // eigenes Team-HP beim Sieg – je "sauberer" gewonnen, desto höher.
    // Bei einer Niederlage wird kein neuer Highscore gewertet.
    var score = result === 'win' ? Math.round(world.teamHP.player) : 0;
    var isNewBest = result === 'win' && SG.storage.setBest(TD.GAME_ID, score);
    best = SG.storage.getBest(TD.GAME_ID);
    if (result === 'win') {
      TD.sounds.playWin();
      TD.particles.spawnConfetti(C.CANVAS_W, C.CONFETTI_COLORS);
      vibrate([20, 40, 20, 40, 60]);
    } else {
      TD.sounds.playLose();
      vibrate(80);
    }
    SG.poki.gameplayStop();
    SG.analytics.track('game_over', { result: result, score: score, best: best, newBest: isNewBest });
    emitChange({ result: result, score: score, newBest: isNewBest });
  }

  // ---------- Rendering ----------

  function draw() {
    ctx.clearRect(0, 0, C.CANVAS_W, C.CANVAS_H);
    ctx.fillStyle = '#10141f';
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    ctx.save();
    if (world && world.shakeFrames > 0) {
      var mag = (world.shakeFrames / C.SHAKE_FRAMES) * C.SHAKE_MAGNITUDE;
      ctx.translate((Math.random() * 2 - 1) * mag, (Math.random() * 2 - 1) * mag);
    }

    drawZones();
    if (world) {
      TD.wall.draw(ctx, world.wallEnemy);
      TD.wall.draw(ctx, world.wallPlayer);
      TD.projectiles.drawThrows(ctx, world.throws);
      TD.projectiles.drawBullets(ctx, world.bullets);
      drawUnits(world.enemyUnits);
      drawUnits(world.playerUnits);
      if (world.throwAimActive && world.throwAimTarget) drawCrosshair(world.throwAimTarget);
    }
    TD.particles.draw(ctx);
    ctx.restore();

    if (world) {
      drawHud();
      drawLowHpVignette();
    }
  }

  function drawZones() {
    var m = C.FIELD_MARGIN;
    ctx.strokeStyle = 'rgba(244, 241, 234, 0.18)';
    ctx.lineWidth = 2;
    ctx.strokeRect(m, m, C.CANVAS_W - m * 2, C.CANVAS_H - m * 2);

    ctx.fillStyle = 'rgba(255, 111, 174, 0.05)';
    ctx.fillRect(m, m, C.CANVAS_W - m * 2, C.ENEMY_WALL_Y - m);
    ctx.fillStyle = 'rgba(94, 230, 255, 0.05)';
    ctx.fillRect(m, C.PLAYER_WALL_Y, C.CANVAS_W - m * 2, C.CANVAS_H - C.PLAYER_WALL_Y - m);
  }

  function drawUnits(units) {
    for (var i = 0; i < units.length; i++) {
      var u = units[i];
      // Dezentes Idle-Wippen (rein kosmetisch, keine Wirkung auf u.x/u.y
      // selbst) – macht stehende Einheiten lebendiger statt starr.
      var bob = Math.sin(world.frameCount * 0.06 + u.wobblePhase) * 1.4;
      ctx.fillStyle = u.color;
      ctx.beginPath();
      ctx.arc(u.x, u.y + bob, C.UNIT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      if (u.role === 'human') {
        ctx.strokeStyle = '#10141f';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      // Kurzer weißer Treffer-Blitz (siehe HIT_FLASH_FRAMES), klingt linear ab.
      if (u.flashFrames > 0) {
        ctx.globalAlpha = u.flashFrames / C.HIT_FLASH_FRAMES;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(u.x, u.y + bob, C.UNIT_RADIUS * 0.72, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawCrosshair(target) {
    ctx.strokeStyle = C.PLAYER_COLOR;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 9, 0, Math.PI * 2);
    ctx.moveTo(target.x - 13, target.y);
    ctx.lineTo(target.x - 5, target.y);
    ctx.moveTo(target.x + 5, target.y);
    ctx.lineTo(target.x + 13, target.y);
    ctx.moveTo(target.x, target.y - 13);
    ctx.lineTo(target.x, target.y - 5);
    ctx.moveTo(target.x, target.y + 5);
    ctx.lineTo(target.x, target.y + 13);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawHud() {
    var m = C.FIELD_MARGIN;
    var barW = C.CANVAS_W - m * 2 - 16;
    drawHpBar(m + 8, m + 6, barW, world.teamHP.enemy / C.TEAM_HP_MAX, C.ENEMY_COLOR);
    drawHpBar(m + 8, C.CANVAS_H - m - 14, barW, world.teamHP.player / C.TEAM_HP_MAX, C.PLAYER_COLOR);
  }

  function drawHpBar(x, y, w, frac, color) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x, y, w, 8);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.max(0, w * frac), 8);
  }

  // Warnsignal bei kritischem eigenem Team-HP: pulsierender roter Rand
  // (siehe LOW_HP_VIGNETTE_FRAC) – zusätzlich zu HP-Balken und Screen-Shake,
  // damit "es wird knapp" auch peripher/ohne auf den Balken zu schauen
  // ankommt. Nicht während Pause/Gameover (dann irrelevant/verwirrend).
  function drawLowHpVignette() {
    if (state !== STATES.PLAYING) return;
    var frac = world.teamHP.player / C.TEAM_HP_MAX;
    if (frac >= C.LOW_HP_VIGNETTE_FRAC || frac <= 0) return;
    var urgency = 1 - frac / C.LOW_HP_VIGNETTE_FRAC; // 0 knapp unter Schwelle -> 1 bei 0 HP
    var pulse = 0.5 + 0.5 * Math.sin(world.frameCount * 0.15);
    var alpha = (0.12 + urgency * 0.22) * (0.6 + 0.4 * pulse);
    var cx = C.CANVAS_W / 2, cy = C.CANVAS_H / 2;
    var grad = ctx.createRadialGradient(cx, cy, C.CANVAS_H * 0.32, cx, cy, C.CANVAS_H * 0.62);
    grad.addColorStop(0, 'rgba(255, 60, 60, 0)');
    grad.addColorStop(1, 'rgba(255, 40, 40, ' + alpha.toFixed(3) + ')');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
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

    if (state !== STATES.PAUSED) {
      TD.particles.update();
      if (world && world.shakeFrames > 0) world.shakeFrames--;
    }

    draw();
  }

  // ---------- Öffentliche API ----------

  var game = {
    STATES: STATES,
    COMMANDS: C.COMMANDS,

    init: function (canvasEl) {
      canvas = canvasEl;
      ctx = canvas.getContext('2d');
      best = SG.storage.getBest(TD.GAME_ID);
      resetWorld();
      draw();
      rafId = global.requestAnimationFrame(tick);
    },

    onChange: function (cb) { changeListeners.push(cb); },
    getState: function () { return state; },

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
      SG.poki.commercialBreak(function () { game.start(); });
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

    // ---- Eingaben (siehe input.js: drei Sticks + Kommando-Buttons) ----

    setMoveVector: function (dx, dy, magnitude) {
      if (!world) return;
      world.moveVector.dx = dx; world.moveVector.dy = dy; world.moveVector.magnitude = magnitude;
    },

    setAimVector: function (active, angle) {
      if (!world) return;
      world.aimActive = active;
      if (active) world.aimAngle = angle;
    },

    setThrowAim: function (dx, dy, magnitude) {
      if (!world) return;
      var player = world.playerUnits[0];
      world.throwAimActive = magnitude > 0;
      world.throwAimTarget = {
        x: clamp(player.x + dx * magnitude * C.THROW_RANGE, 0, C.CANVAS_W),
        y: clamp(player.y + dy * magnitude * C.THROW_RANGE, 0, C.CANVAS_H),
      };
    },

    throwRelease: function () {
      if (!world) return;
      var wasActive = world.throwAimActive;
      world.throwAimActive = false;
      if (!wasActive || world.throwCooldown > 0 || !world.throwAimTarget) return;
      var player = world.playerUnits[0];
      TD.projectiles.spawnThrow(world.throws, player.x, player.y, world.throwAimTarget.x, world.throwAimTarget.y, 'player');
      TD.sounds.playThrow();
      world.throwCooldown = C.THROW_COOLDOWN_MS;
    },

    setCommand: function (cmd) {
      if (!world) return;
      var valid = cmd === C.COMMANDS.RETREAT || cmd === C.COMMANDS.ATTACK || cmd === C.COMMANDS.COVER;
      if (!valid) return;
      world.activeCommand = cmd;
      SG.analytics.track('command', { command: cmd });
    },

    getActiveCommand: function () { return world ? world.activeCommand : C.DEFAULT_COMMAND; },

    toggleSound: function () {
      var on = SG.audio.toggle();
      SG.analytics.track('sound_toggle', { enabled: on });
      return on;
    },

    getDebugState: function () {
      return {
        state: state,
        teamHP: world ? Object.assign({}, world.teamHP) : null,
        best: best,
      };
    },
  };

  TD.game = game;
})(window);
