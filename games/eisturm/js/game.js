/**
 * Eisturm – Spiellogik & Rendering.
 *
 * Icy-Tower-Mechanik:
 *  - Etagen sind schmale Plattformen, von unten immer durchspringbar
 *    (kein Anstoßen). Beim Fallen fängt einen nur auf, wer über der
 *    Plattform steht – sonst geht es weiter nach unten.
 *  - Die Sprunghöhe kommt aus Anlauftempo UND Haltedauer: losgelassen
 *    wird ein noch steigender Sprung gekappt (kurz tippen = kleiner
 *    Hüpfer, halten = voller Satz).
 *  - An den Seitenwänden prallt man mit fast vollem Schwung ab; die
 *    Steuerung ist dabei kurz gesperrt, damit der Abpraller auch wirkt.
 *  - Mehrere Etagen in einem Sprung starten eine Combo-Serie mit
 *    Zeitfenster und Multiplikator.
 *  - Der Bildausschnitt wandert nach kurzer Schonfrist von selbst nach
 *    oben und wird dabei immer schneller. Wer stehen bleibt oder zu tief
 *    zurückfällt, fällt unten raus – das ist die einzige Verlustbedingung.
 *
 * Eingaben von input.js: setSteer(-1..1), jumpStart(), jumpRelease().
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

  var chr, camera, floors, nextFloorY, floorSeq, best, comboPoints, combo, flashes;
  var accMs, lastTs, rafId;
  var steerFactor = 0; // -1..1, von input.js gesetzt (Neigung oder Tastatur)
  // Liegt der Finger (bzw. die Taste) gerade auf? Dann wird bei jeder
  // Landung sofort wieder abgesprungen, ohne neu antippen zu müssen.
  var jumpInputDown = false;

  function emitChange(extra) {
    var payload = Object.assign({ state: state, score: currentScore(), best: best || 0 }, extra || {});
    changeListeners.forEach(function (cb) {
      try { cb(payload); } catch (e) { /* Listener-Fehler nie das Spiel stören lassen */ }
    });
  }

  function currentScore() {
    if (!chr) return 0;
    return chr.maxFloor * C.POINTS_PER_FLOOR + comboPoints;
  }

  // Oberkante der Plattform – darauf steht die Figur (Fußpunkt), nicht
  // auf der Mittellinie der gezeichneten Leiste.
  function floorTopY(floor) {
    return floor.y - C.FLOOR_THICK / 2;
  }

  function restY(floor) {
    return floorTopY(floor) - C.CHAR_R;
  }

  // Steht x (mit Radius r) über der Plattform dieser Etage? Nur das
  // entscheidet, ob man beim Fallen aufgefangen wird.
  function onPlank(floor, x, r) {
    return x + r > floor.plankX && x - r < floor.plankX + floor.plankWidth;
  }

  function resetWorld() {
    var groundY = C.CANVAS_H - C.START_Y_FROM_BOTTOM;
    var groundFloor = { y: groundY, plankX: 0, plankWidth: C.CANVAS_W, seq: 0, isGround: true };

    chr = {
      x: C.CANVAS_W / 2,
      y: restY(groundFloor),
      vx: 0,
      vy: 0,
      grounded: true,
      floor: groundFloor,
      facing: 1,
      squash: 0,
      runPhase: 0,
      jumpHeld: false,
      jumpFromSeq: 0,
      wallLockMs: 0,
      wallBoostMs: 0, // läuft nach einem Wandabprall ab
      wallJump: false, // zählt der laufende Sprung als Wand-Sprung (= Combo möglich)?
      maxFloor: 0,
    };
    camera = { y: 0, scrolling: false, ageMs: 0 };
    floors = [groundFloor];
    floorSeq = 0;
    nextFloorY = groundY - (C.FLOOR_SPACING + Math.random() * C.FLOOR_SPACING_JITTER);
    comboPoints = 0;
    combo = { floors: 0, timerMs: 0 };
    flashes = [];
    steerFactor = 0;
    ET.particles.reset();
    ET.trail.reset();
    ensureFloorsAhead();
  }

  function ensureFloorsAhead() {
    var horizon = camera.y - C.CANVAS_H * 2.2;
    while (nextFloorY > horizon) {
      floorSeq++;
      var plankWidth = C.plankWidthAt(floorSeq);
      var margin = C.EDGE_MARGIN;
      var plankX = margin + Math.random() * Math.max(10, C.CANVAS_W - margin * 2 - plankWidth);
      floors.push({ y: nextFloorY, plankX: plankX, plankWidth: plankWidth, seq: floorSeq });
      nextFloorY -= C.FLOOR_SPACING + (Math.random() * C.FLOOR_SPACING_JITTER * 2 - C.FLOOR_SPACING_JITTER);
    }
  }

  function pruneOldFloors() {
    while (floors.length > 1 && floors[0].y - camera.y > C.CANVAS_H + C.PRUNE_MARGIN) {
      floors.shift();
    }
  }

  function killChar(reason) {
    if (state !== STATES.PLAYING) return;
    state = STATES.GAMEOVER;
    var finalScore = currentScore();
    var isNewBest = SG.storage.setBest(ET.GAME_ID, finalScore);
    best = SG.storage.getBest(ET.GAME_ID);
    SG.audio.playGameOver();
    SG.poki.gameplayStop();
    SG.analytics.track('game_over', { reason: reason, score: finalScore, floor: chr.maxFloor, best: best, newBest: isNewBest });
    emitChange({ reason: reason, newBest: isNewBest, floor: chr.maxFloor });
  }

  // ---------- Eingaben ----------

  function jumpStart() {
    jumpInputDown = true;
    if (state !== STATES.PLAYING) return;
    if (!chr.grounded) return;
    var speedFactor = Math.min(C.JUMP_SPEED_FACTOR_MAX, Math.abs(chr.vx) / C.MAX_RUN_SPEED);
    chr.jumpFromSeq = chr.floor.seq;
    // Nur ein Sprung aus dem Wandabprall heraus kann eine Combo geben.
    chr.wallJump = chr.wallBoostMs > 0;
    chr.grounded = false;
    chr.floor = null;
    chr.jumpHeld = true;
    chr.vy = C.JUMP_VY_BASE + C.JUMP_VY_BONUS * speedFactor;
    SG.audio.unlock();
    ET.sounds.playJump(speedFactor);
    SG.analytics.track('jump', { speedFactor: Math.round(speedFactor * 100) / 100 });
  }

  // Loslassen kappt einen noch steigenden Sprung – daraus entsteht die
  // Höhensteuerung über die Haltedauer. JUMP_VY_MIN sorgt dafür, dass
  // auch ein ganz kurzer Tipp noch ein brauchbarer Hüpfer bleibt.
  function jumpRelease() {
    jumpInputDown = false;
    if (!chr || !chr.jumpHeld) return;
    chr.jumpHeld = false;
    if (chr.vy < C.JUMP_VY_MIN) {
      chr.vy = Math.min(chr.vy * C.JUMP_CUT_FACTOR, C.JUMP_VY_MIN);
    }
  }

  // ---------- Physik ----------

  function onLand(floor) {
    var skipped = Math.max(0, floor.seq - chr.jumpFromSeq - 1);
    chr.grounded = true;
    chr.floor = floor;
    chr.jumpHeld = false;
    chr.vy = 0;
    chr.y = restY(floor);
    chr.squash = C.SQUASH_LAND;
    ET.particles.spawnLandDust(chr.x, floorTopY(floor));
    ET.sounds.playLand();

    if (floor.seq > chr.maxFloor) chr.maxFloor = floor.seq;

    // Combo gibt es ausschließlich für Sprünge aus einem Wandabprall.
    if (skipped >= C.COMBO_MIN_FLOORS && chr.wallJump) {
      combo.floors += skipped;
      combo.timerMs = C.COMBO_WINDOW_MS;
      var mult = 1 + Math.floor(combo.floors / C.COMBO_FLOORS_PER_MULT);
      comboPoints += skipped * C.COMBO_POINTS_PER_FLOOR * mult;
      var label = C.comboLabelFor(skipped);
      flashes.push({
        x: chr.x,
        y: floorTopY(floor),
        life: 1,
        text: label.text,
        sub: skipped + ' Etagen' + (mult > 1 ? '  ×' + mult : ''),
        color: label.color,
        size: label.size,
      });
      ET.sounds.playCombo(skipped);
      SG.analytics.track('combo', { floors: skipped, serie: combo.floors, mult: mult });
    }

    // Finger liegt noch auf -> direkt weiterspringen, ohne neu zu tippen.
    if (jumpInputDown) jumpStart();
  }

  // dir: -1 = linke Wand, +1 = rechte Wand. Der Abprall gibt mehr Tempo
  // zurück als ankam und schaltet für WALL_BOOST_MS den Combo-Zustand
  // scharf (sichtbar am Regenbogen-Schweif).
  function hitWall(dir) {
    if (Math.abs(chr.vx) < C.WALL_BOUNCE_MIN_SPEED) {
      chr.vx = 0;
      return;
    }
    var impact = Math.min(1, Math.abs(chr.vx) / C.MAX_RUN_SPEED);
    var speed = Math.min(C.WALL_BOUNCE_MAX, Math.abs(chr.vx) * C.WALL_BOUNCE);
    chr.vx = -dir * speed;
    chr.wallLockMs = C.WALL_LOCK_MS;
    chr.wallBoostMs = C.WALL_BOOST_MS;
    if (!chr.grounded) chr.wallJump = true; // auch mitten im Flug abgeprallt zählt
    chr.squash = C.SQUASH_WALL;
    ET.particles.spawnWallSpark(chr.x, chr.y, -dir, impact);
    ET.sounds.playWall(impact);
  }

  // Nur beim Fallen relevant: Etagen sind von unten immer durchspringbar.
  // Geprüft wird der Fußpunkt gegen die Plattform-Oberkante, damit die
  // Figur sauber obendrauf steht statt in der Leiste zu stecken.
  function handleFloorCrossing(prevY) {
    if (chr.vy <= 0) return;
    var prevFoot = prevY + C.CHAR_R;
    var newFoot = chr.y + C.CHAR_R;

    for (var i = 0; i < floors.length; i++) {
      var floor = floors[i];
      var top = floorTopY(floor);
      if (prevFoot <= top && newFoot >= top && onPlank(floor, chr.x, C.CHAR_R)) {
        onLand(floor);
        return;
      }
    }
  }

  function updateCamera() {
    // Nach der Schonfrist wandert der Ausschnitt von selbst nach oben und
    // wird mit der Höhe schneller – der eigentliche Zeitdruck im Spiel.
    camera.ageMs += STEP_MS;
    if (!camera.scrolling && (chr.maxFloor >= C.SCROLL_START_FLOOR || camera.ageMs >= C.SCROLL_START_MS)) {
      camera.scrolling = true;
    }
    if (camera.scrolling) camera.y -= C.scrollSpeedAt(chr.maxFloor);

    // Nur nach oben und dabei weich nachziehen, damit ein hoher Sprung
    // die Kamera nicht komplett mitreißt.
    var targetCamY = chr.y - C.CANVAS_H * C.CAMERA_FOLLOW_RATIO;
    if (targetCamY < camera.y) camera.y += (targetCamY - camera.y) * C.CAMERA_FOLLOW_LERP;

    // Sicherheitsnetz: nie aus dem oberen Bildrand herausklettern.
    if (chr.y - camera.y < C.CAMERA_MAX_TOP) camera.y = chr.y - C.CAMERA_MAX_TOP;
  }

  function updateSteering() {
    if (chr.wallBoostMs > 0) chr.wallBoostMs -= STEP_MS;

    if (chr.wallLockMs > 0) {
      chr.wallLockMs -= STEP_MS;
      return; // Abprall wirkt, Steuerung greift gleich wieder
    }

    var targetVx = steerFactor * C.MAX_RUN_SPEED;
    // Bewusst grobe Schwelle: ein Snap soll nur bei gewolltem Gegenlenken
    // auslösen, nicht schon bei minimalem Wackeln um die Nulllage.
    var wantDir = steerFactor > 0.25 ? 1 : (steerFactor < -0.25 ? -1 : 0);
    var moveDir = chr.vx > 0.2 ? 1 : (chr.vx < -0.2 ? -1 : 0);

    // Solange der Dash-Schwung über dem normalen Lauftempo liegt, hat er
    // Vorrang vor der Steuerung: sonst würde die weiter gehaltene Richtung
    // ihn per Snap sofort vernichten. Bewusstes Gegenlenken bremst ihn
    // trotzdem ab – nur eben allmählich statt schlagartig.
    if (Math.abs(chr.vx) > C.MAX_RUN_SPEED) {
      var gegen = wantDir !== 0 && moveDir !== 0 && wantDir !== moveDir;
      chr.vx -= (chr.vx > 0 ? 1 : -1) * (gegen ? C.BOOST_COUNTER_BRAKE : C.OVERSPEED_FRICTION);
      return;
    }

    // Gegenlenken kippt die Richtung sofort um, statt erst auszubremsen.
    if (wantDir !== 0 && moveDir !== 0 && wantDir !== moveDir) {
      chr.vx = wantDir * Math.min(Math.abs(targetVx), C.MAX_RUN_SPEED * C.TURN_SNAP_FACTOR);
      return;
    }

    var accel = (targetVx * chr.vx < 0) ? C.RUN_ACCEL_TURN : C.RUN_ACCEL;
    if (chr.vx < targetVx) chr.vx = Math.min(targetVx, chr.vx + accel);
    else if (chr.vx > targetVx) chr.vx = Math.max(targetVx, chr.vx - accel);
  }

  function updatePhysics() {
    updateCamera();
    ensureFloorsAhead();
    updateSteering();

    if (chr.vx > 0.05) chr.facing = 1;
    else if (chr.vx < -0.05) chr.facing = -1;
    chr.runPhase += Math.abs(chr.vx) * 0.24;

    chr.x += chr.vx;
    var minX = C.EDGE_MARGIN + C.CHAR_R;
    var maxX = C.CANVAS_W - C.EDGE_MARGIN - C.CHAR_R;
    if (chr.x < minX) { chr.x = minX; hitWall(-1); }
    else if (chr.x > maxX) { chr.x = maxX; hitWall(1); }

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

    if (combo.timerMs > 0) {
      combo.timerMs -= STEP_MS;
      if (combo.timerMs <= 0) {
        combo.timerMs = 0;
        combo.floors = 0;
      }
    }

    if (chr.squash !== 0) {
      if (chr.squash > 0) chr.squash = Math.max(0, chr.squash - C.SQUASH_DECAY);
      else chr.squash = Math.min(0, chr.squash + C.SQUASH_DECAY);
    }

    ET.particles.update();

    // Regenbogen-Schweif: ab genügend Tempo – und nach einem Wandabprall
    // in voller Pracht, denn genau dann zählen Sprünge als Combo. Der
    // Schweif ist also die Anzeige für "jetzt bringt ein Sprung was".
    var speedFactor = Math.min(1, Math.abs(chr.vx) / C.MAX_RUN_SPEED);
    var intensity = 0;
    if (speedFactor > C.TRAIL_MIN_SPEED_FACTOR) {
      intensity = (speedFactor - C.TRAIL_MIN_SPEED_FACTOR) / (1 - C.TRAIL_MIN_SPEED_FACTOR);
      intensity *= 0.55; // ohne Wand-Boost nur ein angedeuteter Schweif
    }
    if (chr.wallBoostMs > 0 || chr.wallJump) intensity = 1;
    ET.trail.push(chr.x, chr.y + C.CHAR_R * 0.5, Math.min(1, intensity));
    ET.trail.update();

    for (var f = flashes.length - 1; f >= 0; f--) {
      flashes[f].life -= 0.015;
      flashes[f].y -= 0.5;
      if (flashes[f].life <= 0) flashes.splice(f, 1);
    }

    // Verloren, sobald die Figur komplett unter dem sichtbaren Bild ist.
    if (chr.y - C.CHAR_R - camera.y > C.CANVAS_H) {
      killChar('fell');
      return;
    }

    pruneOldFloors();
  }

  // ---------- Rendering ----------

  function draw() {
    var grad = ctx.createLinearGradient(0, 0, 0, C.CANVAS_H);
    grad.addColorStop(0, '#1c2f45');
    grad.addColorStop(1, '#101a2b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    drawWalls();

    if (state === STATES.MENU) {
      drawChar();
      return;
    }

    drawFloors();
    ET.particles.draw(ctx, camera.y);
    ET.trail.draw(ctx, camera.y);
    drawChar();
    drawFlashes();
    drawCombo();
  }

  // Seitenwände sichtbar machen – an ihnen prallt man ab, das soll man sehen.
  function drawWalls() {
    var w = C.EDGE_MARGIN;
    ctx.fillStyle = 'rgba(94, 230, 255, 0.30)';
    ctx.fillRect(0, 0, w, C.CANVAS_H);
    ctx.fillRect(C.CANVAS_W - w, 0, w, C.CANVAS_H);
    ctx.fillStyle = 'rgba(94, 230, 255, 0.75)';
    ctx.fillRect(w - 1, 0, 1, C.CANVAS_H);
    ctx.fillRect(C.CANVAS_W - w, 0, 1, C.CANVAS_H);
  }

  function drawFloors() {
    ctx.textAlign = 'left';
    for (var i = 0; i < floors.length; i++) {
      var floor = floors[i];
      var screenY = floor.y - camera.y;
      if (screenY < -30 || screenY > C.CANVAS_H + 40) continue;

      if (floor.isGround) {
        ET.sprites.drawGround(ctx, screenY, C.CANVAS_W);
        continue;
      }

      var marked = floor.seq % C.FLOOR_MARK_EVERY === 0;
      ET.sprites.drawFloor(ctx, floor, screenY, marked);

      ctx.fillStyle = marked ? 'rgba(255, 209, 92, 0.9)' : 'rgba(191, 233, 255, 0.35)';
      ctx.font = (marked ? 'bold 11px' : '10px') + ' sans-serif';
      ctx.fillText(floor.seq, C.EDGE_MARGIN + 3, screenY - 5);
    }
  }

  function drawChar() {
    ET.sprites.drawChar(ctx, chr.x, chr.y - camera.y, {
      vx: chr.vx,
      vy: chr.vy,
      grounded: chr.grounded,
      facing: chr.facing,
      squash: chr.squash,
      runPhase: chr.runPhase,
      speedFactor: Math.min(1, Math.abs(chr.vx) / C.MAX_RUN_SPEED),
    });
  }

  function drawFlashes() {
    ctx.textAlign = 'center';
    for (var i = 0; i < flashes.length; i++) {
      var f = flashes[i];
      var screenY = f.y - camera.y;
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.6));
      ctx.fillStyle = f.color;
      ctx.font = 'bold ' + f.size + 'px sans-serif';
      ctx.fillText(f.text, C.CANVAS_W / 2, screenY - 24);
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(f.sub, C.CANVAS_W / 2, screenY - 8);
      ctx.globalAlpha = 1;
    }
  }

  // Laufende Combo-Serie mit Restzeit-Balken, direkt unter dem Score.
  function drawCombo() {
    if (combo.floors <= 0) return;
    var mult = 1 + Math.floor(combo.floors / C.COMBO_FLOORS_PER_MULT);
    var w = 130;
    var x = (C.CANVAS_W - w) / 2;
    var y = 40;

    ctx.fillStyle = '#ffd15c';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SERIE ' + combo.floors + '  ×' + mult, C.CANVAS_W / 2, y);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fillRect(x, y + 5, w, 4);
    ctx.fillStyle = '#ffd15c';
    ctx.fillRect(x, y + 5, w * Math.max(0, combo.timerMs / C.COMBO_WINDOW_MS), 4);
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
      jumpInputDown = false;
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

    jumpStart: jumpStart,
    jumpRelease: jumpRelease,

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
        floor: chr ? chr.maxFloor : 0,
        charX: chr ? chr.x : null,
        charVx: chr ? chr.vx : null,
        charY: chr ? chr.y : null,
        cameraY: camera ? camera.y : null,
        scrolling: camera ? camera.scrolling : false,
        floorCount: floors ? floors.length : 0,
        grounded: chr ? chr.grounded : null,
        comboFloors: combo ? combo.floors : 0,
      };
    },
  };

  ET.game = game;
})(window);
