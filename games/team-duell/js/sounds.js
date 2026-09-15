/**
 * Team-Duell-spezifische Ton-Sequenzen, aufgebaut auf dem geteilten
 * Ton-Synthesizer (SG.audio.tone) aus shared/audio.js. Kindgerecht:
 * Wasserkanone/Superwurf statt Flammenwerfer/Rakete (Spec-Reskin) klingen
 * entsprechend freundlich-plüschig, kein harter Waffensound.
 */
(function (global) {
  'use strict';

  var TD = global.TD = global.TD || {};
  var SG = global.SG;

  var sounds = {
    playShoot: function () {
      SG.audio.tone(720, 40, { type: 'triangle', slideTo: 420, gain: 0.045 });
    },

    playWallHit: function () {
      SG.audio.tone(200, 70, { type: 'square', slideTo: 90, gain: 0.06 });
    },

    // Etwas kräftiger/tiefer als ein normaler Wandtreffer – markiert den
    // Moment, in dem ein Segment tatsächlich durchbricht (Lücke entsteht).
    playWallBreak: function () {
      SG.audio.tone(150, 150, { type: 'square', slideTo: 50, gain: 0.1 });
    },

    playUnitHit: function () {
      SG.audio.tone(340, 90, { type: 'sine', slideTo: 160, gain: 0.08 });
    },

    playThrow: function () {
      SG.audio.tone(300, 220, { type: 'sine', slideTo: 520, gain: 0.06 });
    },

    playSplashHit: function () {
      SG.audio.tone(500, 160, { type: 'triangle', slideTo: 120, gain: 0.1 });
    },

    playSplashMiss: function () {
      SG.audio.tone(260, 120, { type: 'sine', slideTo: 140, gain: 0.05 });
    },

    playWin: function () {
      var notes = [523, 659, 784, 1047];
      var delay = 0;
      notes.forEach(function (freq) {
        setTimeout(function () { SG.audio.tone(freq, 160, { type: 'sine', gain: 0.11 }); }, delay);
        delay += 110;
      });
    },

    playLose: function () {
      SG.audio.tone(220, 260, { type: 'sine', slideTo: 90, gain: 0.1 });
    },
  };

  TD.sounds = sounds;
})(window);
