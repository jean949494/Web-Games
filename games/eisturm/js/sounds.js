/**
 * Eisturm-spezifische Ton-Sequenzen, aufgebaut auf dem geteilten
 * Ton-Synthesizer (SG.audio.tone) aus shared/audio.js.
 */
(function (global) {
  'use strict';

  var ET = global.ET = global.ET || {};
  var SG = global.SG;

  var sounds = {
    // Höheres Lauftempo beim Absprung -> höherer, längerer Ton.
    playJump: function (speedFactor) {
      var base = 360 + speedFactor * 160;
      SG.audio.tone(base, 90 + speedFactor * 40, { type: 'triangle', slideTo: base * 1.3, gain: 0.13 });
    },

    playLand: function () {
      SG.audio.tone(200, 60, { type: 'sine', slideTo: 140, gain: 0.09 });
    },

    // Kurzes "Ping" beim Abprallen an der Seitenwand.
    playWall: function () {
      SG.audio.tone(520, 55, { type: 'square', slideTo: 760, gain: 0.07 });
    },

    // Combo-Fanfare: mehr Töne bei höherer Combo.
    playCombo: function (comboCount) {
      var notes = [660, 880, 1100, 1320, 1560, 1760];
      var count = Math.max(2, Math.min(notes.length, comboCount));
      var delay = 0;
      for (var i = 0; i < count; i++) {
        (function (freq) {
          setTimeout(function () { SG.audio.tone(freq, 90, { type: 'triangle', gain: 0.1 }); }, delay);
        })(notes[i]);
        delay += 65;
      }
    },
  };

  ET.sounds = sounds;
})(window);
