/**
 * Touch- (Pointer Events) und Tastatursteuerung.
 *
 * Linke Bildschirmhälfte halten = Linkskurve, rechte = Rechtskurve,
 * loslassen = geradeaus. Bewusst nur Pointer Events (siehe Spec:
 * Touch-Zuverlässigkeitsprobleme im Prototyp lagen an der Chat-Iframe-
 * Testumgebung, nicht an der Mechanik – keine Redundanz-Lösung nötig).
 *
 * Wichtig aus der Spec ("gelöste Probleme"): ein Tap nach Game Over muss
 * GLEICHZEITIG neu starten UND lenken, nicht zwei separate Tipps
 * verlangen – siehe restartAndSteer().
 */
(function (global) {
  'use strict';

  var KS = global.KS = global.KS || {};
  var SG = global.SG;

  function attach(stageEl) {
    var pointerActive = false;

    function sideForClientX(clientX) {
      var rect = stageEl.getBoundingClientRect();
      var mid = rect.left + rect.width / 2;
      return clientX < mid ? -1 : 1;
    }

    function setSide(side) {
      KS.game.setTurn(side);
    }

    function restartAndSteer(side) {
      SG.poki.commercialBreak(function () {
        KS.game.restart();
        setSide(side);
      });
    }

    function beginSide(side) {
      if (KS.game.getState() === KS.game.STATES.GAMEOVER) {
        restartAndSteer(side);
      } else {
        setSide(side);
      }
    }

    stageEl.addEventListener('pointerdown', function (e) {
      pointerActive = true;
      beginSide(sideForClientX(e.clientX));
      e.preventDefault();
    });

    stageEl.addEventListener('pointermove', function (e) {
      if (!pointerActive) return;
      setSide(sideForClientX(e.clientX));
    });

    function release(e) {
      if (!pointerActive) return;
      pointerActive = false;
      setSide(0);
      if (e) e.preventDefault();
    }

    stageEl.addEventListener('pointerup', release);
    stageEl.addEventListener('pointercancel', release);
    stageEl.addEventListener('pointerleave', release);
    stageEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // Tastatur: Pfeiltasten oder A/D halten lenkt, ESC pausiert.
    var keyLeft = false, keyRight = false;
    function keySide() {
      if (keyLeft && !keyRight) return -1;
      if (keyRight && !keyLeft) return 1;
      return 0;
    }

    global.addEventListener('keydown', function (e) {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        if (!keyLeft) { keyLeft = true; beginSide(keySide()); }
        e.preventDefault();
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        if (!keyRight) { keyRight = true; beginSide(keySide()); }
        e.preventDefault();
      } else if (e.code === 'Escape') {
        KS.game.togglePause();
      }
    });

    global.addEventListener('keyup', function (e) {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        keyLeft = false;
        setSide(keySide());
        e.preventDefault();
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        keyRight = false;
        setSide(keySide());
        e.preventDefault();
      }
    });

    // Falls das Fenster/Tab während des Haltens den Fokus verliert
    global.addEventListener('blur', function () {
      pointerActive = false;
      keyLeft = false;
      keyRight = false;
      setSide(0);
    });
  }

  KS.input = { attach: attach };
})(window);
