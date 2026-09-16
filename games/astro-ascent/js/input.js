/**
 * Touch- und Tastatursteuerung: Halten lädt, Loslassen springt.
 * game.js entscheidet selbst, ob ein chargeStart/chargeRelease gerade
 * gültig ist (z.B. nur während des Spiels) – input.js muss das nicht wissen.
 */
(function (global) {
  'use strict';

  var AA = global.AA = global.AA || {};

  function attach(stageEl) {
    var pointerActive = false;

    stageEl.addEventListener('pointerdown', function (e) {
      pointerActive = true;
      AA.game.chargeStart();
      e.preventDefault();
    });

    function release(e) {
      if (!pointerActive) return;
      pointerActive = false;
      AA.game.chargeRelease();
      if (e) e.preventDefault();
    }

    stageEl.addEventListener('pointerup', release);
    stageEl.addEventListener('pointercancel', release);
    stageEl.addEventListener('pointerleave', release);
    stageEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // Tastatur: Leertaste (oder Pfeil hoch) hält/springt, ESC pausiert
    var keyActive = false;
    global.addEventListener('keydown', function (e) {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        if (!e.repeat && !keyActive) {
          keyActive = true;
          AA.game.chargeStart();
        }
        e.preventDefault();
      } else if (e.code === 'Escape') {
        AA.game.togglePause();
      }
    });

    global.addEventListener('keyup', function (e) {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        keyActive = false;
        AA.game.chargeRelease();
        e.preventDefault();
      }
    });

    // Falls das Fenster/Tab während des Haltens den Fokus verliert
    global.addEventListener('blur', function () {
      pointerActive = false;
      keyActive = false;
    });
  }

  AA.input = { attach: attach };
})(window);
