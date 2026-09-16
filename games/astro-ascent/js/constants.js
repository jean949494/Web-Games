/**
 * Astro Ascent – Konstanten
 *
 * Abgeleitet aus Ninja Wandsprung (gleiche Grundmechanik: Wandrutsch,
 * Ladesprung), aber bewusst eigenständig abgestimmt, nicht nur reskinnt:
 *
 * 1) "Schwerelos" – Basis-Schwerkraft gesenkt, Gravitations-Multiplikator
 *    pro Stufe niedriger als beim Ninja, PLUS ein zusätzlicher
 *    "Apex-Float": nahe des Scheitelpunkts (vy ~ 0) wirkt kurz noch
 *    weniger Schwerkraft -> spürbarer Moment des freien Fliegens bei
 *    hoher Ladestufe, nicht nur ein höherer Sprung.
 * 2) Laser-Geschütze als zweiter Hindernis-Typ neben Stacheln: fester
 *    Rhythmus (sicher -> Warnung -> Feuer), erfordert Anschleichen und
 *    Timing statt nur Ausweichen.
 */
(function (global) {
  'use strict';

  var NW = global.NW = global.NW || {};

  var constants = {
    // Feld
    CANVAS_W: 340,
    CANVAS_H: 480,
    WALL_W: 50,
    NINJA_R: 11, // Kollisionsradius des Astronauten (Name aus dem geteilten Grundgerüst beibehalten)

    // Physik (Basiswerte) – niedriger als Ninja Wandsprung für das Zero-G-Gefühl
    GRAVITY: 0.16,
    WALL_SLIDE_SPEED: 1.3,
    JUMP_VX_BASE: 8,

    // Ladung
    CHARGE_MAX_MS: 2000,
    CHARGE_STEP_MS: 400,
    TIER_COUNT: 5,

    // Fünf Sprungstufen (Tier 0-4) – gleiche vertikale Startgeschwindigkeit
    // wie beim Ninja (bewährter Wert), aber floatigere Gravitation pro Stufe
    TIER_JY: [-9.8, -13.3, -16.8, -21, -26.6],
    TIER_GM: [0.9, 0.8, 0.6, 0.4, 0.2],

    // Apex-Float: zusätzliche Schwerelosigkeit nahe des Scheitelpunkts
    // (|vy| unter diesem Wert), simuliert ein kurzes "Dahinfliegen"
    APEX_FLOAT_VY_THRESHOLD: 1.4,
    APEX_FLOAT_GRAVITY_MULT: 0.3,

    // Stacheln -> Asteroidenbrocken (gleiche Kollisionsgeometrie wie beim Ninja)
    SPIKE_GAP_BASE: 420,
    SPIKE_GAP_RAND: 140,
    SPIKE_PROTRUSION_MIN: 16,
    SPIKE_PROTRUSION_MAX: 24,
    SPIKE_HIT_RADIUS_FACTOR: 0.45, // großzügige Hitbox
    SPIKE_BASE_HALF: 3,
    KNAPP_DISTANCE_PX: 10,

    // Laser-Geschütze: fester Zyklus sicher/Warnung/Feuer, Phase pro Gate
    // zufällig versetzt (nicht synchron), Timing wird mit lvl etwas enger.
    LASER_GATE_START_HEIGHT: 700, // erst ab dieser Höhe, damit der Einstieg einfach bleibt
    LASER_GATE_CHANCE: 0.35, // Anteil der Hindernis-Slots, die ein Gate statt eines Brockens sind
    LASER_IDLE_MS: 1300, // sicheres Zeitfenster zum Durchqueren
    LASER_WARNING_MS: 450, // Aufladen, noch ungefährlich, aber sichtbar
    LASER_FIRING_MS: 850, // Strahl aktiv, tödlich
    LASER_BEAM_HALF_THICKNESS: 5,
    LASER_HIT_RADIUS_FACTOR: 0.45,

    // Schwierigkeitskurve
    LEVEL_RAMP_START_HEIGHT: 6000,
    LEVEL_RAMP_RANGE: 6000, // Platzhalter, noch nicht über eine volle Runde getestet
    LEVEL_CAP: 1.18,

    // Juice
    SQUASH_DECAY: 0.08,
    SQUASH_INITIAL: 1.0,
    DUST_PARTICLE_COUNT: 8,

    // Kamera
    CAMERA_FOLLOW_RATIO: 0.6,

    // Tod: Abstand unterhalb der Kamera, ab dem als gefallen gilt
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
