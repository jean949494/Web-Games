/**
 * Gewählte Steuerung – lokal gespeichert (localStorage), umschaltbar im
 * Menü. Es ist immer nur EINE aktiv:
 *
 *   TILT  – Handy neigen lenkt, Antippen springt (Standard).
 *   TOUCH – Figur springt durchgehend von selbst, linke/rechte
 *           Bildschirmhälfte drücken lenkt. Zum Testen ohne Gyroskop.
 *
 * Die Tastatur (Pfeiltasten/A-D + Leertaste) läuft in beiden Fällen mit.
 */
(function (global) {
  'use strict';

  var ET = global.ET = global.ET || {};

  var KEY = 'et_control_mode';
  var MODES = { TILT: 'tilt', TOUCH: 'touch' };
  var DEFAULT_MODE = MODES.TILT;
  var current = null;

  function safeGet() {
    try { return global.localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function safeSet(v) {
    try { global.localStorage.setItem(KEY, v); } catch (e) { /* z.B. privates Fenster ohne Storage */ }
  }

  ET.settings = {
    MODES: MODES,

    getControlMode: function () {
      if (current) return current;
      var v = safeGet();
      current = (v === MODES.TILT || v === MODES.TOUCH) ? v : DEFAULT_MODE;
      return current;
    },

    setControlMode: function (mode) {
      if (mode !== MODES.TILT && mode !== MODES.TOUCH) return;
      current = mode;
      safeSet(mode);
    },
  };
})(window);
