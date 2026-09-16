/**
 * Blackout – Steuerung.
 *
 * Zwei Touch-Varianten, im Menü umschaltbar, damit sich am echten Gerät
 * entscheiden lässt, welche besser liegt:
 *
 *  "halves"  Linke Bildschirmhälfte ist nochmal geteilt: links halten =
 *            nach links, rechts halten = nach rechts. Rechte Hälfte = Sprung.
 *            Entspricht am genauesten der Tastatursteuerung des Originals
 *            (dort ist Laufen auch digital, nicht analog).
 *
 *  "stick"   Virtueller Daumen-Stick: Er erscheint dort, wo der Daumen
 *            aufsetzt, und folgt ihm. Verzeiht ungenaues Auflegen,
 *            verdeckt dafür mehr Bild.
 *
 * Beide brauchen Mehrfinger-Betrieb: Laufen UND Springen gleichzeitig ist
 * in einem Platformer keine Kür, sondern Pflicht.
 */
(function (global, document) {
  'use strict';

  var BO = global.BO = global.BO || {};

  var scheme = 'halves';
  var stageEl = null;

  var keys = { left: false, right: false, jump: false };
  var pointers = {}; // pointerId -> {role, x, y, originX}
  var stick = null; // {id, originX, dx}

  var DEAD_ZONE = 12; // px, bevor der Stick als Richtung zählt

  function rectPos(e) {
    var r = stageEl.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / r.width, // 0..1
      y: (e.clientY - r.top) / r.height,
      px: e.clientX - r.left,
      rw: r.width,
    };
  }

  function assign(e) {
    var p = rectPos(e);
    if (p.x < 0.5) {
      if (scheme === 'stick') {
        stick = { id: e.pointerId, originX: p.px, dx: 0 };
        pointers[e.pointerId] = { role: 'stick' };
      } else {
        pointers[e.pointerId] = { role: p.x < 0.25 ? 'left' : 'right' };
      }
    } else {
      pointers[e.pointerId] = { role: 'jump' };
    }
  }

  function attach(el) {
    stageEl = el;

    el.addEventListener('pointerdown', function (e) {
      el.setPointerCapture && el.setPointerCapture(e.pointerId);
      assign(e);
      e.preventDefault();
    });

    el.addEventListener('pointermove', function (e) {
      var p = pointers[e.pointerId];
      if (!p) return;
      if (p.role === 'stick' && stick && stick.id === e.pointerId) {
        stick.dx = rectPos(e).px - stick.originX;
      } else if (scheme === 'halves' && (p.role === 'left' || p.role === 'right')) {
        // Daumen darf zwischen den Zonen wandern, ohne neu aufsetzen zu müssen
        var pos = rectPos(e);
        if (pos.x < 0.5) p.role = pos.x < 0.25 ? 'left' : 'right';
      }
      e.preventDefault();
    });

    function release(e) {
      if (stick && stick.id === e.pointerId) stick = null;
      delete pointers[e.pointerId];
    }
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('pointerleave', release);
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    global.addEventListener('keydown', function (e) {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { keys.left = true; e.preventDefault(); }
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') { keys.right = true; e.preventDefault(); }
      else if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { keys.jump = true; e.preventDefault(); }
      else if (e.code === 'Escape') { BO.game.togglePause(); }
    });

    global.addEventListener('keyup', function (e) {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
      else if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') keys.jump = false;
    });

    global.addEventListener('blur', function () {
      keys.left = keys.right = keys.jump = false;
      pointers = {};
      stick = null;
    });
  }

  function read() {
    var hor = 0, jump = 0;
    if (keys.left) hor -= 1;
    if (keys.right) hor += 1;
    if (keys.jump) jump = 1;

    for (var id in pointers) {
      var role = pointers[id].role;
      if (role === 'jump') jump = 1;
      else if (role === 'left') hor -= 1;
      else if (role === 'right') hor += 1;
    }
    if (stick) {
      if (stick.dx < -DEAD_ZONE) hor -= 1;
      else if (stick.dx > DEAD_ZONE) hor += 1;
    }

    if (hor > 1) hor = 1;
    if (hor < -1) hor = -1;
    return { hor: hor, jump: jump };
  }

  BO.input = {
    attach: attach,
    read: read,
    setScheme: function (s) { scheme = s; stick = null; pointers = {}; },
    getScheme: function () { return scheme; },
    // Für die Anzeige der Steuerungszonen
    debugState: function () { return { scheme: scheme, stick: stick, pointers: pointers }; },
  };
})(typeof window !== 'undefined' ? window : globalThis, typeof document !== 'undefined' ? document : null);
