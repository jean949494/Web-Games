/**
 * Lokaler Highscore- und Einstellungs-Speicher (localStorage), geteilt
 * von allen Spielen in diesem Repo.
 *
 * Highscores werden pro Spiel abgelegt (gameId-Präfix), da alle Spiele
 * unter derselben GitHub-Pages-Origin laufen und sich sonst ein
 * gemeinsamer Storage-Key überschreiben würde. Die Sound-Einstellung ist
 * bewusst global (ein Umschalter gilt für alle Spiele).
 *
 * Fällt still auf In-Memory-Werte zurück, falls localStorage nicht
 * verfügbar ist (z.B. privates Fenster mit blockiertem Storage).
 */
(function (global) {
  'use strict';

  var SG = global.SG = global.SG || {};

  var KEY_SOUND = 'sg_sound_enabled';
  var KEY_BEST_PREFIX = 'sg_best_';

  var memory = { sound: true, best: {} };

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
    getBest: function (gameId) {
      var v = safeGet(KEY_BEST_PREFIX + gameId, null);
      if (v === null) return memory.best[gameId] || 0;
      var n = parseInt(v, 10);
      return isNaN(n) ? (memory.best[gameId] || 0) : n;
    },

    setBest: function (gameId, score) {
      score = Math.max(0, Math.floor(score));
      // Alten Rekord VOR der memory.best-Mutation lesen, sonst vergleicht
      // sich der neue Score (nach dem Fallback auf memory.best) mit sich
      // selbst und ein allererster Highscore würde nie gespeichert.
      var previousBest = storage.getBest(gameId);
      memory.best[gameId] = Math.max(memory.best[gameId] || 0, score);
      if (score > previousBest) {
        safeSet(KEY_BEST_PREFIX + gameId, String(score));
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

  SG.storage = storage;
})(window);
