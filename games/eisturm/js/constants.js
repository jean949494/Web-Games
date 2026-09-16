/**
 * Eisturm – Konstanten
 *
 * Icy-Tower-Mechanik: schmale Etagen erklimmen, Anlauftempo UND
 * Haltedauer bestimmen die Sprunghöhe, Wandabprall gibt Schwung zurück,
 * mehrere Etagen in einem Sprung geben Combo-Punkte. Der Bildschirm
 * wandert von selbst nach oben und wird schneller – wer stehen bleibt,
 * fällt unten raus.
 *
 * Steuerung: links/rechts neigen -> laufen, je stärker geneigt desto
 * schneller (siehe TILT_STEER_MAX_DEG). Antippen -> springen, länger
 * gedrückt halten -> höher springen.
 *
 * Die TILT_*-Werte sind ohne echtes Gerät entstanden (kein Gyroskop im
 * Testcontainer) – mit `?debug` in der URL zeigt input.js Neigungswinkel
 * und Lenkwert live an, damit sich das auf dem Handy nachjustieren lässt.
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
    // Beim Gegenlenken kippt die Laufrichtung SOFORT um (auf diesen Anteil
    // des Zieltempos) statt erst auszubremsen – sonst läuft die Figur
    // gefühlt noch weiter, obwohl man schon in die andere Richtung neigt.
    // Vollgas braucht danach trotzdem wieder Anlauf.
    TURN_SNAP_FACTOR: 0.35,

    // Sprungphysik. Höhe ergibt sich aus Lauftempo (Anlauf) UND Haltedauer:
    // beim Loslassen wird ein noch steigender Sprung gekappt (JUMP_CUT_*),
    // kurzes Antippen springt also niedriger als langes Halten.
    GRAVITY: 0.24,
    JUMP_VY_BASE: -8.4, // Sprung im Stand (kein Schwung), voll gehalten
    JUMP_VY_BONUS: -5.6, // zusätzlich bei voller Laufgeschwindigkeit
    JUMP_CUT_FACTOR: 0.5, // beim Loslassen: Rest-Steiggeschwindigkeit * dieser Faktor
    // Untergrenze nach dem Kappen. Muss über einer Etage liegen (~91px bei
    // FLOOR_SPACING 82), sonst bringt ein kurzer Tipp gar nichts.
    JUMP_VY_MIN: -6.7,
    // Tempo-Anteil, der maximal in die Sprunghöhe eingeht. Über 1, damit
    // der Extra-Schwung aus einem Wandabprall wirklich höher trägt.
    JUMP_SPEED_FACTOR_MAX: 1.7,

    // Wandabprall: das Herzstück des Tempoaufbaus. Man kommt SCHNELLER
    // zurück als man ankam (Faktor > 1) und ignoriert dabei kurz die
    // Steuerung, sonst würde die gehaltene Richtung die Figur sofort
    // wieder in die Wand ziehen ("klebt"). Der Überschuss über das normale
    // Lauftempo hinaus baut sich nur langsam ab (OVERSPEED_FRICTION) und
    // gibt so auch höhere Sprünge – Combos gibt es nur aus diesem Zustand.
    WALL_BOUNCE: 1.55,
    WALL_BOUNCE_MIN_SPEED: 0.8, // darunter einfach stoppen statt abprallen
    WALL_BOUNCE_MAX: 8.5, // Deckel, damit es sich nicht endlos aufschaukelt
    WALL_LOCK_MS: 380,
    OVERSPEED_FRICTION: 0.022, // px/frame², so langsam verliert sich der Dash-Schwung
    // Hält man nach dem Abprall noch in die alte Richtung geneigt (was
    // fast immer passiert, man kam ja gerade von dort), würde normales
    // Gegenlenk-Bremsen den Dash in ~130ms abwürgen – schneller als man
    // das Handy überhaupt zurückkippen kann. Während des Überschusses
    // bremst Gegenlenken deshalb nur sanft.
    BOOST_COUNTER_BRAKE: 0.1,
    // Zeitfenster nach einem Wandabprall, in dem ein Sprung als Combo zählt.
    WALL_BOOST_MS: 1500,

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
    FLOOR_THEME_EVERY: 100, // alle 100 Etagen wechselt die Optik der Plattformen

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
    // Verloren, sobald die Figur komplett aus dem sichtbaren Bild ist –
    // kein zusätzlicher Puffer darunter.
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
    FLASH_DURATION_MS: 1500, // Lebensdauer der Combo-Einblendung
    BANNER_DURATION_MS: 2300, // Einblendung beim Wechsel in eine neue Welt

    POINTS_PER_FLOOR: 10, // Grundpunkte je erreichter Etage

    // Steuerung: Neigung. Kleiner Winkel = sensibler (weniger kippen für
    // volles Tempo); die Zwischenwerte bleiben stufenlos für feines Dosieren.
    TILT_STEER_MAX_DEG: 5, // Neigungswinkel für volles Lauftempo – bewusst
    // sehr klein, damit das Handy nahezu aufrecht bleibt und der
    // Bildschirm gut im Blick bleibt.
    // Totzone um die Nulllage: ohne sie lässt schon leichtes Handzittern
    // das Vorzeichen kippen und die Figur eiert hin und her.
    TILT_DEAD_DEG: 1.2,
    // Kennlinie: < 1 heißt, kleine Neigungen wirken überproportional stark
    // (bei ~20 % Kippweg gibt es schon ~40 % Tempo), oben bleibt es
    // trotzdem fein dosierbar.
    TILT_EXPO: 0.6,
    // Etwas stärker geglättet, weil die kleinere Totzone Sensorrauschen
    // sonst eher durchlässt.
    TILT_SMOOTH: 0.25,
    // Selbstzentrierung: hält man ruhig (Auslenkung innerhalb der Totzone),
    // wandert die Nulllage ganz langsam mit. So verzieht sich die Mitte
    // nicht, wenn man sich während der Runde anders hinsetzt. Beim aktiven
    // Lenken passiert nichts, sonst würde die Steuerung wegdriften.
    TILT_RECENTER: 0.01,

    // Juice. squash > 0 = breiter/flacher (Landung), < 0 = schmaler/höher
    // (Wandabprall); skaliert wird um den Fußpunkt, siehe sprites.js.
    SQUASH_DECAY: 0.09,
    SQUASH_LAND: 0.7,
    SQUASH_WALL: -0.72,
    DUST_PARTICLE_COUNT: 7,

    // Regenbogen-Schweif (Icy-Tower-Markenzeichen): erscheint ab diesem
    // Anteil der Höchstgeschwindigkeit und wird mit dem Tempo kräftiger.
    TRAIL_MIN_SPEED_FACTOR: 0.45,
    TRAIL_MAX_POINTS: 46,
    TRAIL_FADE: 0.045,
    TRAIL_HUE_STEP: 11,
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

  // Plattform-Welten, die alle FLOOR_THEME_EVERY Etagen durchgewechselt
  // werden. Jede hat neben den Farben eine eigene Deko (siehe sprites.js
  // drawFloor), damit sie sich nicht nur im Farbton unterscheiden.
  //   base = Körper, deep = Unterkante, top = Glanzkante,
  //   mark/markDeep = jede zehnte Etage, deco = Zusatzgrafik.
  constants.PLANK_THEMES = [
    { name: 'Wolkendeck', en: 'CLOUD DECK', base: '#e8f0fb', deep: '#a8bcd6', top: '#ffffff', mark: '#ffd15c', markDeep: '#c9962c', deco: 'puffs' },
    { name: 'Korallenriff', en: 'CORAL REEF', base: '#ff9ec4', deep: '#b8547e', top: '#ffe0ef', mark: '#7dffd6', markDeep: '#2e9c85', deco: 'polyps' },
    { name: 'Magmaschlund', en: 'MAGMA PIT', base: '#5a3330', deep: '#2b1715', top: '#ff9a52', mark: '#ffe66b', markDeep: '#c2a01f', deco: 'cracks' },
    { name: 'Neonlabor', en: 'NEON LAB', base: '#26304a', deep: '#141a2b', top: '#5ee6ff', mark: '#ff4fd8', markDeep: '#8a1f74', deco: 'circuit' },
    { name: 'Zuckerturm', en: 'SUGAR RUSH', base: '#ffc2e0', deep: '#c26b99', top: '#fff2f8', mark: '#8ef0ff', markDeep: '#3f9ab8', deco: 'sprinkles' },
    { name: 'Uhrwerk', en: 'CLOCKWORK', base: '#d8b46a', deep: '#8a6a2c', top: '#f7e2b0', mark: '#9fd8ff', markDeep: '#4a7a96', deco: 'gears' },
    { name: 'Wüstenruine', en: 'DESERT RUINS', base: '#e0b878', deep: '#96703c', top: '#f7e2b8', mark: '#7dd6c0', markDeep: '#2e8a78', deco: 'bricks' },
    { name: 'Rostwerk', en: 'RUST WORKS', base: '#c47a4a', deep: '#6b3c22', top: '#e8b083', mark: '#9fd8ff', markDeep: '#4a7a96', deco: 'rivets' },
    { name: 'Gewitterfront', en: 'THUNDERHEAD', base: '#4a5162', deep: '#272c38', top: '#c2cede', mark: '#ffe66b', markDeep: '#b8891f', deco: 'lightning' },
    // Finale der Reihe: ganz oben endet der Turm im All.
    { name: 'Weltraum', en: 'DEEP SPACE', base: '#241f3d', deep: '#110e1f', top: '#c2b8ff', mark: '#5ee6ff', markDeep: '#2a7a96', deco: 'space' },
  ];

  constants.themeForFloor = function (seq) {
    var i = Math.floor(Math.max(0, seq) / constants.FLOOR_THEME_EVERY);
    return constants.PLANK_THEMES[i % constants.PLANK_THEMES.length];
  };

  // Combo-Stufen: englische Lob-Begriffe wie im Original, zehn Stufen
  // vom knappen Doppelsprung bis zum Wahnsinnslauf. rainbow = die Meldung
  // wird zusätzlich in Regenbogenfarben gefüllt.
  constants.COMBO_LABELS = [
    { floors: 2, text: 'Good!', color: '#bfe9ff', size: 17 },
    { floors: 3, text: 'Great!', color: '#8ee9ff', size: 19 },
    { floors: 4, text: 'Amazing!', color: '#5ee6ff', size: 21 },
    { floors: 5, text: 'Fantastic!', color: '#7dffb5', size: 23 },
    { floors: 6, text: 'Excellent!', color: '#ffe66b', size: 25 },
    { floors: 7, text: 'Incredible!', color: '#ffd15c', size: 27 },
    { floors: 8, text: 'Unbelievable!', color: '#ffb03a', size: 28 },
    { floors: 10, text: 'Outstanding!', color: '#ff8a4c', size: 30 },
    { floors: 12, text: 'Spectacular!', color: '#ff6b81', size: 32 },
    { floors: 15, text: 'GODLIKE!', color: '#ff4fd8', size: 36, rainbow: true },
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
