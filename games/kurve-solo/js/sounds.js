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
  };

  KS.sounds = sounds;
})(window);
