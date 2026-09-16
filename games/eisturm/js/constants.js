/**
 * Eisturm – Konstanten
 *
 * Icy-Tower-Mechanik: schmale Etagen erklimmen, Anlauftempo UND
 * Haltedauer bestimmen die Sprunghöhe, Wandabprall gibt Schwung zurück,
 * mehrere Etagen in einem Sprung geben Combo-Punkte. Der Bildschirm
 * wandert von selbst nach oben und wird schneller – wer stehen bleibt,
 * fällt unten raus.
 *
 * Steuerung in zwei wählbaren Modi (siehe settings.js):
 *   - Neigung (Standard): links/rechts neigen -> laufen, je stärker
 *     geneigt desto schneller (siehe TILT_STEER_MAX_DEG). Antippen ->
 *     springen, länger gedrückt halten -> höher springen.
 *   - Halten: Bildschirmhälfte halten -> laufen. Handy Richtung Gesicht
 *     kippen -> springen (immer voller Sprung, kein Halten möglich).
 *
 * Die TILT_*-Werte sind Platzhalter, die ich ohne echtes Gerät nicht
 * kalibrieren konnte (kein Gyroskop im Testcontainer verfügbar) – mit
 * `?debug` in der URL zeigt input.js die aktuellen Neigungs-Deltas live
 * an, damit sich die Werte auf dem Handy schnell nachjustieren lassen.
 */
(function (global) {
  'use strict';

  var ET = global.ET = global.ET || {};

  // Namespace für den geteilten Highscore-Storage (shared/storage.js).
  ET.GAME_ID = 'eisturm';

  var constants = {
    CANVAS_W: 340,
    CANVAS_H: 480,

    CHAR_R: 12,
    EDGE_MARGIN: 6, // Abstand zwischen Spielfeldrand und Lauf-Grenze

    // Laufen (Icy-Tower-"Anlauf" -> jetzt stufenlos per Neigung/Zone statt
    // Tastatur-Timing). RUN_ACCEL sorgt für spürbaren Schwung-Aufbau statt
    // Sofort-Vollgas, wie beim Anlaufen im Original; RUN_ACCEL_TURN greift
    // beim Gegenlenken, damit Richtungswechsel trotzdem knackig bleiben.
    MAX_RUN_SPEED: 3.8, // px/frame bei voller Neigung/Zone
    RUN_ACCEL: 0.38, // px/frame² Richtung Zielgeschwindigkeit
    RUN_ACCEL_TURN: 0.75, // beim Lenken gegen die aktuelle Laufrichtung

    // Sprungphysik. Höhe ergibt sich aus Lauftempo (Anlauf) UND Haltedauer:
    // beim Loslassen wird ein noch steigender Sprung gekappt (JUMP_CUT_*),
    // kurzes Antippen springt also niedriger als langes Halten.
    GRAVITY: 0.24,
    JUMP_VY_BASE: -8.4, // Sprung im Stand (kein Schwung), voll gehalten
    JUMP_VY_BONUS: -5.6, // zusätzlich bei voller Laufgeschwindigkeit
    JUMP_CUT_FACTOR: 0.5, // beim Loslassen: Rest-Steiggeschwindigkeit * dieser Faktor
    JUMP_VY_MIN: -5.0, // Untergrenze nach dem Kappen: ein Tipp reicht immer für ~50px

    // Wandabprall: prallt mit einem Großteil des Schwungs zurück und
    // ignoriert dabei kurz die Steuerung, sonst würde die gehaltene
    // Richtung die Figur sofort wieder in die Wand ziehen ("klebt").
    WALL_BOUNCE: 0.92,
    WALL_BOUNCE_MIN_SPEED: 1.0, // darunter einfach stoppen statt abprallen
    WALL_LOCK_MS: 190,

    // Etagen: schmale Plattform (nicht die volle Breite), von unten immer
    // durchspringbar (wie bei Doodle Jump). Steht man beim Fallen über
    // ihr, landet man; sonst fällt man weiter zur nächsten Etage darunter
    // – siehe game.js handleFloorCrossing/onPlank.
    FLOOR_SPACING: 82,
    FLOOR_SPACING_JITTER: 14,
    FLOOR_THICK: 6,
    PLANK_WIDTH_START: 150,
    PLANK_WIDTH_TARGET: 66, // > 2*CHAR_R + Puffer, sonst kaum noch zu treffen
    PLANK_RAMP_START_FLOOR: 8,
    PLANK_RAMP_FLOORS: 70, // über so viele Etagen von START auf TARGET
    FLOOR_MARK_EVERY: 10, // jede zehnte Etage wird hervorgehoben (wie im Original)

    // Kamera: folgt nach oben mit – UND wandert nach einer Schonfrist von
    // selbst weiter nach oben, immer schneller. Das ist der eigentliche
    // Zeitdruck: stehen bleiben heißt irgendwann unten rausfallen.
    CAMERA_FOLLOW_RATIO: 0.55, // Ziel-Bildhöhe der Figur (von oben)
    // Weich nachziehen statt hart mitziehen: ein Riesensprung reißt die
    // Kamera sonst so weit hoch, dass man nach der Landung fast unten
    // am Bildrand klebt.
    CAMERA_FOLLOW_LERP: 0.14,
    CAMERA_MAX_TOP: 70, // näher als das darf die Figur der Oberkante nie kommen
    SCROLL_START_FLOOR: 3, // ab dieser erreichten Etage beginnt das Hochwandern
    SCROLL_START_MS: 6000, // ... spätestens aber nach dieser Zeit, damit Trödeln unten nicht ewig geht
    SCROLL_SPEED_START: 0.55, // px/frame (~33 px/s: Stehenbleiben kostet nach ~10s die Runde)
    SCROLL_SPEED_MAX: 2.6,
    SCROLL_RAMP_FLOORS: 100, // über so viele Etagen von START auf MAX
    FALL_MARGIN: 130, // so weit unter dem Bildausschnitt ist die Runde vorbei
    PRUNE_MARGIN: 200,

    START_Y_FROM_BOTTOM: 60,

    // Combo (Icy-Tower-Herzstück): Etagen, die in EINEM Sprung übersprungen
    // werden, zählen in eine laufende Serie. Solange innerhalb des Zeit-
    // fensters nachgelegt wird, läuft die Serie weiter und der Multiplikator
    // steigt.
    COMBO_MIN_FLOORS: 2, // ab so vielen Etagen pro Sprung zählt es als Combo
    COMBO_WINDOW_MS: 2800,
    COMBO_POINTS_PER_FLOOR: 10,
    COMBO_FLOORS_PER_MULT: 5, // je so viele Serien-Etagen +1 Multiplikator

    POINTS_PER_FLOOR: 10, // Grundpunkte je erreichter Etage

    // Steuerung: Neigung. Kleiner Winkel = sensibler (weniger kippen für
    // volles Tempo); die Zwischenwerte bleiben stufenlos für feines Dosieren.
    TILT_STEER_MAX_DEG: 13, // Neigungswinkel für volles Lauftempo
    // Vorzeichen/Schwelle fürs Sprung-Kippen (Richtung Gesicht). Muss
    // evtl. auf dem echten Handy angepasst werden (TILT_JUMP_SIGN auf
    // -1 drehen, falls der Sprung in die falsche Richtung auslöst).
    TILT_JUMP_SIGN: 1,
    TILT_JUMP_TRIGGER_DEG: 16,
    TILT_JUMP_REARM_DEG: 6,

    // Juice. squash > 0 = breiter/flacher (Landung), < 0 = schmaler/höher
    // (Wandabprall); skaliert wird um den Fußpunkt, siehe game.js drawChar.
    SQUASH_DECAY: 0.09,
    SQUASH_LAND: 0.7,
    SQUASH_WALL: -0.55,
    DUST_PARTICLE_COUNT: 7,
  };

  // Lineare Annäherung von start -> target über [rampStart, rampStart+range],
  // danach konstant beim Zielwert.
  constants.rampValue = function (value, start, target, rampStart, range) {
    if (value <= rampStart) return start;
    var t = Math.min(1, (value - rampStart) / range);
    return start + t * (target - start);
  };

  constants.plankWidthAt = function (floorNumber) {
    return constants.rampValue(
      floorNumber,
      constants.PLANK_WIDTH_START,
      constants.PLANK_WIDTH_TARGET,
      constants.PLANK_RAMP_START_FLOOR,
      constants.PLANK_RAMP_FLOORS
    );
  };

  constants.scrollSpeedAt = function (floorNumber) {
    return constants.rampValue(
      floorNumber,
      constants.SCROLL_SPEED_START,
      constants.SCROLL_SPEED_MAX,
      constants.SCROLL_START_FLOOR,
      constants.SCROLL_RAMP_FLOORS
    );
  };

  // Combo-Stufen wie im Original: je mehr Etagen in einem Sprung, desto
  // dicker die Meldung.
  constants.COMBO_LABELS = [
    { floors: 2, text: 'Gut!', color: '#bfe9ff', size: 16 },
    { floors: 3, text: 'Stark!', color: '#8ee9ff', size: 18 },
    { floors: 4, text: 'Super!', color: '#5ee6ff', size: 20 },
    { floors: 5, text: 'Klasse!', color: '#7dffb5', size: 22 },
    { floors: 6, text: 'Wahnsinn!', color: '#ffd15c', size: 24 },
    { floors: 7, text: 'Hammer!', color: '#ffb03a', size: 26 },
    { floors: 8, text: 'Irre!', color: '#ff8a4c', size: 28 },
    { floors: 10, text: 'Extrem!', color: '#ff6b81', size: 30 },
    { floors: 13, text: 'UNFASSBAR!', color: '#ff4fd8', size: 32 },
  ];

  constants.comboLabelFor = function (floorsInJump) {
    var chosen = constants.COMBO_LABELS[0];
    for (var i = 0; i < constants.COMBO_LABELS.length; i++) {
      if (floorsInJump >= constants.COMBO_LABELS[i].floors) chosen = constants.COMBO_LABELS[i];
    }
    return chosen;
  };

  ET.constants = constants;
})(window);
