/**
 * Astro-Ascent-spezifische Ton-Sequenzen, aufgebaut auf dem geteilten
 * Ton-Synthesizer (SG.audio.tone) aus shared/audio.js. Etwas elektronischer
 * als beim Ninja (Sägezahn/Rechteck statt Dreieck/Sinus), passend zum
 * Sci-Fi-Thema.
 */
(function (global) {
  'use strict';

  var AA = global.AA = global.AA || {};
  var SG = global.SG;

  var sounds = {
    // Höhere Ladestufe -> höherer, längerer Ton (spürbares Feedback).
    playJump: function (tier) {
      var base = 300 + tier * 90;
      SG.audio.tone(base, 100 + tier * 20, { type: 'sawtooth', slideTo: base * 1.6, gain: 0.11 });
    },

    playLand: function () {
      SG.audio.tone(220, 60, { type: 'square', slideTo: 140, gain: 0.08 });
    },

    playKnapp: function () {
      SG.audio.tone(1040, 90, { type: 'square', gain: 0.07 });
    },
  };

  AA.sounds = sounds;
})(window);
