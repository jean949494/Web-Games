/**
 * Kurve-Solo-spezifische Ton-Sequenzen, aufgebaut auf dem geteilten
 * Ton-Synthesizer (SG.audio.tone) aus shared/audio.js.
 */
(function (global) {
  'use strict';

  var KS = global.KS = global.KS || {};
  var SG = global.SG;

  var sounds = {
    // Freundlicher "Puff" statt hartem Crash – kindgerecht.
    playCrash: function () {
      SG.audio.tone(180, 140, { type: 'square', slideTo: 60, gain: 0.12 });
    },

    // Kurzer, aufsteigender Doppel-Ton für das Power-Up – befriedigend statt neutral.
    playPowerup: function () {
      SG.audio.tone(660, 70, { type: 'triangle', slideTo: 880, gain: 0.12 });
      setTimeout(function () {
        SG.audio.tone(880, 90, { type: 'triangle', slideTo: 1180, gain: 0.1 });
      }, 60);
    },
  };

  KS.sounds = sounds;
})(window);
