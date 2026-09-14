/**
 * Ninja-spezifische Ton-Sequenzen, aufgebaut auf dem geteilten
 * Ton-Synthesizer (SG.audio.tone) aus shared/audio.js.
 */
(function (global) {
  'use strict';

  var NW = global.NW = global.NW || {};
  var SG = global.SG;

  var sounds = {
    // Höhere Ladestufe -> höherer, längerer Ton (spürbares Feedback).
    playJump: function (tier) {
      var base = 340 + tier * 70;
      SG.audio.tone(base, 90 + tier * 18, { type: 'triangle', slideTo: base * 1.4, gain: 0.14 });
    },

    playLand: function () {
      SG.audio.tone(180, 70, { type: 'sine', slideTo: 120, gain: 0.1 });
    },

    playKnapp: function () {
      SG.audio.tone(880, 90, { type: 'square', gain: 0.07 });
    },
  };

  NW.sounds = sounds;
})(window);
