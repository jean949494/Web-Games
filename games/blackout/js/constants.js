/**
 * Blackout – Konstanten.
 *
 * Die Physik ist ein EXAKTER PORT der N++-Bewegungsphysik (Metanet Software).
 * Die Werte stammen nicht aus eigenem Tuning, sondern aus dem öffentlich
 * reverse-engineerten Simulator "nclone" (nsim.py, Klasse Ninja), der von
 * mehreren unabhängigen Projekten Frame für Frame gegen das Original
 * verifiziert wurde. Nicht "verbessern" – jedes Nachjustieren an diesen
 * Zahlen entfernt uns vom Originalgefühl.
 *
 * Einheiten: Pixel und Pixel/Frame bei fester Tickrate von 60 Hz.
 * (Das originale N von 2004 lief mit 40 Hz; N+/N++ rechneten alle Werte
 * um: Dämpfungen ^(2/3), Geschwindigkeiten *2/3, Beschleunigungen *4/9.)
 */
(function (global) {
  'use strict';

  var BO = global.BO = global.BO || {};

  BO.GAME_ID = 'blackout';

  var C = {
    // ---- Welt-Raster ----
    TILE: 24, // Kachelgröße wie im Original
    ROOM_W: 26, // Kacheln pro Raum (ein Raum = ein Bildschirm, kein Scrollen)
    ROOM_H: 15,
    CANVAS_W: 640, // 16:9, Poki-Referenzauflösung
    CANVAS_H: 360,

    // ---- Ninja-Physik (N++ Originalwerte, 60 Hz) ----
    RADIUS: 10,
    GRAVITY_FALL: 0.06666666666666665,
    GRAVITY_JUMP: 0.01111111111111111, // exakt GRAVITY_FALL / 6 -> variable Sprunghöhe
    GROUND_ACCEL: 0.06666666666666665,
    AIR_ACCEL: 0.04444444444444444, // exakt 2/3 der Bodenbeschleunigung
    DRAG_REGULAR: 0.9933221725495059, // 0.99^(2/3)
    DRAG_SLOW: 0.8617738760127536, // 0.80^(2/3)
    FRICTION_GROUND: 0.9459290248857720, // 0.92^(2/3)
    FRICTION_GROUND_SLOW: 0.8617738760127536,
    FRICTION_WALL: 0.9113380468927672, // 0.87^(2/3)
    MAX_HOR_SPEED: 3.333333333333333,
    MAX_JUMP_DURATION: 45, // Frames, in denen Halten die Schwerkraft dämpft (0.75 s)
    MIN_SURVIVABLE_CRUSHING: 0.05,

    // Aufprall-Tod: stirb, wenn impact_vel > IMPACT_LIMIT - 4/3 * |Bodennormale_y|.
    // Original ist 6 (auf flachem Boden also 4.667 px/Frame = Sturz aus ~10 Kacheln).
    // Für das Poki-Publikum ist die Voreinstellung milder; im Menü umschaltbar,
    // damit sich beides direkt vergleichen lässt.
    // Original 6 -> tödlich ab ca. 10.2 Kacheln Sturzhöhe.
    // Mild 7.5 -> tödlich erst ab ca. 14 Kacheln, also praktisch nur bei einem
    // Sturz über die volle Raumhöhe. Die Mechanik bleibt spürbar, beißt aber
    // selten. Im Menü umschaltbar.
    IMPACT_LIMIT_ORIGINAL: 6,
    IMPACT_LIMIT_MILD: 7.5,

    // Puffer-Fenster in Frames (Nachsicht für den Spieler, alle aus dem Original)
    BUF_FLOOR: 5, // Coyote Time: nach Verlassen des Bodens noch springbar
    BUF_JUMP: 5, // Sprungtaste zu früh gedrückt wird gemerkt
    BUF_WALL: 5, // nach Verlassen der Wand noch Wandsprung möglich
    BUF_LAUNCHPAD: 3,

    // Ninja-Zustände (Nummern wie im Original, damit der Port vergleichbar bleibt)
    ST_IMMOBILE: 0,
    ST_RUNNING: 1,
    ST_GROUND_SLIDING: 2,
    ST_JUMPING: 3,
    ST_FALLING: 4,
    ST_WALL_SLIDING: 5,
    ST_DEAD: 6,

    // ---- Simulation ----
    STEP_MS: 1000 / 60,
    MAX_STEPS_PER_FRAME: 8,
    COLLISION_PASSES: 4, // Original: 4 Durchläufe pro Frame
    DEPEN_ITERATIONS: 32, // je Durchlauf bis zu 32 Entpenetrationsschritte

    // ---- Kacheltypen ----
    T_EMPTY: 0,
    T_SOLID: 1,
    // 45-Grad-Schrägen. Die Ziffer benennt die Ecke, in der die Masse sitzt.
    T_SLOPE_BL: 2, // massiv unten links
    T_SLOPE_BR: 3, // massiv unten rechts
    T_SLOPE_TL: 4, // massiv oben links
    T_SLOPE_TR: 5, // massiv oben rechts
  };

  // Abgeleitete Werte, die öfter gebraucht werden
  C.ROOM_PX_W = C.ROOM_W * C.TILE;
  C.ROOM_PX_H = C.ROOM_H * C.TILE;
  C.ROOM_OFF_X = Math.floor((C.CANVAS_W - C.ROOM_PX_W) / 2);
  C.ROOM_OFF_Y = Math.floor((C.CANVAS_H - C.ROOM_PX_H) / 2);

  BO.constants = C;
})(typeof window !== 'undefined' ? window : globalThis);
