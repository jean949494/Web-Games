/**
 * Blackout – Spielablauf und Darstellung.
 *
 * Schleife wie im Original: Schalter drücken, damit die Tür aufgeht, dann
 * durch die Tür raus. Endlos wird daraus, indem hinter jeder Tür der nächste
 * Raum wartet und die Uhr weiterläuft. Gold gibt Zeit zurück - deshalb lohnt
 * es sich, Risiken einzugehen, statt nur den kürzesten Weg zu nehmen.
 */
(function (global) {
  'use strict';

  var BO = global.BO = global.BO || {};
  var C = BO.constants;
  var SG = global.SG;

  var STATES = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', GAMEOVER: 'gameover' };

  // Zeit-Ökonomie: knapp genug, dass man sich bewegen muss, großzügig genug
  // für das Poki-Publikum.
  // Die Uhr ist im Original die LEBENSSPANNE des Ninjas, keine Rundenuhr:
  // ein einziger durchlaufender Countdown. Gold ist wörtlich
  // Lebensverlängerung - und wird erst beim Durchschreiten der Tür
  // gutgeschrieben. Wer vorher stirbt, verliert es.
  var TIME_START = 45 * 60; // Frames
  var TIME_PER_ROOM = 10 * 60;
  var TIME_PER_GOLD = 2 * 60; // exakt wie im Original
  var TIME_DEATH_PENALTY = 3 * 60;
  var TIME_MAX = 99 * 60;
  var RESPAWN_FRAMES = 36;

  var canvas, ctx;
  var state = STATES.MENU;
  var changeListeners = [];

  var room, ninja, roomIndex, timeLeft, score, best, seed;
  var switchOn, particles, flash, shake, doorPulse, thinkCursor;
  var pendingGold, deaths, respawnTimer, ragdoll;
  var accMs, lastTs, rafId, simFrame;
  var settings = { impactOriginal: false, scheme: 'halves' };

  function emitChange(extra) {
    var payload = Object.assign({ state: state, score: score || 0, best: best || 0 }, extra || {});
    changeListeners.forEach(function (cb) {
      try { cb(payload); } catch (e) { /* Listener-Fehler nie das Spiel stören lassen */ }
    });
  }

  // ---------------------------------------------------------------- Setup ---

  function loadRoom(index) {
    room = BO.level.generate(index, seed);
    ninja = new BO.Ninja(room.world, room.spawn.x, room.spawn.y - 4, {
      impactLimit: settings.impactOriginal ? C.IMPACT_LIMIT_ORIGINAL : C.IMPACT_LIMIT_MILD,
    });
    ninja.onDeath = function (reason) {
      ragdoll = new BO.Ragdoll(room.world, ninja.xpos, ninja.ypos, ninja.xspeed, ninja.yspeed);
      spawnDeathBurst(reason);
      shake = 14;
      deaths++;
      // Ungebanktes Gold ist weg - das ist der Preis, nicht der Lauf.
      pendingGold = 0;
      timeLeft = Math.max(0, timeLeft - TIME_DEATH_PENALTY);
      respawnTimer = RESPAWN_FRAMES;
      if (BO.sounds) BO.sounds.playDeath();
      SG.analytics.track('death', { reason: reason, room: roomIndex, deaths: deaths });
    };
    ninja.onJump = function (kind) {
      if (BO.sounds) BO.sounds.playJump(kind);
    };
    switchOn = false;
    doorPulse = 0;
    thinkCursor = 0;
    ragdoll = null;
    // Geschütze getrennt führen, damit sie reihum denken können
    room.turrets = room.hazards.filter(function (h) { return h.kind === 'turret'; });
  }

  function startRun() {
    seed = Math.floor(Math.random() * 1e9);
    roomIndex = 0;
    score = 0;
    timeLeft = TIME_START;
    particles = [];
    flash = 0;
    shake = 0;
    simFrame = 0;
    pendingGold = 0;
    deaths = 0;
    respawnTimer = 0;
    loadRoom(0);
    state = STATES.PLAYING;
    accMs = 0;
    lastTs = null;
    SG.audio.unlock();
    SG.poki.gameplayStart();
    SG.analytics.track('game_start', {});
    emitChange();
  }

  function endRun() {
    if (state !== STATES.PLAYING) return;
    state = STATES.GAMEOVER;
    var isNewBest = SG.storage.setBest(BO.GAME_ID, score);
    best = SG.storage.getBest(BO.GAME_ID);
    SG.audio.playGameOver();
    SG.poki.gameplayStop();
    SG.analytics.track('game_over', { score: score, rooms: roomIndex, best: best, newBest: isNewBest, deaths: deaths });
    emitChange({ newBest: isNewBest, deaths: deaths });
  }

  function nextRoom() {
    roomIndex++;
    score = roomIndex;
    // Jetzt erst wird das gesammelte Gold gutgeschrieben.
    timeLeft = Math.min(TIME_MAX, timeLeft + TIME_PER_ROOM + pendingGold * TIME_PER_GOLD);
    pendingGold = 0;
    flash = 12;
    if (BO.sounds) BO.sounds.playDoor();
    SG.analytics.track('room_cleared', { room: roomIndex });
    loadRoom(roomIndex);
  }

  // ---------------------------------------------------------------- Logik ---

  function updateFrame() {
    simFrame++;
    if (shake > 0) shake--;
    if (flash > 0) flash--;
    doorPulse += 0.08;

    // Die Uhr ist der einzige echte Gegner: Sie läuft immer weiter, auch
    // während man nach einem Tod neu eingesetzt wird. Ein Tod beendet den
    // Lauf NICHT - er kostet Zeit, das gesammelte Gold und den Fortschritt
    // im Raum. So bleibt das "nochmal sofort" aus dem Original erhalten.
    timeLeft--;
    if (timeLeft <= 0) {
      timeLeft = 0;
      endRun();
      return;
    }

    if (ninja.dead) {
      updateParticles();
      if (ragdoll) ragdoll.update();
      if (respawnTimer > 0 && --respawnTimer <= 0) loadRoom(roomIndex);
      return;
    }

    ninja.tick();
    if (ninja.dead) { updateParticles(); return; }

    // Fernkampfgegner denken reihum, nicht alle gleichzeitig: alle 0,1 s
    // ist genau EIN Geschütz dran. Mit mehreren Geschützen prüft jedes
    // seine Sichtlinie dadurch nur alle paar Zehntelsekunden - das ist der
    // Grund, warum man durch eine Schusslinie huschen kann.
    if (room.turrets.length && simFrame % BO.TURRET_CFG.THINK_INTERVAL === 0) {
      thinkCursor = (thinkCursor + 1) % room.turrets.length;
      room.turrets[thinkCursor].think(ninja, simFrame);
    }

    // Gefahren bewegen und prüfen
    for (var i = 0; i < room.hazards.length; i++) {
      var h = room.hazards[i];
      if (h.kind === 'turret') h.update(ninja, simFrame);
      else h.update();
      if (h.hits(ninja)) {
        ninja.kill(h.kind);
        return;
      }
    }

    // Gold einsammeln
    for (var g = 0; g < room.golds.length; g++) {
      var gold = room.golds[g];
      if (gold.taken) continue;
      var dx = ninja.xpos - gold.x, dy = ninja.ypos - gold.y;
      if (dx * dx + dy * dy < 240) {
        gold.taken = true;
        pendingGold++; // erst an der Tür wird daraus Zeit
        spawnSparkle(gold.x, gold.y);
        if (BO.sounds) BO.sounds.playGold();
      }
    }

    // Schalter
    if (!switchOn) {
      var sdx = ninja.xpos - room.switchPos.x, sdy = ninja.ypos - room.switchPos.y;
      if (sdx * sdx + sdy * sdy < 300) {
        switchOn = true;
        flash = 8;
        spawnSparkle(room.switchPos.x, room.switchPos.y);
        if (BO.sounds) BO.sounds.playSwitch();
      }
    } else {
      // Tür ist offen: erreichen beendet den Raum
      var ddx = ninja.xpos - room.door.x, ddy = ninja.ypos - room.door.y;
      if (ddx * ddx + ddy * ddy < 340) nextRoom();
    }

    updateParticles();
  }

  function spawnSparkle(x, y) {
    for (var i = 0; i < 10; i++) {
      var a = Math.random() * Math.PI * 2;
      var s = 0.6 + Math.random() * 1.8;
      particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.5, life: 1, decay: 0.05, col: '#ffd45c', size: 1.6 });
    }
  }

  function spawnDeathBurst() {
    for (var i = 0; i < 14; i++) {
      var a = Math.random() * Math.PI * 2;
      var s = 1 + Math.random() * 3.4;
      particles.push({
        x: ninja.xpos, y: ninja.ypos,
        vx: Math.cos(a) * s + ninja.xspeed * 0.4,
        vy: Math.sin(a) * s + ninja.yspeed * 0.4,
        life: 1, decay: 0.022, col: '#ff5566', size: 1.4 + Math.random() * 1.6,
      });
    }
  }

  function updateParticles() {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.vx *= 0.99;
      p.life -= p.decay;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  // ------------------------------------------------------------ Darstellung ---

  function draw() {
    ctx.save();
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    var ox = C.ROOM_OFF_X, oy = C.ROOM_OFF_Y;
    if (shake > 0) {
      ox += (Math.random() - 0.5) * shake * 0.7;
      oy += (Math.random() - 0.5) * shake * 0.7;
    }
    ctx.translate(ox, oy);

    if (room) {
      drawTiles();
      drawGold();
      drawSwitchAndDoor();
      drawHazards();
      drawParticles();
      if (ragdoll) ragdoll.draw(ctx);
      if (ninja && !ninja.dead) drawNinja();
    }

    ctx.restore();

    if (flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (flash / 40) + ')';
      ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
    }
    if (state === STATES.PLAYING || state === STATES.PAUSED) drawHud();
  }

  function drawTiles() {
    var g = room.grid;
    for (var y = 0; y < C.ROOM_H; y++) {
      for (var x = 0; x < C.ROOM_W; x++) {
        var t = g[y][x];
        if (t === C.T_EMPTY) continue;
        var px = x * C.TILE, py = y * C.TILE;
        ctx.fillStyle = '#39445c';
        if (t === C.T_SOLID) {
          ctx.fillRect(px, py, C.TILE, C.TILE);
          ctx.fillStyle = '#4a5673';
          ctx.fillRect(px, py, C.TILE, 3);
        } else {
          ctx.beginPath();
          if (t === C.T_SLOPE_BL) { ctx.moveTo(px, py); ctx.lineTo(px + C.TILE, py + C.TILE); ctx.lineTo(px, py + C.TILE); }
          else if (t === C.T_SLOPE_BR) { ctx.moveTo(px + C.TILE, py); ctx.lineTo(px + C.TILE, py + C.TILE); ctx.lineTo(px, py + C.TILE); }
          else if (t === C.T_SLOPE_TL) { ctx.moveTo(px, py); ctx.lineTo(px + C.TILE, py); ctx.lineTo(px, py + C.TILE); }
          else { ctx.moveTo(px, py); ctx.lineTo(px + C.TILE, py); ctx.lineTo(px + C.TILE, py + C.TILE); }
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }

  function drawGold() {
    for (var i = 0; i < room.golds.length; i++) {
      var gold = room.golds[i];
      if (gold.taken) continue;
      var bob = Math.sin(simFrame * 0.08 + i) * 1.5;
      ctx.fillStyle = '#ffd45c';
      ctx.beginPath();
      ctx.arc(gold.x, gold.y + bob, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,212,92,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(gold.x, gold.y + bob, 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawSwitchAndDoor() {
    var s = room.switchPos;
    if (!switchOn) {
      var pulse = 0.5 + 0.5 * Math.sin(simFrame * 0.12);
      ctx.fillStyle = 'rgba(94,225,163,' + (0.25 + pulse * 0.35) + ')';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 11 + pulse * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5ee1a3';
      ctx.fillRect(s.x - 5, s.y - 5, 10, 10);
    } else {
      ctx.fillStyle = '#2c4a3d';
      ctx.fillRect(s.x - 5, s.y - 5, 10, 10);
    }

    var d = room.door;
    if (switchOn) {
      var p2 = 0.5 + 0.5 * Math.sin(doorPulse * 2);
      ctx.fillStyle = 'rgba(94,225,163,' + (0.2 + p2 * 0.3) + ')';
      ctx.fillRect(d.x - 9, d.y - 16, 18, 32);
      ctx.strokeStyle = '#5ee1a3';
      ctx.lineWidth = 2;
      ctx.strokeRect(d.x - 9, d.y - 16, 18, 32);
    } else {
      ctx.strokeStyle = '#48506a';
      ctx.lineWidth = 2;
      ctx.strokeRect(d.x - 9, d.y - 16, 18, 32);
      ctx.fillStyle = 'rgba(72,80,106,0.35)';
      ctx.fillRect(d.x - 9, d.y - 16, 18, 32);
    }
  }

  function drawHazards() {
    for (var i = 0; i < room.hazards.length; i++) {
      var h = room.hazards[i];
      if (h.kind === 'mine') {
        ctx.fillStyle = '#ff5566';
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,85,102,' + (0.3 + 0.2 * Math.sin(h.pulse)) + ')';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.r + 3 + Math.sin(h.pulse) * 1.5, 0, Math.PI * 2);
        ctx.stroke();
      } else if (h.kind === 'drone') {
        ctx.fillStyle = '#c77dff';
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1a1030';
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.r * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else if (h.kind === 'turret') {
        drawTurret(h);
      }
    }
  }

  function drawTurret(t) {
    var aiming = t.phase === 'targeting' || t.phase === 'prefire';
    var col = '#7f8aa8';
    if (t.phase === 'prefire') col = '#ff4a4a';
    else if (t.phase === 'targeting') col = '#ffb15c';

    var angle = Math.atan2(t.aimY - t.y, t.aimX - t.x);

    if (t.phase === 'firing') {
      ctx.strokeStyle = 'rgba(255,74,74,0.35)';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(t.x, t.y);
      ctx.lineTo(t.x + Math.cos(t.fireAngle) * t.beamLen, t.y + Math.sin(t.fireAngle) * t.beamLen);
      ctx.stroke();
      ctx.strokeStyle = '#ffe0e0';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(t.x, t.y);
      ctx.lineTo(t.x + Math.cos(t.fireAngle) * t.beamLen, t.y + Math.sin(t.fireAngle) * t.beamLen);
      ctx.stroke();
    } else if (aiming) {
      // Dünne Peillinie zum Fadenkreuz
      ctx.strokeStyle = t.phase === 'prefire' ? 'rgba(255,74,74,0.55)' : 'rgba(255,177,92,0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(t.x, t.y);
      ctx.lineTo(t.aimX, t.aimY);
      ctx.stroke();

      // DAS FADENKREUZ. Es ist die eigentliche Information des Spiels:
      // Solange es hinterherhinkt, passiert nichts. Rastet es ein, wird
      // geschossen. Deshalb wird es so deutlich gezeichnet.
      var danger = t.phase === 'prefire';
      ctx.strokeStyle = danger ? '#ff4a4a' : '#ffb15c';
      ctx.lineWidth = danger ? 2 : 1.4;
      var s = danger ? 8 : 6;
      ctx.beginPath();
      ctx.arc(t.aimX, t.aimY, s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(t.aimX - s - 3, t.aimY);
      ctx.lineTo(t.aimX - s + 2, t.aimY);
      ctx.moveTo(t.aimX + s - 2, t.aimY);
      ctx.lineTo(t.aimX + s + 3, t.aimY);
      ctx.moveTo(t.aimX, t.aimY - s - 3);
      ctx.lineTo(t.aimX, t.aimY - s + 2);
      ctx.moveTo(t.aimX, t.aimY + s - 2);
      ctx.lineTo(t.aimX, t.aimY + s + 3);
      ctx.stroke();
    }

    ctx.fillStyle = '#2a3145';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r + 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(t.x, t.y);
    ctx.lineTo(t.x + Math.cos(angle) * (t.r + 4), t.y + Math.sin(angle) * (t.r + 4));
    ctx.stroke();
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.col;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawNinja() {
    var x = ninja.xpos, y = ninja.ypos;
    // Leichte Stauchung/Streckung nach der Vertikalgeschwindigkeit -
    // kostet nichts und macht die Bewegung lesbar.
    var stretch = Math.max(-0.28, Math.min(0.28, ninja.yspeed * 0.035));
    var rx = C.RADIUS * (1 - stretch);
    var ry = C.RADIUS * (1 + stretch);

    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#eef3ff';
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Blickrichtung als kleiner dunkler Strich, damit man die Ausrichtung sieht
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(ninja.facing > 0 ? 1 : -5, -4, 4, 3);

    // An der Wand: Markierung auf der Kontaktseite
    if (ninja.state === C.ST_WALL_SLIDING) {
      ctx.fillStyle = '#5ee1a3';
      ctx.fillRect(ninja.wallNormal < 0 ? rx - 3 : -rx, -5, 3, 10);
    }
    ctx.restore();
  }

  function drawHud() {
    var secs = Math.ceil(timeLeft / 60);
    ctx.fillStyle = secs <= 10 ? '#ff6b6b' : '#eef3ff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(secs + 's', 14, 28);
    // Ungebanktes Gold getrennt anzeigen - es zählt erst, wenn man die Tür
    // erreicht. Genau das macht den Rückweg spannend.
    if (pendingGold > 0) {
      ctx.fillStyle = '#ffd45c';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText('+' + (pendingGold * 2) + 's', 16 + ctx.measureText(secs + 's').width + 26, 27);
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = '#eef3ff';
    ctx.fillText('Raum ' + (roomIndex + 1), C.CANVAS_W - 14, 28);
    if (!switchOn) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(94,225,163,0.75)';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText('Schalter', C.CANVAS_W / 2, 24);
    }
  }

  // ----------------------------------------------------------------- Loop ---

  function tick(ts) {
    rafId = global.requestAnimationFrame(tick);
    if (lastTs == null) lastTs = ts;
    var frameMs = ts - lastTs;
    lastTs = ts;
    if (frameMs > 250) frameMs = 250;

    if (state === STATES.PLAYING) {
      accMs += frameMs;
      var steps = 0;
      while (accMs >= C.STEP_MS && steps < C.MAX_STEPS_PER_FRAME) {
        var inp = BO.input.read();
        ninja.setInput(inp.hor, inp.jump);
        updateFrame();
        accMs -= C.STEP_MS;
        steps++;
        if (state !== STATES.PLAYING) { accMs = 0; break; }
      }
    }

    draw();
  }

  // ------------------------------------------------------------------ API ---

  var game = {
    STATES: STATES,
    settings: settings,

    init: function (canvasEl) {
      canvas = canvasEl;
      ctx = canvas.getContext('2d');
      best = SG.storage.getBest(BO.GAME_ID);
      seed = Math.floor(Math.random() * 1e9);
      roomIndex = 0;
      score = 0;
      timeLeft = TIME_START;
      particles = [];
      flash = 0;
      shake = 0;
      simFrame = 0;
      loadRoom(0);
      draw();
      rafId = global.requestAnimationFrame(tick);
    },

    onChange: function (cb) { changeListeners.push(cb); },
    getState: function () { return state; },
    start: startRun,
    restart: startRun,

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

    toggleSound: function () {
      var on = SG.audio.toggle();
      SG.analytics.track('sound_toggle', { enabled: on });
      return on;
    },

    setImpactOriginal: function (v) {
      settings.impactOriginal = !!v;
      if (ninja) ninja.impactLimit = v ? C.IMPACT_LIMIT_ORIGINAL : C.IMPACT_LIMIT_MILD;
      SG.analytics.track('setting_impact', { original: settings.impactOriginal });
    },

    setScheme: function (s) {
      settings.scheme = s;
      if (BO.input) BO.input.setScheme(s);
      SG.analytics.track('setting_scheme', { scheme: s });
    },

    /**
     * Testhilfe: setzt die Figur direkt an eine Stelle. Nur verfügbar, wenn
     * "?debug" in der URL steht - im normalen Spiel existiert sie nicht.
     */
    debugWarp: function (what) {
      if (!/[?&]debug\b/.test(global.location ? global.location.search : '')) return false;
      if (!ninja || !room) return false;
      var t = what === 'door' ? room.door : room.switchPos;
      ninja.xpos = t.x;
      ninja.ypos = t.y;
      ninja.xspeed = 0;
      ninja.yspeed = 0;
      return true;
    },

    /** Testhilfe: gezielter Tod (nur mit "?debug"). */
    debugKill: function () {
      if (!/[?&]debug\b/.test(global.location ? global.location.search : '')) return false;
      if (!ninja || ninja.dead) return false;
      ninja.kill('debug');
      return true;
    },

    getDebugState: function () {
      return {
        state: state,
        score: score,
        best: best,
        room: roomIndex,
        timeLeft: timeLeft,
        switchOn: switchOn,
        pendingGold: pendingGold,
        deaths: deaths,
        ragdoll: ragdoll ? { life: +ragdoll.life.toFixed(2), head: [Math.round(ragdoll.points[0].x), Math.round(ragdoll.points[0].y)] } : null,
        ninja: ninja ? {
          x: Math.round(ninja.xpos), y: Math.round(ninja.ypos),
          vx: +ninja.xspeed.toFixed(3), vy: +ninja.yspeed.toFixed(3),
          state: ninja.state, dead: ninja.dead, reason: ninja.deathReason,
          airborn: ninja.airborn, walled: ninja.walled,
        } : null,
        hazards: room ? room.hazards.length : 0,
        turrets: room && room.turrets ? room.turrets.map(function (t) {
          return { phase: t.phase, timer: Math.round(t.shotTimer), aimDist: t.aimDist == null ? null : Math.round(t.aimDist) };
        }) : [],
      };
    },
  };

  BO.game = game;
})(typeof window !== 'undefined' ? window : globalThis);
