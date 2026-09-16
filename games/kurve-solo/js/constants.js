/**
 * Kurve Solo – Konstanten (Endlos-Modus, Hardcore-Tuning)
 *
 * Kernphysik 1:1 aus der urspruenglichen Spielspezifikation (Prototyp-
 * Phase, Chat/Visualizer, durch Testspielen gefunden): SPEED, TURN,
 * THICK, HIT_FACTOR_SQ, SELF_IGNORE_RECENT_POINTS. Nicht ohne erneutes
 * Playtesting veraendern.
 *
 * Die zufälligen Lücken in der eigenen Linie aus der Original-Spec
 * sind bewusst ENTFERNT: die waren im Original für Mehrspieler-
 * Fairness da (damit gegnerische Kurven aneinander vorbeikommen). Im
 * Single-Player-Endlos-Modus gibt es keine Gegner mehr, die davon
 * profitieren – die Linie ist jetzt durchgehend tödlich, kein
 * kostenloses Entkommen mehr.
 *
 * Alles rund um die Endlos-Steigerung (Feldbreite, Hindernisse,
 * Power-Up) ist eine spätere Erweiterung auf Wunsch nach dem ersten
 * Playtest ("viel zu leicht") und war in keiner Spec beziffert –
 * Platzhalterwerte, mit `npm run dev` gegenspielen und anpassen.
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
    SELF_IGNORE_RECENT_POINTS: 10, // sonst crasht man sofort in die eigene gerade gezogene Linie

    // Kamera: folgt nur nach oben, wie bei Ninja Wandsprung.
    CAMERA_FOLLOW_RATIO: 0.6,
    // Sicherheitsnetz: wer absichtlich rückwärts/abwärts lenkt, stirbt
    // irgendwann statt endlos unterhalb der Kamera zu trödeln.
    FALL_MARGIN: 140,
    // Wie weit unterhalb der Kamera alte Linienpunkte/Hindernisse/
    // Power-Ups gelöscht werden (Speicher & Kollisionscheck bleiben bei
    // einer echten Endlos-Session begrenzt).
    PRUNE_MARGIN: 200,

    START_Y_FROM_BOTTOM: 90,

    // Gemeinsame Gnadenfrist (px Höhe), bevor irgendeine Schwierigkeits-
    // Rampe überhaupt zu greifen beginnt.
    RAMP_GRACE: 300,

    // --- Steigende Schwierigkeit: KEINE Rampe mit festem Endwert mehr,
    // sondern eine Annäherungskurve ohne echtes Plateau (siehe
    // `constants.approach`). Wird mit der Höhe immer enger/schneller/
    // verzwickter, ohne je ganz stehenzubleiben. HALF_LIFE = die Höhe,
    // nach der die halbe Strecke zum (praktisch nie ganz erreichten)
    // Zielwert zurückgelegt ist – kleiner HALF_LIFE = schnellere
    // Eskalation.

    // Spielfeld wird schmaler.
    FIELD_WIDTH_START: 328, // volle Breite (= CANVAS_W - 2*6) am Anfang
    FIELD_WIDTH_TARGET: 100, // brutal eng, aber > 2x Mindest-Wenderadius (2*SPEED/TURN = 68px)
    WIDTH_HALF_LIFE: 1400,

    // Hindernisse: waagerechte Balken mit einer Lücke, quer zur
    // Bewegungsrichtung. Lücke wird enger, Abstand knapper, Position
    // springt stärker hin und her ("verzwickter") – alles ohne Cap.
    OBSTACLE_THICK: 10,
    OBSTACLE_FIRST_CLEARANCE: 320, // grosszügiger Abstand bis zum ersten Hindernis
    OBSTACLE_GAP_START: 130,
    OBSTACLE_GAP_TARGET: 30, // knapp über dem theoretischen Minimum (~2x Kollisionsradius)
    GAP_HALF_LIFE: 1200,
    OBSTACLE_SPACING_START: 175,
    OBSTACLE_SPACING_TARGET: 85,
    SPACING_HALF_LIFE: 1500,
    OBSTACLE_JITTER_START: 35, // max. Sprung der Lücken-Mitte zur vorigen (px)
    OBSTACLE_JITTER_TARGET: 160, // wächst (nicht sinkt) – wird durchs Feld sowieso geclamped
    JITTER_HALF_LIFE: 1600,

    // --- Gegner: statische Hindernis-Punkte, die man umschlängeln muss.
    // Tauchen erst ab einer gewissen Höhe auf ("später"), on top der
    // Hindernis-Balken – zusätzliche Schicht für Fortgeschrittene.
    ENEMY_START_HEIGHT: 3500,
    ENEMY_CHANCE_PER_GAP: 0.5,
    ENEMY_RADIUS: 9,
    ENEMY_COLOR: '#ff6b81',

    // --- Power-Up: kurzer Tempo-Boost + Unverwundbarkeit. Wird absichtlich
    // weit von der sicheren Lücke entfernt platziert, damit das Abholen
    // ein bewusstes Risiko ist (siehe ensureObstaclesAhead in game.js).
    POWERUP_CHANCE_PER_OBSTACLE: 0.4,
    POWERUP_Y_LEAD: 60, // Spawn-Punkt so viel "vor" dem Balken (Richtung Spieler)
    POWERUP_MIN_OFFSET_FROM_GAP: 75,
    POWERUP_OFFSET_SPREAD: 30,
    POWERUP_RADIUS: 9,
    POWERUP_PICKUP_RADIUS: 15,
    POWERUP_DURATION_FRAMES: 150, // 2.5s bei 60Hz
    POWERUP_SPEED_MULT: 1.9,
    POWERUP_BLINK_FRAMES: 6, // Blink-Rhythmus des Spielers während der Unschlagbarkeit
    POWERUP_COLOR: '#ffe066',

    // Steuerungs-Hinweis: am Rundenstart kurz halbtransparent zeigen,
    // welche Bildschirmhälfte welche Richtung lenkt (kein Text nötig).
    CONTROL_HINT_FRAMES: 150, // 2.5s bei 60Hz
    CONTROL_HINT_FADE_FRAMES: 30,
    CONTROL_HINT_MAX_ALPHA: 0.3,

    PLAYER_COLOR: '#5ee6ff',
    OBSTACLE_COLOR: '#f2a154',
    WALL_COLOR: '#3a4a63',

    DEATH_PARTICLE_COUNT: 16,
    SHAKE_FRAMES: 14,
    SHAKE_MAGNITUDE: 4,
  };

  // Nähert sich `target` an, ausgehend von `start` bei h=grace, aber
  // OHNE je ein echtes Plateau zu erreichen – wird immer noch (wenn
  // auch immer langsamer) weiter Richtung target gezogen, egal wie groß
  // h wird. halfLife = Höhe, nach der die halbe Reststrecke zurückgelegt
  // ist. Funktioniert in beide Richtungen (fallend oder steigend).
  constants.approach = function (h, start, target, halfLife, grace) {
    var eff = Math.max(0, h - (grace || 0));
    var frac = 1 / (1 + eff / halfLife); // 1 bei eff=0, -> 0 für eff -> unendlich
    return target + (start - target) * frac;
  };

  constants.fieldHalfWidthAt = function (h) {
    return constants.approach(h, constants.FIELD_WIDTH_START, constants.FIELD_WIDTH_TARGET, constants.WIDTH_HALF_LIFE, constants.RAMP_GRACE) / 2;
  };

  KS.constants = constants;
})(window);
