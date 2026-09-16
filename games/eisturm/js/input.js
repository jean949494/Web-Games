/**
 * Steuerung:
 *
 *   - Handy links/rechts neigen (Gamma-Achse) -> laufen, stufenlos, je
 *     stärker geneigt desto schneller (bis TILT_STEER_MAX_DEG).
 *   - Antippen (egal wo auf dem Feld) -> springen. Je länger gedrückt
 *     gehalten wird, desto höher der Sprung: das Loslassen kappt einen
 *     noch steigenden Sprung (siehe game.js jumpRelease).
 *
 * Tastatur läuft als PC-Test-Fallback immer mit: Pfeiltasten/A-D halten
 * = laufen, Leertaste/Pfeil-hoch halten = springen (Höhe wie beim
 * Antippen über die Haltedauer), ESC = Pause.
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

  var debugMode = /[?&]debug\b/.test(global.location.search);

  function attach(stageEl) {
    var debugEl = null;
    if (debugMode) {
      debugEl = global.document.createElement('div');
      debugEl.style.cssText = 'position:absolute;top:4px;left:4px;z-index:20;font:11px monospace;'
        + 'color:#0f0;background:rgba(0,0,0,0.5);padding:2px 5px;border-radius:4px;pointer-events:none;white-space:pre;';
      stageEl.appendChild(debugEl);
    }

    // ---------- Touch/Maus: Antippen = springen ----------

    var pointerActive = false;

    stageEl.addEventListener('pointerdown', function (e) {
      pointerActive = true;
      ET.game.jumpStart();
      e.preventDefault();
    });

    function release(e) {
      if (!pointerActive) return;
      pointerActive = false;
      ET.game.jumpRelease(); // Loslassen kappt den Sprung -> Höhe über Haltedauer
      if (e) e.preventDefault();
    }

    stageEl.addEventListener('pointerup', release);
    stageEl.addEventListener('pointercancel', release);
    stageEl.addEventListener('pointerleave', release);
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
        if (!e.repeat) ET.game.jumpStart();
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
      } else if (e.code === 'Space' || e.code === 'ArrowUp') {
        ET.game.jumpRelease();
        e.preventDefault();
      }
    });

    global.addEventListener('blur', function () {
      pointerActive = false;
      keyLeft = false;
      keyRight = false;
      ET.game.setSteer(0);
      ET.game.jumpRelease();
    });

    // ---------- Neigung (Gyroskop) ----------

    var tiltActive = false;
    var needsCalibration = true;
    var baseGamma = 0;
    var smoothGamma = 0;

    function angleDelta(a, b) {
      var d = a - b;
      while (d > 180) d -= 360;
      while (d < -180) d += 360;
      return d;
    }

    function onOrientation(e) {
      if (e.gamma == null) return;
      if (needsCalibration) {
        baseGamma = e.gamma;
        smoothGamma = 0;
        needsCalibration = false;
        return;
      }

      var dGamma = angleDelta(e.gamma, baseGamma);
      smoothGamma += (dGamma - smoothGamma) * C.TILT_SMOOTH;

      // Ruhige Haltung zentriert die Nulllage langsam nach – sonst
      // verzieht sie sich, sobald man sich anders hinsetzt.
      if (Math.abs(smoothGamma) < C.TILT_DEAD_DEG) {
        baseGamma += smoothGamma * C.TILT_RECENTER;
      }

      // Totzone abziehen, danach stufenlos bis zum vollen Ausschlag – so
      // bleibt die Mitte ruhig, ohne dass die feine Dosierung verloren geht.
      var d = smoothGamma;
      if (Math.abs(d) <= C.TILT_DEAD_DEG) d = 0;
      else d = d - (d > 0 ? 1 : -1) * C.TILT_DEAD_DEG;

      var span = C.TILT_STEER_MAX_DEG - C.TILT_DEAD_DEG;
      var ratio = Math.max(-1, Math.min(1, d / span));
      // Kennlinie anwenden: schon wenig Neigung bringt spürbar Tempo
      var steer = (ratio < 0 ? -1 : 1) * Math.pow(Math.abs(ratio), C.TILT_EXPO);
      ET.game.setSteer(steer);

      if (debugEl) {
        debugEl.textContent = 'γΔ ' + smoothGamma.toFixed(1) + '°  Lenkung ' + steer.toFixed(2);
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
      }
    });

    ET.input.needsIosTiltPermission = needsIosPermission;
    ET.input.requestTiltPermission = requestTiltPermission;
  }

  ET.input = { attach: attach };
})(window);
