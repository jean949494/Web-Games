/**
 * Eisturm – Konstanten
 *
 * Icy-Tower-Mechanik (Etagen mit Lücke, Anlauftempo bestimmt Sprunghöhe/
 * -weite, "Combo" fürs Überspringen mehrerer Etagen in einem Sprung),
 * aber mit neuer Steuerung statt Tastatur:
 *
 *   - Handy links/rechts neigen  -> laufen (je stärker geneigt, desto
 *     schneller; siehe TILT_STEER_MAX_DEG)
 *   - Kurz antippen              -> springen
 *   - Alternative zum Testen: linke/rechte Bildschirmhälfte HALTEN
 *     lässt links/rechts laufen (wie bei Kurve Solo), Handy Richtung
 *     Gesicht kippen löst zusätzlich auch einen Sprung aus. Beide
 *     Systeme laufen gleichzeitig, ohne sich zu stören (siehe input.js).
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
    // Sofort-Vollgas, wie beim Anlaufen im Original.
    MAX_RUN_SPEED: 3.6, // px/frame bei voller Neigung/Zone
    RUN_ACCEL: 0.22, // px/frame² Richtung Zielgeschwindigkeit

    // Sprungphysik
    GRAVITY: 0.24,
    JUMP_VY_BASE: -8.2, // Sprung im Stand (kein Schwung)
    JUMP_VY_BONUS: -5.4, // zusätzlich bei voller Laufgeschwindigkeit -> höher/weiter, wie im Original

    // Etagen: waagerechte Linie mit einer Lücke. Nicht in der Lücke
    // ausgerichtet beim Kreuzen = Landung (von oben) oder "Anstoßen"
    // (von unten, Sprung endet abrupt) – siehe game.js handleFloorCrossing.
    FLOOR_SPACING: 82,
    FLOOR_SPACING_JITTER: 14,
    FLOOR_THICK: 6,
    GAP_WIDTH_START: 150,
    GAP_WIDTH_TARGET: 66, // > 2*CHAR_R + Puffer, sonst unmöglich zu treffen
    GAP_RAMP_START_HEIGHT: 700,
    GAP_RAMP_RANGE: 5500,

    // Kamera: folgt nur nach oben, wie bei Ninja Wandsprung / Kurve Solo.
    CAMERA_FOLLOW_RATIO: 0.6,
    FALL_MARGIN: 140,
    PRUNE_MARGIN: 200,

    START_Y_FROM_BOTTOM: 60,

    // Combo-Bonus fürs Überspringen mehrerer Etagen in einem Sprung.
    COMBO_MIN_FOR_BONUS: 2,
    COMBO_BONUS_PER_FLOOR: 8,

    // Steuerung: Neigung
    TILT_STEER_MAX_DEG: 22, // Neigungswinkel für volles Lauftempo
    // Vorzeichen/Schwelle fürs Sprung-Kippen (Richtung Gesicht). Muss
    // evtl. auf dem echten Handy angepasst werden (TILT_JUMP_SIGN auf
    // -1 drehen, falls der Sprung in die falsche Richtung auslöst).
    TILT_JUMP_SIGN: 1,
    TILT_JUMP_TRIGGER_DEG: 16,
    TILT_JUMP_REARM_DEG: 6,

    // Steuerung: Tippen
    TAP_MAX_MS: 220,
    TAP_MOVE_THRESHOLD_PX: 12, // Client-Pixel, bevor aus "Tippen" ein "Halten/Ziehen" wird

    // Juice
    SQUASH_DECAY: 0.09,
    SQUASH_LAND: 0.8,
    SQUASH_BONK: -0.6,
    DUST_PARTICLE_COUNT: 7,
  };

  // Lineare Annäherung von start -> target über [rampStart, rampStart+range]
  // Höhe, danach konstant beim Zielwert (wie computeLvl in Ninja Wandsprung).
  constants.rampValue = function (heightClimbed, start, target, rampStart, range) {
    if (heightClimbed <= rampStart) return start;
    var t = Math.min(1, (heightClimbed - rampStart) / range);
    return start + t * (target - start);
  };

  constants.gapWidthAt = function (heightClimbed) {
    return constants.rampValue(
      heightClimbed,
      constants.GAP_WIDTH_START,
      constants.GAP_WIDTH_TARGET,
      constants.GAP_RAMP_START_HEIGHT,
      constants.GAP_RAMP_RANGE
    );
  };

  ET.constants = constants;
})(window);
