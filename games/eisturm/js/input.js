/**
 * Steuerung: mehrere Eingabewege, die sich nicht in die Quere kommen.
 *
 *   1. Neigung links/rechts (Gamma-Achse)  -> Lauftempo/-richtung, je
 *      stärker geneigt desto schneller (bis TILT_STEER_MAX_DEG).
 *   2. Kurzes Antippen (ohne nennenswerte Bewegung, < TAP_MAX_MS)
 *      irgendwo auf dem Feld -> Sprung.
 *   3. Alternative zum Testen ohne/gegen die Neigung: linke oder rechte
 *      Bildschirmhälfte HALTEN lässt in die Richtung laufen (wie bei
 *      Kurve Solo) – das startet zwar auch sofort volle Fahrt in diese
 *      Richtung, wird aber erst beim Loslassen als "kein Sprung" gewertet
 *      (nur ein KURZES Antippen löst den Sprung aus, s.o.), stört sich
 *      also nicht mit Punkt 2.
 *   4. Handy Richtung Gesicht kippen (Beta-Achse) -> löst zusätzlich
 *      einen Sprung aus. Praktisch für Testrunde 3, wo Antippen für die
 *      Laufrichtung reserviert ist.
 *   5. Tastatur (Desktop-Test): Pfeiltasten/A-D halten = laufen,
 *      Leertaste/Pfeil-hoch = springen, ESC = Pause.
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

    // ---------- Touch/Maus: Zone-Halten + kurzes Antippen ----------

    // Ein kurzes Antippen (< TAP_MAX_MS, kaum Bewegung) löst NUR den
    // Sprung aus, ohne die Laufrichtung zu beeinflussen. Erst wenn der
    // Finger länger liegen bleibt oder deutlich bewegt wird, gilt es als
    // "Halten" und steuert die Laufrichtung (Zone-Alternative) – so
    // kommen sich beide Gesten nicht in die Quere.
    var pointerActive = false;
    var downTime = 0;
    var downX = 0, downY = 0;
    var holding = false;
    var holdTimer = null;

    function sideFactorForClientX(clientX) {
      var rect = stageEl.getBoundingClientRect();
      var mid = rect.left + rect.width / 2;
      return clientX < mid ? -1 : 1;
    }

    function beginHolding(clientX) {
      holding = true;
      clearTimeout(holdTimer);
      ET.game.setSteer(sideFactorForClientX(clientX));
    }

    stageEl.addEventListener('pointerdown', function (e) {
      pointerActive = true;
      downTime = Date.now();
      downX = e.clientX;
      downY = e.clientY;
      holding = false;
      var clientXAtDown = e.clientX;
      clearTimeout(holdTimer);
      holdTimer = setTimeout(function () {
        if (pointerActive) beginHolding(clientXAtDown);
      }, C.TAP_MAX_MS);
      e.preventDefault();
    });

    stageEl.addEventListener('pointermove', function (e) {
      if (!pointerActive) return;
      var dx = e.clientX - downX;
      var dy = e.clientY - downY;
      if (!holding && Math.sqrt(dx * dx + dy * dy) > C.TAP_MOVE_THRESHOLD_PX) {
        beginHolding(e.clientX);
      }
      if (holding) ET.game.setSteer(sideFactorForClientX(e.clientX));
    });

    function release(e, allowTap) {
      if (!pointerActive) return;
      pointerActive = false;
      clearTimeout(holdTimer);
      if (holding) {
        ET.game.setSteer(0);
      } else if (allowTap && Date.now() - downTime < C.TAP_MAX_MS) {
        ET.game.jump();
      }
      holding = false;
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

      var dGamma = angleDelta(e.gamma, baseGamma);
      var dBeta = angleDelta(e.beta, baseBeta);

      var steer = Math.max(-1, Math.min(1, dGamma / C.TILT_STEER_MAX_DEG));
      ET.game.setSteer(steer);

      var jumpSignal = C.TILT_JUMP_SIGN * dBeta;
      if (jumpArmed && jumpSignal > C.TILT_JUMP_TRIGGER_DEG) {
        jumpArmed = false;
        ET.game.jump();
      } else if (!jumpArmed && jumpSignal < C.TILT_JUMP_REARM_DEG) {
        jumpArmed = true;
      }

      if (debugEl) {
        debugEl.textContent = 'γΔ ' + dGamma.toFixed(0) + '°  βΔ ' + dBeta.toFixed(0) + '°'
          + (jumpArmed ? '' : '  (springt gleich)');
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
