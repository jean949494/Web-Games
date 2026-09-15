/**
 * Steuerung: drei runde Sticks + drei Kommando-Buttons (Spec, siehe
 * "Steuerung"). Bewusst NUR Pointer Events, keine parallele
 * Touch-Events-Redundanz (wie bei den anderen Spielen im Repo, siehe
 * kurve-solo/js/input.js): doppelt gebundene Pointer- UND Touch-Handler
 * feuern auf den meisten Mobil-Browsern für dieselbe Geste zweimal und
 * verursachen dadurch selbst Bugs, statt welche zu vermeiden. Die
 * Touch-Zuverlässigkeitsprobleme aus der Prototyp-Phase gingen laut Spec
 * auf die iframe-Chat-Testumgebung zurück, nicht auf Pointer Events
 * selbst.
 *
 * WICHTIG (siehe Spec, "Bekannte offene Punkte"): Stick-Radius/Totzone/
 * Empfindlichkeit sowie ob sich drei gleichzeitige Sticks mit zwei
 * Daumen gut bedienen lassen, waren im Chat-Prototyp NICHT auf einem
 * echten Gerät testbar. Unbedingt früh auf einem echten Handy testen
 * (`npm run deploy`, siehe DEV.md) – nicht nur hier am Rechner mit der
 * Maus, auch wenn die Maus über Pointer Events technisch funktioniert.
 *
 * Jeder Stick bindet seine Pointer-Listener auf sein eigenes Basis-
 * Element und nutzt `setPointerCapture`, damit move/up-Events dem
 * jeweiligen Finger folgen, egal wo er sich bewegt. Dadurch funktionieren
 * alle drei Sticks unabhängig voneinander mit mehreren Fingern
 * gleichzeitig (Multi-Touch), ohne dass ein Stick den Input eines
 * anderen "stiehlt".
 */
(function (global) {
  'use strict';

  var TD = global.TD = global.TD || {};
  var C = TD.constants;

  function createStick(baseEl, knobEl, deadzone, onChange) {
    var pointerId = null;

    function vectorFromClient(clientX, clientY) {
      var rect = baseEl.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var dx = clientX - cx, dy = clientY - cy;
      var dist = Math.hypot(dx, dy);
      var maxDist = rect.width / 2;
      var clamped = Math.min(dist, maxDist);
      var ux = dist > 0 ? dx / dist : 0;
      var uy = dist > 0 ? dy / dist : 0;
      knobEl.style.transform = 'translate(' + (ux * clamped).toFixed(1) + 'px,' + (uy * clamped).toFixed(1) + 'px)';
      var norm = maxDist > 0 ? clamped / maxDist : 0;
      var magnitude = norm < deadzone ? 0 : (norm - deadzone) / (1 - deadzone);
      return { dx: ux, dy: uy, magnitude: magnitude, angle: Math.atan2(dy, dx) };
    }

    function resetKnob() { knobEl.style.transform = 'translate(0,0)'; }

    baseEl.addEventListener('pointerdown', function (e) {
      if (pointerId !== null) return; // Stick wird schon von einem anderen Finger gehalten
      pointerId = e.pointerId;
      try { baseEl.setPointerCapture(pointerId); } catch (err) { /* ältere Browser: kein Capture nötig, move/up feuern trotzdem */ }
      baseEl.classList.add('stick-active'); // rein optisches Feedback, siehe style.css
      onChange(vectorFromClient(e.clientX, e.clientY));
      e.preventDefault();
    });

    baseEl.addEventListener('pointermove', function (e) {
      if (pointerId === null || e.pointerId !== pointerId) return;
      onChange(vectorFromClient(e.clientX, e.clientY));
      e.preventDefault();
    });

    function release(e) {
      if (pointerId === null || (e && e.pointerId !== pointerId)) return;
      pointerId = null;
      baseEl.classList.remove('stick-active');
      resetKnob();
      onChange(null);
    }

    baseEl.addEventListener('pointerup', release);
    baseEl.addEventListener('pointercancel', release);
    baseEl.addEventListener('lostpointercapture', release);
    baseEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    return { forceRelease: function () { release(); } };
  }

  function attach() {
    var moveBase = document.getElementById('stick-move');
    var moveKnob = document.getElementById('stick-move-knob');
    var shootBase = document.getElementById('stick-shoot');
    var shootKnob = document.getElementById('stick-shoot-knob');
    var throwBase = document.getElementById('stick-throw');
    var throwKnob = document.getElementById('stick-throw-knob');

    var moveStick = createStick(moveBase, moveKnob, C.STICK_DEADZONE, function (vec) {
      if (vec) TD.game.setMoveVector(vec.dx, vec.dy, vec.magnitude);
      else TD.game.setMoveVector(0, 0, 0);
    });

    var shootStick = createStick(shootBase, shootKnob, C.STICK_DEADZONE, function (vec) {
      if (vec && vec.magnitude > 0) TD.game.setAimVector(true, vec.angle);
      else TD.game.setAimVector(false, 0);
    });

    var throwStick = createStick(throwBase, throwKnob, C.STICK_DEADZONE, function (vec) {
      if (vec) TD.game.setThrowAim(vec.dx, vec.dy, vec.magnitude);
      else TD.game.throwRelease();
    });

    // Kommando-Buttons: einfache Auswahl, der zuletzt gedrückte gilt
    // (Spec nennt kein Umschalt-/Abwahlverhalten). Deckung ist der
    // Default beim Rundenstart, siehe game.js DEFAULT_COMMAND.
    var commandButtons = Array.prototype.slice.call(document.querySelectorAll('[data-command]'));
    function refreshCommandButtons() {
      var active = TD.game.getActiveCommand();
      commandButtons.forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-command') === active);
      });
    }
    commandButtons.forEach(function (btn) {
      btn.addEventListener('pointerdown', function (e) {
        e.stopPropagation();
        TD.game.setCommand(btn.getAttribute('data-command'));
        refreshCommandButtons();
      });
    });
    refreshCommandButtons();

    // Tastatur: nur als Desktop-Testkomfort (siehe Kommentar oben) –
    // Pfeiltasten/WASD für Bewegung, ESC pausiert. Schuss/Wurf bleiben
    // den Sticks vorbehalten, per Maus per Drag auf dem jeweiligen Stick
    // genauso bedienbar wie per Touch (Pointer Events decken beides ab).
    var keys = { up: false, down: false, left: false, right: false };
    function applyKeyboardMove() {
      var dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      var dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      var mag = (dx || dy) ? 1 : 0;
      var len = Math.hypot(dx, dy) || 1;
      TD.game.setMoveVector(dx / len, dy / len, mag);
    }
    global.addEventListener('keydown', function (e) {
      switch (e.code) {
        case 'ArrowUp': case 'KeyW': keys.up = true; break;
        case 'ArrowDown': case 'KeyS': keys.down = true; break;
        case 'ArrowLeft': case 'KeyA': keys.left = true; break;
        case 'ArrowRight': case 'KeyD': keys.right = true; break;
        case 'Escape': TD.game.togglePause(); return;
        default: return;
      }
      applyKeyboardMove();
      e.preventDefault();
    });
    global.addEventListener('keyup', function (e) {
      switch (e.code) {
        case 'ArrowUp': case 'KeyW': keys.up = false; break;
        case 'ArrowDown': case 'KeyS': keys.down = false; break;
        case 'ArrowLeft': case 'KeyA': keys.left = false; break;
        case 'ArrowRight': case 'KeyD': keys.right = false; break;
        default: return;
      }
      applyKeyboardMove();
      e.preventDefault();
    });

    global.addEventListener('blur', function () {
      moveStick.forceRelease();
      shootStick.forceRelease();
      throwStick.forceRelease();
      keys.up = keys.down = keys.left = keys.right = false;
      TD.game.setMoveVector(0, 0, 0);
    });

    TD.input._refreshCommandButtons = refreshCommandButtons;
  }

  TD.input = { attach: attach };
})(window);
