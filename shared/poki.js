/**
 * Poki SDK Wrapper – austauschbares Modul, geteilt von allen Spielen.
 *
 * Nutzt das echte Poki SDK (window.PokiSDK), falls es geladen ist (z.B.
 * beim Export für das Poki-Portal via deren Script-Tag). Läuft es
 * standalone / auf einer anderen Test-URL, sind alle Aufrufe No-Ops –
 * das Spiel verhält sich exakt gleich, nur ohne Portal-Feedback.
 *
 * Wichtig laut Spec: zuerst NUR bei Poki einreichen (Web-Exklusivität),
 * andere Portale erst bei Absage. Dieses Modul macht den späteren
 * Wechsel/die Erweiterung auf weitere SDKs unkompliziert.
 */
(function (global) {
  'use strict';

  var SG = global.SG = global.SG || {};

  var sdk = global.PokiSDK || null;
  var ready = false;

  var poki = {
    hasSdk: function () {
      return !!sdk;
    },

    init: function () {
      if (!sdk || typeof sdk.init !== 'function') {
        ready = true;
        return Promise.resolve();
      }
      return sdk.init().then(function () {
        ready = true;
      }).catch(function () {
        ready = true; // Spiel darf niemals an einem SDK-Fehler hängen bleiben
      });
    },

    gameLoadingFinished: function () {
      if (sdk && ready && typeof sdk.gameLoadingFinished === 'function') {
        sdk.gameLoadingFinished();
      }
    },

    gameplayStart: function () {
      if (sdk && ready && typeof sdk.gameplayStart === 'function') {
        sdk.gameplayStart();
      }
    },

    gameplayStop: function () {
      if (sdk && ready && typeof sdk.gameplayStop === 'function') {
        sdk.gameplayStop();
      }
    },

    // Vor einem Neustart (z.B. Game-Over -> nochmal spielen) aufrufen.
    // Ruft callback synchron/asynchron auf, je nachdem ob ein Break gezeigt wird.
    commercialBreak: function (callback) {
      if (sdk && ready && typeof sdk.commercialBreak === 'function') {
        sdk.commercialBreak().then(callback).catch(callback);
      } else if (typeof callback === 'function') {
        callback();
      }
    },
  };

  SG.poki = poki;
})(window);
