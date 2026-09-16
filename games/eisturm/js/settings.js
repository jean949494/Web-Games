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
  var KEY_SKIN = 'et_skin';
  var KEY_BRAKE = 'et_dash_brake';
  var MODES = { TILT: 'tilt', TOUCH: 'touch' };
  var DEFAULT_MODE = MODES.TILT;
  var current = null;

  function safeGet(key) {
    try { return global.localStorage.getItem(key); } catch (e) { return null; }
  }

  function safeSet(key, v) {
    try { global.localStorage.setItem(key, v); } catch (e) { /* z.B. privates Fenster ohne Storage */ }
  }

  ET.settings = {
    MODES: MODES,

    getControlMode: function () {
      if (current) return current;
      var v = safeGet(KEY);
      current = (v === MODES.TILT || v === MODES.TOUCH) ? v : DEFAULT_MODE;
      return current;
    },

    setControlMode: function (mode) {
      if (mode !== MODES.TILT && mode !== MODES.TOUCH) return;
      current = mode;
      safeSet(KEY, mode);
    },

    getSkin: function (available) {
      var v = safeGet(KEY_SKIN);
      for (var i = 0; i < available.length; i++) {
        if (available[i].id === v) return v;
      }
      return available[0].id;
    },

    setSkin: function (id) {
      safeSet(KEY_SKIN, id);
    },

    // Index in DASH_BRAKE_LEVELS
    getDashBrake: function (levels, fallback) {
      var v = parseInt(safeGet(KEY_BRAKE), 10);
      return (v >= 0 && v < levels.length) ? v : fallback;
    },

    setDashBrake: function (index) {
      safeSet(KEY_BRAKE, String(index));
    },
  };
})(window);
