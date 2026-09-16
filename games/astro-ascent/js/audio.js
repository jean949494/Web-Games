/**
 * Minimaler Sound-Synthesizer (WebAudio, keine Asset-Dateien nötig).
 * Kindgerecht: kurze, freundliche Blip-Sounds statt harter Effekte.
 * Sterben klingt wie ein Game-Over-Jingle, nicht wie eine Verletzung.
 */
(function (global) {
  'use strict';

  var NW = global.NW = global.NW || {};

  var ctx = null;
  var enabled = NW.storage ? NW.storage.getSoundEnabled() : true;

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

    isEnabled: function () {
      return enabled;
    },

    setEnabled: function (v) {
      enabled = !!v;
      if (NW.storage) NW.storage.setSoundEnabled(enabled);
    },

    toggle: function () {
      audio.setEnabled(!enabled);
      return enabled;
    },

    // Höhere Ladestufe -> höherer, längerer Ton (spürbares Feedback).
    playJump: function (tier) {
      var base = 340 + tier * 70;
      tone(base, 90 + tier * 18, { type: 'triangle', slideTo: base * 1.4, gain: 0.14 });
    },

    playLand: function () {
      tone(180, 70, { type: 'sine', slideTo: 120, gain: 0.1 });
    },

    playKnapp: function () {
      tone(880, 90, { type: 'square', gain: 0.07 });
    },

    // Freundlich statt hart – kein "Verletzungs"-Sound.
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

    playUI: function () {
      tone(500, 50, { type: 'triangle', gain: 0.06 });
    },
  };

  NW.audio = audio;
})(window);
