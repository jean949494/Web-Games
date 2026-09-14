/**
 * Lokaler Highscore- und Einstellungs-Speicher (localStorage).
 * Fällt still auf In-Memory-Werte zurück, falls localStorage nicht
 * verfügbar ist (z.B. Privates Fenster mit blockiertem Storage).
 */
(function (global) {
  'use strict';

  var NW = global.NW = global.NW || {};

  var KEY_BEST = 'nw_best_score';
  var KEY_SOUND = 'nw_sound_enabled';

  var memory = { best: 0, sound: true };

  function safeGet(key, fallback) {
    try {
      var v = global.localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function safeSet(key, value) {
    try {
      global.localStorage.setItem(key, value);
      return true;
    } catch (e) {
      return false;
    }
  }

  var storage = {
    getBest: function () {
      var v = safeGet(KEY_BEST, null);
      if (v === null) return memory.best;
      var n = parseInt(v, 10);
      return isNaN(n) ? memory.best : n;
    },

    setBest: function (score) {
      score = Math.max(0, Math.floor(score));
      memory.best = Math.max(memory.best, score);
      if (score > storage.getBest()) {
        safeSet(KEY_BEST, String(score));
        return true; // neuer Highscore
      }
      return false;
    },

    getSoundEnabled: function () {
      var v = safeGet(KEY_SOUND, null);
      if (v === null) return memory.sound;
      return v === '1';
    },

    setSoundEnabled: function (enabled) {
      memory.sound = !!enabled;
      safeSet(KEY_SOUND, enabled ? '1' : '0');
    },
  };

  NW.storage = storage;
})(window);
