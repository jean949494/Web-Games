/**
 * Minimaler Sound-Synthesizer (WebAudio, keine Asset-Dateien nötig),
 * geteilt von allen Spielen in diesem Repo. Kindgerecht: kurze,
 * freundliche Blip-Sounds statt harter Effekte.
 *
 * Enthält nur den Kern (Ton-Engine, an/aus, ein paar generische Sounds).
 * Spielspezifische Ton-Sequenzen (z.B. "Sprung", "Landung") gehören in
 * eine kleine sounds.js im jeweiligen Spielordner, die auf `tone()`
 * aufbaut – siehe games/ninja-wandsprung/js/sounds.js als Beispiel.
 */
(function (global) {
  'use strict';

  var SG = global.SG = global.SG || {};

  var ctx = null;
  var enabled = SG.storage ? SG.storage.getSoundEnabled() : true;

  function ensureCtx() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  }

  // Vom ersten Nutzer-Tap/Klick aus aufrufen (Autoplay-Policy).
  function unlock() {
    var c = ensureCtx();
    if (c && c.state === 'suspended') {
      c.resume();
    }
  }

  function tone(freq, durationMs, opts) {
    if (!enabled) return;
    var c = ensureCtx();
    if (!c) return;
    opts = opts || {};
    var type = opts.type || 'sine';
    var gainPeak = opts.gain != null ? opts.gain : 0.12;
    var t0 = c.currentTime;
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.slideTo), t0 + durationMs / 1000);
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(gainPeak, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + durationMs / 1000 + 0.02);
  }

  var audio = {
    unlock: unlock,
    tone: tone,

    isEnabled: function () {
      return enabled;
    },

    setEnabled: function (v) {
      enabled = !!v;
      if (SG.storage) SG.storage.setSoundEnabled(enabled);
    },

    toggle: function () {
      audio.setEnabled(!enabled);
      return enabled;
    },

    // Freundlicher Abschluss-Jingle, generisch genug für jedes Spiel.
    playGameOver: function () {
      if (!enabled) return;
      var c = ensureCtx();
      if (!c) return;
      var notes = [523, 415, 330];
      var delay = 0;
      notes.forEach(function (freq) {
        setTimeout(function () { tone(freq, 160, { type: 'sine', gain: 0.1 }); }, delay);
        delay += 110;
      });
    },

    // Generischer UI-Blip (Menü/Button).
    playUI: function () {
      tone(500, 50, { type: 'triangle', gain: 0.06 });
    },
  };

  SG.audio = audio;
})(window);
