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

  /**
   * Werte aus dem dekompilierten Originalcode von N v1.4 (TurretObject),
   * von 40 auf 60 Bilder/s umgerechnet.
   *
   * Der Kern der Mechanik: Das Fadenkreuz ist ein eigenes Objekt, das dem
   * Spieler exponentiell HINTERHERKRIECHT. Der Schuss-Countdown tickt nach
   * dem Abstand ZWISCHEN FADENKREUZ UND SPIELER - nicht nach dem Abstand
   * zum Turm. Wer in Bewegung bleibt, hält das Fadenkreuz in der äußeren
   * Zone, und dort tickt der Countdown gar nicht: Das Geschütz schießt dann
   * NIE. Wer stehenbleibt, lässt es einrasten und ist in gut 0,4 s tot.
   */
  var TURRET = {
    // Zonengrenzen nach Fadenkreuz-Abstand (Originalwerte in Pixeln)
    ZONE_OUTER: 96, // > 4 Kacheln: Countdown steht still
    ZONE_MID: 42, // 1,75-4 Kacheln: 3,0 s bis zum Schuss
    ZONE_INNER: 24, // 1-1,75 Kacheln: 1,0 s
    // darunter: ca. 0,43 s

    // Wie schnell das Fadenkreuz nachzieht (Anteil pro FRAME, von 40 auf
    // 60 Bilder/s umgerechnet: k60 = 1 - (1-k40)^(2/3))
    AIM_OUTER: 0.0201,
    AIM_MID: 0.0235,
    AIM_INNER: 0.03,
    AIM_NEAR: 0.04,

    // Countdown-Schritte pro Frame (Originalwerte x 2/3 für 60 Bilder/s).
    // Ergibt die dokumentierten Zeiten: 3,0 s / 1,0 s / 0,43 s bis zum Schuss.
    TICK_MID: 0.5 * 2 / 3,
    TICK_INNER: 2 / 3, // Basis, dazu kommt Variation
    TICK_NEAR: 2 * 2 / 3,

    SHOT_TIMER_START: 60,
    PREFIRE_FRAMES: 15, // 0,25 s mit eingefrorenem Fadenkreuz
    POSTFIRE_FRAMES: 15,
    BEAM_HALF: 2.5,

    // Fernkampfgegner denken im Original reihum, nicht jeder jeden Frame:
    // genau EIN Gegner alle 0,1 s. Mit drei Geschützen prüft jedes seine
    // Sichtlinie also nur alle 0,3 s - das ist der Grund, warum man durch
    // eine Schusslinie huschen kann.
    THINK_INTERVAL: 6,
  };

  function Turret(world, x, y) {
    this.kind = 'turret';
    this.world = world;
    this.x = x;
    this.y = y;
    this.r = 7;
    this.aimX = x; // Fadenkreuz startet auf dem Turm
    this.aimY = y;
    this.shotTimer = TURRET.SHOT_TIMER_START;
    this.phase = 'waiting'; // waiting -> targeting -> prefire -> firing -> postfire
    this.timer = 0;
    this.beamLen = 0;
    this.fireAngle = 0;
    this.visible = false; // hat der Turm gerade Sicht?
  }

  Turret.prototype.seesNinja = function (ninja) {
    // Im Original ist die Sichtlinie unbegrenzt weit und hat keinen
    // Blickkegel - nur Geometrie blockt. Deckung ist die einzige Rettung.
    return this.world.hasLineOfSight(this.x, this.y, ninja.xpos, ninja.ypos);
  };

  Turret.prototype.reset = function () {
    this.aimX = this.x;
    this.aimY = this.y;
    this.shotTimer = TURRET.SHOT_TIMER_START;
    this.phase = 'waiting';
    this.visible = false;
  };

  /**
   * NUR die Sichtprüfung ist versetzt (reihum, alle 0,1 s ein Geschütz).
   * Genau das erlaubt es, durch eine Schusslinie zu huschen, bevor das
   * Geschütz überhaupt merkt, dass jemand da war.
   */
  Turret.prototype.think = function (ninja) {
    if (this.phase === 'prefire' || this.phase === 'firing' || this.phase === 'postfire') return;

    if (!ninja || ninja.dead || !this.seesNinja(ninja)) {
      // Sicht verloren -> vollständiger Reset: Fadenkreuz springt zum Turm
      // zurück, Countdown auf Anfang. Das macht das etappenweise
      // Heranarbeiten von Deckung zu Deckung möglich.
      this.reset();
      return;
    }

    if (this.phase === 'waiting') {
      this.aimX = this.x;
      this.aimY = this.y;
      this.shotTimer = TURRET.SHOT_TIMER_START;
    }
    this.visible = true;
    this.phase = 'targeting';
  };

  /** Nachführung, Countdown und Feuerzustände - jeden Frame. */
  Turret.prototype.update = function (ninja, frame) {
    frame = frame || 0; // ohne Frame-Zähler würde der Countdown NaN werden
    if (this.phase === 'targeting' && ninja && !ninja.dead) {
      // Vorhalten: Position plus eine Frame-Geschwindigkeit
      var predX = ninja.xpos + ninja.xspeed;
      var predY = ninja.ypos + ninja.yspeed;
      var dx = predX - this.aimX;
      var dy = predY - this.aimY;
      var dist = Math.sqrt(dx * dx + dy * dy);

      var aimSpeed, tick;
      if (dist > TURRET.ZONE_OUTER) {
        aimSpeed = TURRET.AIM_OUTER;
        tick = 0; // Fadenkreuz hinkt zu weit hinterher -> es fällt kein Schuss
      } else if (dist > TURRET.ZONE_MID) {
        aimSpeed = TURRET.AIM_MID;
        tick = TURRET.TICK_MID;
      } else if (dist > TURRET.ZONE_INNER) {
        aimSpeed = TURRET.AIM_INNER;
        // Variation über den Frame-Zähler statt Zufall: bleibt reproduzierbar
        tick = TURRET.TICK_INNER * (1 + (frame % 2));
      } else {
        aimSpeed = TURRET.AIM_NEAR;
        tick = TURRET.TICK_NEAR * (1 + (frame % 4) / 3);
      }

      this.aimX += aimSpeed * dx;
      this.aimY += aimSpeed * dy;
      this.aimDist = dist;

      this.shotTimer -= tick;
      if (this.shotTimer <= 0) {
        this.phase = 'prefire';
        this.timer = TURRET.PREFIRE_FRAMES;
        if (this.onCharge) this.onCharge();
      }
      return;
    }

    if (this.phase === 'prefire') {
      // Fadenkreuz friert ein. Am Ende wird die Sicht NOCHMAL geprüft:
      // Wer sich in dieser Vierteilsekunde in Deckung wirft, bleibt heil.
      if (--this.timer <= 0) {
        if (ninja && !ninja.dead && this.seesNinja(ninja)) {
          this.fireAngle = Math.atan2(this.aimY - this.y, this.aimX - this.x);
          this.beamLen = this.rayLength(this.fireAngle);
          this.phase = 'firing';
          this.timer = 2;
          if (this.onFire) this.onFire();
        } else {
          this.reset();
        }
      }
      return;
    }
    if (this.phase === 'firing') {
      if (--this.timer <= 0) {
        this.phase = 'postfire';
        this.timer = TURRET.POSTFIRE_FRAMES;
      }
      return;
    }
    if (this.phase === 'postfire') {
      if (--this.timer <= 0) {
        // Bei erhaltener Sicht bleibt das Fadenkreuz stehen (nur der Timer
        // wird zurückgesetzt) - Stehenbleiben wird also bestraft.
        if (ninja && !ninja.dead && this.seesNinja(ninja)) {
          this.shotTimer = TURRET.SHOT_TIMER_START;
          this.phase = 'targeting';
        } else {
          this.reset();
        }
      }
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
