/**
 * Team-Duell mit Mauer – Konstanten.
 *
 * Werte 1:1 aus der Spielspezifikation (Prototyp-Phase, Chat/Visualizer)
 * sind unten als "Spec" markiert – nicht ohne erneutes Playtesting
 * verändern: `TEAM_HP_MAX`, `WALL_SEGMENTS`, `WALL_SEGMENT_HP`,
 * `WALL_HIT_DAMAGE`, `WALL_THICKNESS`, `SHOT_DAMAGE_TO_ENEMY`,
 * `SHOT_DAMAGE_TO_PLAYER`, `THROW_HIT_DAMAGE`, `PLAYER_SPEED`,
 * `BULLET_SPEED`, die drei `STICK_RADIUS_*`-Werte.
 *
 * Alle anderen Werte (Zonen-Grenzen, KI-Timing, Wurf-Reichweite,
 * Trefferradien, Farben) waren in der Spec nicht beziffert und sind
 * Implementierungs-Annahmen – siehe README.md, Abschnitt "Annahmen".
 * Insbesondere Schuss- vs. Wurf-Schaden-Balance ist laut Spec selbst
 * "noch nicht gegeneinander getestet".
 */
(function (global) {
  'use strict';

  var TD = global.TD = global.TD || {};

  // Namespace für den geteilten Highscore-Storage (shared/storage.js).
  TD.GAME_ID = 'team-duell';

  var C = {
    // Feld (Spec: Canvas-Referenz 340x480)
    CANVAS_W: 340,
    CANVAS_H: 480,
    FIELD_MARGIN: 6,

    TEAM_SIZE: 3, // 3 gegen 3 (Spec)
    UNIT_RADIUS: 10,

    // ---------- Mauer (Spec) ----------
    WALL_SEGMENTS: 8,
    WALL_SEGMENT_HP: 60,
    WALL_HIT_DAMAGE: 15, // ~4 Treffer pro Segment bis zur Lücke
    WALL_THICKNESS: 8, // Spec: bewusst 30% kleiner als der ursprüngliche Entwurf (12 -> 8)
    // Annahme: Kollisionsband beidseitig etwas großzügiger als die reine
    // Dicke, damit die Mauer bei BULLET_SPEED=3.2px/frame nicht
    // "durchtunnelt" werden kann (Band > ein Frame Wegstrecke).
    WALL_BAND_HALF: 7,

    // Y-Position der Mauern (Mittellinie). Annahme: nicht in der Spec
    // beziffert, symmetrisch zur Feldmitte gewählt.
    ENEMY_WALL_Y: 140,
    PLAYER_WALL_Y: 480 - 140, // = 340, spiegelbildlich zur Gegner-Mauer

    // ---------- Team-HP (Spec, "bewusste Vereinfachung": EIN Pool statt
    // 6 einzeln verfolgter Einheiten, siehe Spec-Abschnitt dazu) ----------
    TEAM_HP_MAX: 140,

    // ---------- Schaden (Spec, bewusst asymmetrisch – ein gegnerischer
    // Schuss trifft das Spieler-Team härter als der Schuss des
    // Spieler-Teams die Gegner; siehe README "Annahmen") ----------
    SHOT_DAMAGE_TO_ENEMY: 8, // Schuss von Spieler-Team trifft Gegner-Einheit
    SHOT_DAMAGE_TO_PLAYER: 10, // gegnerischer Schuss trifft Spieler-Team
    THROW_HIT_DAMAGE: 22, // Wurf-Treffer, für beide Seiten gleich (Spec nennt nur einen Wert)
    // Annahme: "nah genug am Ziel" aus der Spec als konkreter Trefferradius.
    THROW_HIT_RADIUS: 24,

    // ---------- Bewegung / Projektile (Spec) ----------
    PLAYER_SPEED: 2.6, // px/frame bei voller Stick-Auslenkung
    BULLET_SPEED: 3.2, // px/frame
    BULLET_RADIUS: 3,
    // Trefferradius Schuss-auf-Einheit: Annahme, großzügiger als die
    // sichtbare Punktgröße, damit sich Treffer auf einem kleinen
    // Touch-Bildschirm fair anfühlen.
    BULLET_HIT_RADIUS: 13,

    // Annahme: Teammates gleich schnell wie der Spieler (keine eigene
    // Spec-Zahl); Gegner etwas langsamer, damit ein 3-gegen-3-Duell nicht
    // durch reine Ausweich-Geschwindigkeit entschieden wird.
    TEAMMATE_SPEED: 2.6,
    ENEMY_SPEED: 2.3,

    // ---------- Sticks (Spec: Radien 1:1 übernommen; Totzone/Feinschliff
    // laut Spec selbst "noch nicht final" – siehe README) ----------
    STICK_RADIUS_MOVE: 42, // Basis-Radius (Durchmesser ~84px)
    STICK_RADIUS_SHOOT: 29, // Durchmesser ~58px
    STICK_RADIUS_THROW: 29, // Durchmesser ~58px
    STICK_DEADZONE: 0.16, // Annahme: Anteil des Radius ohne Wirkung

    // Feuerintervall solange der Schuss-Stick ausgelenkt ist (Spec fordert
    // "automatisches Feuer in Intervallen", nennt aber keinen Wert).
    PLAYER_FIRE_INTERVAL_MS: 260,

    // Wurf: "relativer Stick, Auslenkung bestimmt Zielpunkt" (Spec) – volle
    // Auslenkung entspricht dieser Reichweite in Welt-Pixeln ab der
    // eigenen Position. Annahme, deckt das gegnerische Feld von den
    // meisten Spielerpositionen aus ab.
    THROW_RANGE: 280,
    // Fluggeschwindigkeit des Lob-Wurfs (Annahme) -> Flugzeit = Distanz/Speed,
    // genug Vorhaltezeit für bewegliche Ziele ohne zäh zu wirken.
    THROW_FLIGHT_SPEED: 3.6,
    THROW_COOLDOWN_MS: 900, // Annahme: minimaler Abstand zwischen eigenen Würfen

    // ---------- KI-Timing (Annahmen, Spec nennt keine Werte) ----------
    AI_FIRE_INTERVAL_MIN_MS: 700,
    AI_FIRE_INTERVAL_MAX_MS: 1400,
    AI_THROW_INTERVAL_MIN_MS: 2600,
    AI_THROW_INTERVAL_MAX_MS: 4600,
    // Ungenauigkeit der KI-Schüsse (Radius in px um das anvisierte Ziel),
    // damit die Gegner nicht unmenschlich präzise wirken.
    AI_AIM_SPREAD: 10,

    // ---------- Team-Kommandos (Spec: Rückzug/Angriff/Deckung) ----------
    // Zieloffsets der beiden Teammates relativ zur Spielerposition (px),
    // Annahme: konkrete Zahlen nicht in der Spec enthalten.
    COMMANDS: { RETREAT: 'retreat', ATTACK: 'attack', COVER: 'cover' },
    // Annahme: bevor der Spieler zum ersten Mal einen Kommando-Button
    // drückt, verhalten sich Teammates wie "Deckung" (naheliegendster
    // Default, siehe README).
    DEFAULT_COMMAND: 'cover',

    // ---------- Farben (kein Original-Look, kindgerechte Palette,
    // konsistent mit den anderen Spielen im Repo) ----------
    PLAYER_COLOR: '#5ee6ff',
    TEAMMATE_COLOR: '#7ee787',
    ENEMY_COLOR: '#ff6fae',
    ENEMY_ACCENT_COLOR: '#ffb454',
    WALL_PLAYER_COLOR: '#5ee6ff',
    WALL_ENEMY_COLOR: '#ff6fae',

    // Juice
    SHAKE_FRAMES: 12,
    SHAKE_MAGNITUDE: 3,
  };

  // Zonen-Grenzen: eigenes Feldareal, in dem sich Einheiten bewegen dürfen
  // (Spec: "freie 2D-Bewegung im eigenen Spielfeldbereich"). Aus
  // Mauer-Position + Dicke + Einheiten-Radius + etwas Puffer abgeleitet,
  // keine eigene Spec-Zahl.
  C.FIELD_X_MIN = C.FIELD_MARGIN + C.UNIT_RADIUS;
  C.FIELD_X_MAX = C.CANVAS_W - C.FIELD_MARGIN - C.UNIT_RADIUS;
  C.ENEMY_ZONE_Y_MIN = C.FIELD_MARGIN + C.UNIT_RADIUS;
  C.ENEMY_ZONE_Y_MAX = C.ENEMY_WALL_Y - C.WALL_THICKNESS / 2 - C.UNIT_RADIUS - 6;
  C.PLAYER_ZONE_Y_MIN = C.PLAYER_WALL_Y + C.WALL_THICKNESS / 2 + C.UNIT_RADIUS + 6;
  C.PLAYER_ZONE_Y_MAX = C.CANVAS_H - C.FIELD_MARGIN - C.UNIT_RADIUS;

  // Startaufstellung innerhalb der jeweiligen Zone (Annahme: gleichmäßig
  // verteilt über die Feldbreite).
  C.PLAYER_START_X = [110, 170, 230]; // Spieler (Mitte), Teammate A, Teammate B
  C.PLAYER_START_Y = (C.PLAYER_ZONE_Y_MIN + C.PLAYER_ZONE_Y_MAX) / 2 + 20;
  C.ENEMY_START_X = [110, 170, 230];
  C.ENEMY_START_Y = (C.ENEMY_ZONE_Y_MIN + C.ENEMY_ZONE_Y_MAX) / 2 - 20;

  TD.constants = C;
})(window);
