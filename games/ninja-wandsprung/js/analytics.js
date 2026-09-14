/**
 * Analytics-Events – Platzhalter-Provider.
 * Standard: console.debug (nur wenn ?debug in der URL steht) + CustomEvent
 * auf window, damit ein späteres echtes Analytics-Script (Poki, GA, ...)
 * einfach andocken kann, ohne den Spielcode zu ändern.
 */
(function (global) {
  'use strict';

  var NW = global.NW = global.NW || {};

  var debug = /[?&]debug\b/.test(global.location.search);
  var provider = null; // optionaler externer Provider: function(event, params)

  var analytics = {
    setProvider: function (fn) {
      provider = typeof fn === 'function' ? fn : null;
    },

    track: function (event, params) {
      params = params || {};
      if (debug) {
        console.debug('[analytics]', event, params);
      }
      try {
        global.dispatchEvent(new CustomEvent('nw:analytics', { detail: { event: event, params: params } }));
      } catch (e) { /* CustomEvent evtl. nicht verfügbar */ }
      if (provider) {
        try { provider(event, params); } catch (e) { /* Provider-Fehler nie das Spiel stören lassen */ }
      }
    },
  };

  NW.analytics = analytics;
})(window);
