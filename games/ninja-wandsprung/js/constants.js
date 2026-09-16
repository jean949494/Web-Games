/**
 * Ninja Wandsprung – Konstanten
 *
 * Alle Werte stammen 1:1 aus der Spielspezifikation (Prototyp-Phase,
 * Chat/Visualizer, durch Testspielen gefunden). Nicht ohne erneutes
 * Playtesting verändern – siehe Spec-Dokument, Abschnitt "Physik".
 */
(function (global) {
  'use strict';

  var NW = global.NW = global.NW || {};

  // Namespace für den geteilten Highscore-Storage (shared/storage.js) –
  // hält den Ninja-Highscore getrennt von anderen Spielen im selben Storage.
  NW.GAME_ID = 'ninja-wandsprung';

  var constants = {
    // Feld
    CANVAS_W: 340,
    CANVAS_H: 480,
    WALL_W: 50,
    NINJA_R: 11,

    // Physik (Basiswerte)
    GRAVITY: 0.2,
    WALL_SLIDE_SPEED: 1.3,
    JUMP_VX_BASE: 8,

    // Ladung
    CHARGE_MAX_MS: 2000,
    CHARGE_STEP_MS: 400,
    TIER_COUNT: 5,

    // Fünf Sprungstufen (Tier 0-4)
    TIER_JY: [-9.8, -13.3, -16.8, -21, -26.6],
    TIER_GM: [1.0, 1.0, 0.85, 0.6, 0.35],

    // Stacheln
    SPIKE_GAP_BASE: 420,
    SPIKE_GAP_RAND: 140,
    SPIKE_PROTRUSION_MIN: 16,
    SPIKE_PROTRUSION_MAX: 24,
    SPIKE_HIT_RADIUS_FACTOR: 0.45, // großzügige Hitbox: nur 45% des Ninja-Radius
    SPIKE_BASE_HALF: 3, // Kollisionsradius an der Stachelspitze (klein, damit unter KNAPP_DISTANCE_PX
                         // noch ein spürbares Zeitfenster für "Knapp!" statt Tod bleibt)
    KNAPP_DISTANCE_PX: 10,

    // Schwierigkeitskurve
    LEVEL_RAMP_START_HEIGHT: 6000, // Kamera-Höhe, ab der lvl zu steigen beginnt
    LEVEL_RAMP_RANGE: 6000, // px, über die lvl von 1 -> Cap ansteigt (Platzhalter, noch nicht für eine volle Runde getestet)
    LEVEL_CAP: 1.18,

    // Juice
    SQUASH_DECAY: 0.08, // pro Frame
    SQUASH_INITIAL: 1.0,
    DUST_PARTICLE_COUNT: 8,

    // Kamera
    CAMERA_FOLLOW_RATIO: 0.6, // Ninja bleibt bei 60% der Screen-Höhe von oben

    // Tod: Abstand unterhalb der Kamera, ab dem der Ninja als gefallen gilt
    FALL_MARGIN: 140,
  };

  constants.tierForChargeMs = function (ms) {
    var t = Math.floor(ms / constants.CHARGE_STEP_MS);
    if (t < 0) t = 0;
    if (t > constants.TIER_COUNT - 1) t = constants.TIER_COUNT - 1;
    return t;
  };

  constants.jumpVXForTier = function (tier) {
    return constants.JUMP_VX_BASE * (0.85 + tier * 0.1);
  };

  NW.constants = constants;
})(window);
