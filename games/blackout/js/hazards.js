/**
 * Blackout – Gefahren.
 *
 * Drei Typen, bewusst aus dem Original abgeleitet:
 *
 * MINE     Steht still, tötet bei Berührung. Das ruhige Element, das Wege
 *          verengt und zum genauen Springen zwingt.
 *
 * DROHNE   Patrouilliert auf dem Kachelraster und biegt an Wänden ab
 *          (Rasterlogik 1:1 aus nsim.py, EntityDroneBase: sie fährt immer
 *          zur Mitte der Nachbarzelle und wählt dort neu). Vorhersehbar,
 *          aber sie zwingt zum Warten und Timen.
 *
 * GESCHÜTZ Das Herzstück und der Grund für dieses Spiel: Es sieht dich nur
 *          bei freier Sichtlinie, dreht sich mit BEGRENZTER Geschwindigkeit
 *          auf dich zu, lädt hörbar/sichtbar auf und schießt dann sofort
 *          tödlich entlang der Linie. Daraus entsteht das Anpirschen:
 *          in Deckung bleiben, den Moment abwarten, schnell durchhuschen -
 *          und wer zu schnell quer läuft, den verliert das Geschütz wieder.
 */
(function (global) {
  'use strict';

  var BO = global.BO = global.BO || {};
  var C = BO.constants;

  // ---------------------------------------------------------------- Mine ---

  function Mine(x, y) {
    this.kind = 'mine';
    this.x = x;
    this.y = y;
    this.r = 4;
    this.pulse = 0;
  }

  Mine.prototype.update = function () {
    this.pulse += 0.05;
  };

  Mine.prototype.hits = function (ninja) {
    var dx = ninja.xpos - this.x;
    var dy = ninja.ypos - this.y;
    var rr = this.r + C.RADIUS;
    return dx * dx + dy * dy < rr * rr;
  };

  // -------------------------------------------------------------- Drohne ---

  var DIR_VEC = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  // Reihenfolge der bevorzugten Richtungen je Modus (aus dem Original):
  // 0: Wand im Uhrzeigersinn folgen, 1: gegen den Uhrzeigersinn,
  // 2: umherwandern CW, 3: umherwandern CCW.
  var DIR_LIST = {
    0: [1, 0, 3, 2],
    1: [3, 0, 1, 2],
    2: [0, 1, 3, 2],
    3: [0, 3, 1, 2],
  };

  function Drone(world, x, y, dir, mode, speed) {
    this.kind = 'drone';
    this.world = world;
    this.x = x;
    this.y = y;
    this.r = 7.5;
    this.dir = dir == null ? 0 : dir;
    this.mode = mode == null ? 0 : mode;
    this.speed = speed || 8 / 7; // Originalgeschwindigkeit der Zap-Drohne
    this.xtarget = x;
    this.ytarget = y;
  }

  /** Ist der Weg zur Nachbarzelle in dieser Richtung frei? */
  Drone.prototype.canGo = function (dir) {
    var v = DIR_VEC[dir];
    var tx = this.x + C.TILE * v[0];
    var ty = this.y + C.TILE * v[1];
    // Grob, aber ausreichend: Zielzelle und der Weg dorthin müssen leer sein.
    var cx = Math.floor(tx / C.TILE);
    var cy = Math.floor(ty / C.TILE);
    if (this.world.tileAt(cx, cy) !== C.T_EMPTY) return false;
    this.xtarget = tx;
    this.ytarget = ty;
    return true;
  };

  Drone.prototype.chooseNext = function () {
    for (var i = 0; i < 4; i++) {
      var newDir = (this.dir + DIR_LIST[this.mode][i]) % 4;
      if (this.canGo(newDir)) {
        this.dir = newDir;
        return true;
      }
    }
    return false;
  };

  Drone.prototype.update = function () {
    var v = DIR_VEC[this.dir];
    var xs = this.speed * v[0];
    var ys = this.speed * v[1];
    var dx = this.xtarget - this.x;
    var dy = this.ytarget - this.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    // Mitte der Zielzelle erreicht oder überschritten -> neu entscheiden
    if (dist < 0.000001 || (dx * (this.xtarget - (this.x + xs)) + dy * (this.ytarget - (this.y + ys))) < 0) {
      this.x = this.xtarget;
      this.y = this.ytarget;
      if (this.chooseNext()) {
        var disp = this.speed - dist;
        this.x += disp * DIR_VEC[this.dir][0];
        this.y += disp * DIR_VEC[this.dir][1];
      }
    } else {
      this.x += xs;
      this.y += ys;
    }
  };

  Drone.prototype.hits = function (ninja) {
    var dx = ninja.xpos - this.x;
    var dy = ninja.ypos - this.y;
    var rr = this.r + C.RADIUS;
    return dx * dx + dy * dy < rr * rr;
  };

  // ------------------------------------------------------------ Geschütz ---

  var TURRET = {
    SIGHT_RANGE: 300,
    TURN_SPEED: 0.045, // rad/Frame - langsam genug, dass schnelles Queren es abhängt
    AIM_TOLERANCE: 0.14, // ab hier gilt "im Visier" und das Aufladen beginnt
    CHARGE_FRAMES: 38, // ca. 0.63 s Vorwarnung
    FIRE_FRAMES: 10, // so lange ist der Strahl tödlich
    COOLDOWN_FRAMES: 34,
    BEAM_HALF: 3.2, // halbe Trefferbreite des Strahls
  };

  function Turret(world, x, y, baseAngle) {
    this.kind = 'turret';
    this.world = world;
    this.x = x;
    this.y = y;
    this.r = 7;
    this.angle = baseAngle == null ? 0 : baseAngle;
    this.phase = 'idle'; // idle -> tracking -> charging -> firing -> cooldown
    this.timer = 0;
    this.beamLen = 0;
    this.fireAngle = 0;
  }

  Turret.prototype.seesNinja = function (ninja) {
    var dx = ninja.xpos - this.x;
    var dy = ninja.ypos - this.y;
    if (dx * dx + dy * dy > TURRET.SIGHT_RANGE * TURRET.SIGHT_RANGE) return false;
    return this.world.hasLineOfSight(this.x, this.y, ninja.xpos, ninja.ypos);
  };

  function angleDiff(a, b) {
    var d = (a - b) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  Turret.prototype.update = function (ninja) {
    var sees = ninja && !ninja.dead && this.seesNinja(ninja);

    if (this.phase === 'cooldown') {
      if (--this.timer <= 0) this.phase = 'idle';
      return;
    }

    if (this.phase === 'firing') {
      if (--this.timer <= 0) {
        this.phase = 'cooldown';
        this.timer = TURRET.COOLDOWN_FRAMES;
      }
      return;
    }

    if (!sees) {
      // Sichtkontakt verloren -> Aufladen bricht ab. Das ist der Grund,
      // warum Deckung suchen funktioniert.
      this.phase = 'idle';
      this.timer = 0;
      return;
    }

    var target = Math.atan2(ninja.ypos - this.y, ninja.xpos - this.x);
    var diff = angleDiff(target, this.angle);
    var step = Math.max(-TURRET.TURN_SPEED, Math.min(TURRET.TURN_SPEED, diff));
    this.angle += step;

    if (Math.abs(diff) <= TURRET.AIM_TOLERANCE) {
      if (this.phase !== 'charging') {
        this.phase = 'charging';
        this.timer = TURRET.CHARGE_FRAMES;
        if (this.onCharge) this.onCharge();
      } else if (--this.timer <= 0) {
        this.phase = 'firing';
        this.timer = TURRET.FIRE_FRAMES;
        this.fireAngle = this.angle;
        this.beamLen = this.rayLength(this.angle);
        if (this.onFire) this.onFire();
      }
    } else {
      // Ziel wieder aus dem Visier gelaufen -> Aufladen zurücksetzen
      this.phase = 'tracking';
      this.timer = 0;
    }
  };

  /** Länge des Strahls bis zur ersten Wand. */
  Turret.prototype.rayLength = function (angle) {
    var dx = Math.cos(angle), dy = Math.sin(angle);
    var step = 4;
    var maxLen = 700;
    for (var d = step; d < maxLen; d += step) {
      var px = this.x + dx * d;
      var py = this.y + dy * d;
      var cx = Math.floor(px / C.TILE);
      var cy = Math.floor(py / C.TILE);
      if (this.world.tileAt(cx, cy) !== C.T_EMPTY) return d - step;
    }
    return maxLen;
  };

  Turret.prototype.hits = function (ninja) {
    if (this.phase !== 'firing') return false;
    var dx = Math.cos(this.fireAngle), dy = Math.sin(this.fireAngle);
    // Abstand des Ninja vom Strahl (Punkt-Geraden-Abstand, begrenzt auf die Strahllänge)
    var vx = ninja.xpos - this.x;
    var vy = ninja.ypos - this.y;
    var along = vx * dx + vy * dy;
    if (along < 0 || along > this.beamLen) return false;
    var perp = Math.abs(vx * dy - vy * dx);
    return perp < TURRET.BEAM_HALF + C.RADIUS * 0.8;
  };

  BO.Mine = Mine;
  BO.Drone = Drone;
  BO.Turret = Turret;
  BO.TURRET_CFG = TURRET;
})(typeof window !== 'undefined' ? window : globalThis);
