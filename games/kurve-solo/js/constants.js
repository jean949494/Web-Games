/**
 * Kurve Solo – Konstanten (Endlos-Modus)
 *
 * Kernphysik 1:1 aus der urspruenglichen Spielspezifikation (Prototyp-
 * Phase, Chat/Visualizer, durch Testspielen gefunden): SPEED, TURN,
 * THICK, HIT_FACTOR_SQ, GAP_CHANCE, GAP_LENGTH_FRAMES,
 * SELF_IGNORE_RECENT_POINTS. Nicht ohne erneutes Playtesting veraendern.
 *
 * Alles rund um Endlos-Steigerung (Feldbreite, Hindernisse) ist eine
 * spaetere Erweiterung auf Wunsch (siehe README.md, "Umgesetzt") und
 * war in keiner Spec beziffert – Platzhalterwerte, mit `npm run dev`
 * gegenspielen und anpassen.
 */
(function (global) {
  'use strict';

  var KS = global.KS = global.KS || {};

  // Namespace für den geteilten Highscore-Storage (shared/storage.js).
  KS.GAME_ID = 'kurve-solo';

  var constants = {
    CANVAS_W: 340,
    CANVAS_H: 480,

    // Kernphysik (1:1 aus der Spec)
    SPEED: 1.7, // px/frame
    TURN: 0.05, // rad/frame bei gehaltener Richtung
    THICK: 3, // px Linienstärke
    HIT_FACTOR_SQ: 2.2, // Kollisionsradius²  =  HIT_FACTOR_SQ * THICK²

    // Zufällige Lücken (Kernfairness-Mechanik aus dem Original)
    GAP_CHANCE: 0.006,
    GAP_LENGTH_FRAMES: 12,
    SELF_IGNORE_RECENT_POINTS: 10,

    // Kamera: folgt nur nach oben, wie bei Ninja Wandsprung.
    CAMERA_FOLLOW_RATIO: 0.6,
    // Sicherheitsnetz: wer absichtlich rückwärts/abwärts lenkt, stirbt
    // irgendwann statt endlos unterhalb der Kamera zu trödeln.
    FALL_MARGIN: 140,
    // Wie weit unterhalb der Kamera alte Linienpunkte/Hindernisse
    // gelöscht werden (Speicher & Kollisionscheck bleiben bei einer
    // echten Endlos-Session begrenzt).
    PRUNE_MARGIN: 200,

    START_Y_FROM_BOTTOM: 90,

    // Das Spielfeld wird mit der Höhe schmaler ("es wird immer enger").
    FIELD_WIDTH_START: 328, // = CANVAS_W - 2*6, wie der alte FIELD_MARGIN
    FIELD_WIDTH_MIN: 170,
    WIDTH_RAMP_START_HEIGHT: 600, // Gnadenfrist, bevor es losgeht
    WIDTH_RAMP_RANGE: 7000,

    // Hindernisse: waagerechte Balken mit einer Lücke (quer zur
    // Bewegungsrichtung), durch die man lenken muss. Lücke wird mit der
    // Höhe schmaler, der Abstand knapper und die Position springt
    // stärker hin und her ("verzwickter").
    OBSTACLE_THICK: 10,
    OBSTACLE_FIRST_CLEARANCE: 320, // grosszügiger Abstand bis zum ersten Hindernis
    OBSTACLE_GAP_START: 130,
    OBSTACLE_GAP_MIN: 74,
    OBSTACLE_SPACING_START: 175,
    OBSTACLE_SPACING_MIN: 130,
    OBSTACLE_JITTER_START: 35, // max. Sprung der Lücken-Mitte zur vorigen (px)
    OBSTACLE_JITTER_MAX: 95,
    OBSTACLE_RAMP_START_HEIGHT: 600,
    OBSTACLE_RAMP_RANGE: 7000,

    PLAYER_COLOR: '#5ee6ff',
    OBSTACLE_COLOR: '#f2a154',
    WALL_COLOR: '#3a4a63',

    DEATH_PARTICLE_COUNT: 16,
    SHAKE_FRAMES: 14,
    SHAKE_MAGNITUDE: 4,
  };

  // t=0 bis Höhe startHeight, dann linear auf 1 über range, danach gedeckelt.
  constants.rampT = function (h, startHeight, range) {
    if (h <= startHeight) return 0;
    return Math.min(1, (h - startHeight) / range);
  };

  constants.lerp = function (a, b, t) {
    return a + (b - a) * t;
  };

  constants.fieldHalfWidthAt = function (h) {
    var t = constants.rampT(h, constants.WIDTH_RAMP_START_HEIGHT, constants.WIDTH_RAMP_RANGE);
    return constants.lerp(constants.FIELD_WIDTH_START, constants.FIELD_WIDTH_MIN, t) / 2;
  };

  KS.constants = constants;
})(window);
