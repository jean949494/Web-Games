/**
 * Blackout – spielspezifische Töne, aufgebaut auf dem geteilten
 * Synthesizer (SG.audio.tone) aus shared/audio.js.
 *
 * Bewusst trocken und kurz: In einem Spiel, in dem man oft stirbt, darf
 * kein Ton nerven. Der Tod klingt wie ein abgeschalteter Stromkreis,
 * nicht wie eine Verletzung.
 */
(function (global) {
  'use strict';

  var BO = global.BO = global.BO || {};
  var SG = global.SG;

  var lastJump = 0;

  var sounds = {
    playJump: function (kind) {
      // Wandsprünge klingen kürzer und höher als Bodensprünge
      var now = Date.now();
      if (now - lastJump < 40) return;
      lastJump = now;
      if (kind === 'wall') {
        SG.audio.tone(520, 55, { type: 'square', slideTo: 700, gain: 0.05 });
      } else {
        SG.audio.tone(330, 70, { type: 'triangle', slideTo: 460, gain: 0.07 });
      }
    },

    playGold: function () {
      SG.audio.tone(880, 60, { type: 'triangle', slideTo: 1320, gain: 0.07 });
    },

    playSwitch: function () {
      SG.audio.tone(300, 90, { type: 'square', slideTo: 620, gain: 0.08 });
    },

    playDoor: function () {
      SG.audio.tone(440, 120, { type: 'triangle', slideTo: 880, gain: 0.08 });
    },

    playCharge: function () {
      SG.audio.tone(200, 220, { type: 'sawtooth', slideTo: 420, gain: 0.04 });
    },

    playDeath: function () {
      // absteigend: "Strom weg"
      SG.audio.tone(320, 260, { type: 'sawtooth', slideTo: 60, gain: 0.09 });
    },
  };

  BO.sounds = sounds;
})(typeof window !== 'undefined' ? window : globalThis);
