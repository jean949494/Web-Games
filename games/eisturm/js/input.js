/**
 * Steuerung – genau EIN Modus ist aktiv (siehe settings.js), damit sich
 * Neigung und Halten/Tippen nicht gegenseitig stören:
 *
 *   TILT-Modus: Neigen links/rechts (Gamma-Achse) lenkt, stufenlos, je
 *   stärker geneigt desto schneller. Kurzes Antippen irgendwo auf dem
 *   Feld löst den Sprung aus.
 *
 *   HOLD-Modus: linke/rechte Bildschirmhälfte HALTEN lenkt (wie bei
 *   Kurve Solo). Handy Richtung Gesicht kippen (Beta-Achse) löst den
 *   Sprung aus.
 *
 * Tastatur (Desktop-Test) läuft unabhängig vom Modus immer mit:
 * Pfeiltasten/A-D halten = laufen, Leertaste/Pfeil-hoch = springen,
 * ESC = Pause.
 *
 * Die TILT_*-Schwellen in constants.js sind Platzhalter (kein Gyroskop
 * im Entwicklungscontainer verfügbar) – mit `?debug` in der URL zeigt
 * diese Datei die aktuellen Neigungs-Deltas live an, damit sich das auf
 * dem echten Handy schnell nachjustieren lässt.
 */
(function (global) {
  'use strict';

  var ET = global.ET = global.ET || {};
  var C = ET.constants;
  var MODES = ET.settings.MODES;

  var debugMode = /[?&]debug\b/.test(global.location.search);

  function attach(stageEl) {
    var debugEl = null;
    if (debugMode) {
      debugEl = global.document.createElement('div');
      debugEl.style.cssText = 'position:absolute;top:4px;left:4px;z-index:20;font:11px monospace;'
        + 'color:#0f0;background:rgba(0,0,0,0.5);padding:2px 5px;border-radius:4px;pointer-events:none;white-space:pre;';
      stageEl.appendChild(debugEl);
    }

    // ---------- Touch/Maus ----------
    //
    // HOLD-Modus: Bildschirmhälfte halten lenkt sofort (kein Sprung über
    // Antippen, der kommt hier über Neigung Richtung Gesicht).
    // TILT-Modus: nur ein kurzes, kaum bewegtes Antippen (< TAP_MAX_MS)
    // löst den Sprung aus, die Laufrichtung kommt ausschließlich über
    // Neigung. Pointer-Events steuern hier also je nach Modus entweder
    // NUR die Laufrichtung oder NUR den Sprung, nie beides gleichzeitig.

    var pointerActive = false;
    var downTime = 0;
    var downX = 0, downY = 0;

    function sideFactorForClientX(clientX) {
      var rect = stageEl.getBoundingClientRect();
      var mid = rect.left + rect.width / 2;
      return clientX < mid ? -1 : 1;
    }

    stageEl.addEventListener('pointerdown', function (e) {
      pointerActive = true;
      downTime = Date.now();
      downX = e.clientX;
      downY = e.clientY;
      if (ET.settings.getControlMode() === MODES.HOLD) {
        ET.game.setSteer(sideFactorForClientX(e.clientX));
      }
      e.preventDefault();
    });

    stageEl.addEventListener('pointermove', function (e) {
      if (!pointerActive) return;
      if (ET.settings.getControlMode() === MODES.HOLD) {
        ET.game.setSteer(sideFactorForClientX(e.clientX));
      }
    });

    function release(e, allowTap) {
      if (!pointerActive) return;
      pointerActive = false;
      var mode = ET.settings.getControlMode();
      if (mode === MODES.HOLD) {
        ET.game.setSteer(0);
      } else if (mode === MODES.TILT && allowTap) {
        var dx = e ? e.clientX - downX : 0;
        var dy = e ? e.clientY - downY : 0;
        var moved = Math.sqrt(dx * dx + dy * dy) > C.TAP_MOVE_THRESHOLD_PX;
        if (!moved && Date.now() - downTime < C.TAP_MAX_MS) ET.game.jump();
      }
      if (e) e.preventDefault();
    }

    stageEl.addEventListener('pointerup', function (e) { release(e, true); });
    stageEl.addEventListener('pointercancel', function (e) { release(e, false); });
    stageEl.addEventListener('pointerleave', function (e) { release(e, false); });
    stageEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // ---------- Tastatur (Desktop-Test) ----------

    var keyLeft = false, keyRight = false;
    function keyFactor() {
      if (keyLeft && !keyRight) return -1;
      if (keyRight && !keyLeft) return 1;
      return 0;
    }

    global.addEventListener('keydown', function (e) {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        keyLeft = true;
        ET.game.setSteer(keyFactor());
        e.preventDefault();
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        keyRight = true;
        ET.game.setSteer(keyFactor());
        e.preventDefault();
      } else if (e.code === 'Space' || e.code === 'ArrowUp') {
        if (!e.repeat) ET.game.jump();
        e.preventDefault();
      } else if (e.code === 'Escape') {
        ET.game.togglePause();
      }
    });

    global.addEventListener('keyup', function (e) {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        keyLeft = false;
        ET.game.setSteer(keyFactor());
        e.preventDefault();
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        keyRight = false;
        ET.game.setSteer(keyFactor());
        e.preventDefault();
      }
    });

    global.addEventListener('blur', function () {
      pointerActive = false;
      keyLeft = false;
      keyRight = false;
      ET.game.setSteer(0);
    });

    // ---------- Neigung (Gyroskop) ----------

    var tiltActive = false;
    var needsCalibration = true;
    var baseGamma = 0, baseBeta = 0;
    var jumpArmed = true;

    function angleDelta(a, b) {
      var d = a - b;
      while (d > 180) d -= 360;
      while (d < -180) d += 360;
      return d;
    }

    function onOrientation(e) {
      if (e.gamma == null || e.beta == null) return;
      if (needsCalibration) {
        baseGamma = e.gamma;
        baseBeta = e.beta;
        needsCalibration = false;
        return;
      }

      var mode = ET.settings.getControlMode();
      var dGamma = angleDelta(e.gamma, baseGamma);
      var dBeta = angleDelta(e.beta, baseBeta);

      if (mode === MODES.TILT) {
        var steer = Math.max(-1, Math.min(1, dGamma / C.TILT_STEER_MAX_DEG));
        ET.game.setSteer(steer);
      }

      if (mode === MODES.HOLD) {
        var jumpSignal = C.TILT_JUMP_SIGN * dBeta;
        if (jumpArmed && jumpSignal > C.TILT_JUMP_TRIGGER_DEG) {
          jumpArmed = false;
          ET.game.jump();
        } else if (!jumpArmed && jumpSignal < C.TILT_JUMP_REARM_DEG) {
          jumpArmed = true;
        }
      }

      if (debugEl) {
        debugEl.textContent = 'Modus: ' + mode + '  γΔ ' + dGamma.toFixed(0) + '°  βΔ ' + dBeta.toFixed(0) + '°'
          + (mode === MODES.HOLD && !jumpArmed ? '  (springt gleich)' : '');
      }
    }

    function startListening() {
      if (tiltActive) return;
      tiltActive = true;
      global.addEventListener('deviceorientation', onOrientation);
    }

    function needsIosPermission() {
      return typeof global.DeviceOrientationEvent !== 'undefined'
        && typeof global.DeviceOrientationEvent.requestPermission === 'function';
    }

    function requestTiltPermission() {
      if (!needsIosPermission()) {
        if (global.DeviceOrientationEvent) startListening();
        return Promise.resolve(tiltActive);
      }
      return global.DeviceOrientationEvent.requestPermission().then(function (result) {
        if (result === 'granted') startListening();
        return tiltActive;
      }).catch(function () {
        return false;
      });
    }

    // Ohne iOS-Berechtigungsdialog direkt lauschen (Android/ältere Browser).
    if (global.DeviceOrientationEvent && !needsIosPermission()) {
      startListening();
    }

    // Bei jedem Rundenstart neu kalibrieren: die aktuelle Handy-Haltung
    // wird zur neuen "Null"-Position (egal wie das Handy gerade gehalten wird).
    ET.game.onChange(function (payload) {
      if (payload.state === ET.game.STATES.PLAYING) {
        needsCalibration = true;
        jumpArmed = true;
      }
    });

    ET.input = ET.input || {};
    ET.input.needsIosTiltPermission = needsIosPermission;
    ET.input.requestTiltPermission = requestTiltPermission;
  }

  ET.input = { attach: attach };
})(window);
