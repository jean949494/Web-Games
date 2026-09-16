/**
 * Steuerungsmodus – lokal gespeichert (localStorage), einstellbar im
 * Menü. Es ist immer nur EIN Modus aktiv, damit sich Neigung und
 * Halten/Tippen nicht gegenseitig stören:
 *
 *   TILT – Neigen links/rechts lenkt, Antippen springt.
 *   HOLD – Bildschirmhälfte halten lenkt, Richtung Gesicht kippen springt.
 *
 * Die Tastatur (Pfeiltasten/A-D + Leertaste) läuft unabhängig vom Modus
 * immer mit, als PC-Test-Fallback.
 */
(function (global) {
  'use strict';

  var ET = global.ET = global.ET || {};

  var KEY = 'et_control_mode';
  var MODES = { TILT: 'tilt', HOLD: 'hold' };
  var DEFAULT_MODE = MODES.TILT;
  var current = null;

  function safeGet() {
    try { return global.localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function safeSet(v) {
    try { global.localStorage.setItem(KEY, v); } catch (e) { /* z.B. privates Fenster ohne Storage */ }
  }

  function load() {
    if (current) return current;
    var v = safeGet();
    current = (v === MODES.TILT || v === MODES.HOLD) ? v : DEFAULT_MODE;
    return current;
  }

  ET.settings = {
    MODES: MODES,

    getControlMode: load,

    setControlMode: function (mode) {
      if (mode !== MODES.TILT && mode !== MODES.HOLD) return;
      current = mode;
      safeSet(mode);
    },
  };
})(window);
