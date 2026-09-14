/**
 * Analytics-Events – Platzhalter-Provider, geteilt von allen Spielen.
 * Standard: console.debug (nur wenn ?debug in der URL steht) + CustomEvent
 * auf window, damit ein späteres echtes Analytics-Script (Poki, GA, ...)
 * einfach andocken kann, ohne den Spielcode zu ändern.
 *
 * Jedes Spiel ruft einmal `SG.analytics.setGame('<spiel-id>')` auf (z.B.
 * in main.js), damit jedes Event weiß, aus welchem Spiel es stammt.
 */
(function (global) {
  'use strict';

  var SG = global.SG = global.SG || {};

  var debug = /[?&]debug\b/.test(global.location.search);
  var provider = null; // optionaler externer Provider: function(event, params)
  var currentGame = null;

  var analytics = {
    setGame: function (gameId) {
      currentGame = gameId;
    },

    setProvider: function (fn) {
      provider = typeof fn === 'function' ? fn : null;
    },

    track: function (event, params) {
      params = params || {};
      if (currentGame && params.game == null) params.game = currentGame;
      if (debug) {
        console.debug('[analytics]', event, params);
      }
      try {
        global.dispatchEvent(new CustomEvent('sg:analytics', { detail: { event: event, params: params } }));
      } catch (e) { /* CustomEvent evtl. nicht verfügbar */ }
      if (provider) {
        try { provider(event, params); } catch (e) { /* Provider-Fehler nie das Spiel stören lassen */ }
      }
    },
  };

  SG.analytics = analytics;
})(window);
