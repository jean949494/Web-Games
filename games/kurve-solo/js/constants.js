/**
 * Kurve Solo – Konstanten
 *
 * Physik-/Bot-Werte stammen 1:1 aus der Spielspezifikation (Prototyp-
 * Phase, Chat/Visualizer, durch Testspielen gefunden) – siehe
 * `SPEED`, `TURN`, `THICK`, `HIT_FACTOR_SQ`, `GAP_CHANCE`,
 * `GAP_LENGTH_FRAMES`, `SELF_IGNORE_RECENT_POINTS`, `BOT_LOOKAHEAD`,
 * `BOT_COUNT`. Nicht ohne erneutes Playtesting verändern.
 *
 * Alle anderen Werte hier (Startaufstellung, Bot-Ausweich-/Wobble-
 * Timing, Farben, Juice) waren in der Spec nicht beziffert und sind
 * Implementierungs-Annahmen – siehe README.md, Abschnitt "Annahmen".
 */
(function (global) {
  'use strict';

  var KS = global.KS = global.KS || {};

  // Namespace für den geteilten Highscore-Storage (shared/storage.js).
  KS.GAME_ID = 'kurve-solo';

  var constants = {
    // Feld
    CANVAS_W: 340,
    CANVAS_H: 480,
    FIELD_MARGIN: 6, // Innenabstand der Spielfeldwand zur Canvas-Kante

    // Kernphysik (1:1 aus der Spec)
    SPEED: 1.7, // px/frame
    TURN: 0.05, // rad/frame bei gehaltener Richtung
    THICK: 3, // px Linienstärke
    HIT_FACTOR_SQ: 2.2, // Kollisionsradius²  =  HIT_FACTOR_SQ * THICK²  (großzügiger als die sichtbare Linie)

    // Zufällige Lücken (Kernfairness-Mechanik aus dem Original)
    GAP_CHANCE: 0.006, // Chance pro Frame auf eine neue Lücke (0.6%)
    GAP_LENGTH_FRAMES: 12,

    // Eigene Kollision erst ab dem (N+1)-letzten gezeichneten Punkt prüfen,
    // sonst crasht man sofort in die eigene gerade gezogene Linie.
    SELF_IGNORE_RECENT_POINTS: 10,

    // Bot-KI
    BOT_COUNT: 3,
    BOT_LOOKAHEAD: 26, // px Blickweite in Bewegungsrichtung
    // Annahme (Spec nennt keinen Wert): Ausweichrichtung wird beim ersten
    // Erkennen zufällig gewählt und dann kurz gehalten.
    BOT_AVOID_HOLD_FRAMES: 20,
    // Annahme: etwas großzügigere Vorwarnschwelle als die exakte
    // Kollisionsgrenze, damit Bots vor der Wand/Linie abdrehen statt sie
    // erst im letzten Frame zu berühren.
    BOT_LOOKAHEAD_FACTOR_SQ: 3.4,
    // Annahme: gelegentliche kleine Richtungsänderungen für organisches
    // Wirken (nicht nur reaktiv).
    BOT_WOBBLE_CHANCE: 0.02,
    BOT_WOBBLE_FRAMES: 10,

    // Farben (kein Original-Look – eigene, kindgerecht-freundliche Palette)
    PLAYER_COLOR: '#5ee6ff',
    BOT_COLORS: ['#ffb454', '#ff6fae', '#7ee787'],

    // Juice
    DEATH_PARTICLE_COUNT: 16,
    SHAKE_FRAMES: 14,
    SHAKE_MAGNITUDE: 4, // px
  };

  // Startaufstellung: "Windmühle" an den 4 Feldecken, jeder startet
  // tangential im Uhrzeigersinn statt frontal aufeinander zu. Eine
  // naheliegendere Kompass-Aufstellung (Spieler unten/Bot oben usw.)
  // schickt gegenüberliegende Spieler exakt frontal aufeinander zu – das
  // führt garantiert zu einem sehr frühen Kopf-an-Kopf-Crash, egal wie
  // gut gelenkt wird. Die Windmühle vermeidet das.
  constants.START_LAYOUT = function () {
    var w = constants.CANVAS_W, h = constants.CANVAS_H;
    var inset = 80;
    return [
      { x: inset, y: h - inset, angle: -Math.PI / 2 },     // Spieler (unten links): nach oben
      { x: inset, y: inset, angle: 0 },                     // Bot A (oben links): nach rechts
      { x: w - inset, y: inset, angle: Math.PI / 2 },       // Bot B (oben rechts): nach unten
      { x: w - inset, y: h - inset, angle: Math.PI },       // Bot C (unten rechts): nach links
    ];
  };

  KS.constants = constants;
})(window);
