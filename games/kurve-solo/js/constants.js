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
    // War 1:1 aus der Spec 0.05, nach Live-Feedback ("später schwer
    // einzulenken", Lücken inzwischen sehr eng) auf 0.07 erhöht – kleinerer
    // Wenderadius (SPEED/TURN: 34px -> 24px), spürbar wendiger.
    TURN: 0.07, // rad/frame bei gehaltener Richtung
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
    WIDTH_HALF_LIFE: 1000, // schneller eng als zuvor (war 1400) – Feedback: "immer noch zu leicht"

    // Hindernisse: waagerechte Balken mit einer Lücke, quer zur
    // Bewegungsrichtung. Lücke wird enger, Abstand knapper, Position
    // springt stärker hin und her ("verzwickter") – alles ohne Cap.
    OBSTACLE_THICK: 10,
    OBSTACLE_FIRST_CLEARANCE: 320, // grosszügiger Abstand bis zum ersten Hindernis
    OBSTACLE_GAP_START: 105, // war 130 – Feedback: "Lücken deutlich enger"
    OBSTACLE_GAP_TARGET: 22, // war 30, knapp über dem theoretischen Minimum (~2x Kollisionsradius)
    GAP_HALF_LIFE: 750, // war 1200 – zieht deutlich schneller auf den Zielwert zu
    OBSTACLE_SPACING_START: 175,
    OBSTACLE_SPACING_TARGET: 85,
    SPACING_HALF_LIFE: 1100, // war 1500
    OBSTACLE_JITTER_START: 35, // max. Sprung der Lücken-Mitte zur vorigen (px)
    OBSTACLE_JITTER_TARGET: 160, // wächst (nicht sinkt) – wird durchs Feld sowieso geclamped
    JITTER_HALF_LIFE: 1100, // war 1600

    // --- Gegner: Hindernis-Punkte, die man umschlängeln muss. Tauchen
    // erst ab einer gewissen Höhe auf ("später"), on top der Hindernis-
    // Balken – zusätzliche Schicht für Fortgeschrittene. Ab einer noch
    // späteren Höhe fangen sie zusätzlich an, langsam hin und her zu
    // pendeln ("Gegner bewegen sich irgendwann auch noch").
    ENEMY_START_HEIGHT: 3500,
    ENEMY_CHANCE_PER_GAP: 0.5,
    ENEMY_RADIUS: 9,
    ENEMY_COLOR: '#ff6b81',
    ENEMY_MOVE_START_HEIGHT: 7000, // ab hier pendeln neu gespawnte Gegner
    ENEMY_MOVE_AMPLITUDE: 26, // px Ausschlag zur Seite
    ENEMY_MOVE_SPEED: 0.02, // rad/frame – gemächliches Pendeln, kein Zappeln

    // --- Power-Up: kurzer Tempo-Boost + Unverwundbarkeit. Wird absichtlich
    // weit von der sicheren Lücke entfernt platziert, damit das Abholen
    // ein bewusstes Risiko ist (siehe ensureObstaclesAhead in game.js).
    POWERUP_CHANCE_PER_OBSTACLE: 0.4, // erst auf 0.12 reduziert, dann per Feedback wieder hoch ("bockt voll")
    POWERUP_Y_LEAD: 60, // Spawn-Punkt so viel "vor" dem Balken (Richtung Spieler)
    POWERUP_MIN_OFFSET_FROM_GAP: 75,
    POWERUP_OFFSET_SPREAD: 30,
    POWERUP_RADIUS: 9,
    POWERUP_PICKUP_RADIUS: 15,
    POWERUP_DURATION_FRAMES: 150, // 2.5s bei 60Hz
    POWERUP_SPEED_MULT: 1.9,
    // Der Kopf blinkt NICHT die ganze Dauer, sondern nur noch in den
    // letzten WARNING_FRAMES davon – klares "gleich vorbei"-Signal statt
    // durchgehendem Blinken (Feedback: "muss kurz blinken bevor's endet").
    POWERUP_WARNING_FRAMES: 45, // 0.75s Vorwarnung
    // Feedback: Timer läuft in einer Wand/einem Hindernis ab -> sofortiger
    // Crash direkt nach dem Boost, kein Reaktionsfenster. Fix: die
    // Unverwundbarkeit endet erst, sobald eine sichere Stelle erreicht ist
    // (nicht in einer Wand, nicht in einem Hindernis-Balken, nicht direkt
    // an einem Gegner) – siehe `isSafeToEndBuff()` in game.js. Damit sich
    // das nicht zum Dauer-unschlagbar-Campen missbrauchen lässt, gibt es
    // eine harte Obergrenze für diese Kulanzzeit.
    POWERUP_MAX_GRACE_FRAMES: 90, // max. 1,5s zusätzliche Kulanz
    POWERUP_BLINK_FRAMES: 6, // Blink-Rhythmus während der Vorwarnung
    POWERUP_COLOR: '#ffe066',

    // Steuerungs-Hinweis: am Rundenstart kurz halbtransparent zeigen,
    // welche Bildschirmhälfte welche Richtung lenkt (kein Text nötig).
    CONTROL_HINT_FRAMES: 70, // war 150 (2.5s) – Feedback: "Erklärung kürzer"
    CONTROL_HINT_FADE_FRAMES: 18,
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
