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
    // 340×600 ≈ 9:16, also echtes Handyformat. Vorher 340×480 (3:4): das
    // ließ oben und unten breite Ränder frei UND gab nur knapp sechs
    // Etagen Sicht – ein Fehlsprung kostete damit sofort die Runde. Hoch
    // gibt es jetzt zehn Etagen Sicht und entsprechend Luft nach unten.
    CANVAS_H: 600,

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
    // Untergrenze nach dem Kappen. Muss über einer Etage liegen: -6.7
    // trägt 93 px, der größte Etagenabstand sind 68 px. Sonst brächte ein
    // kurzer Tipp gar nichts.
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
    // Ohne Eingabe verliert der Abprall Energie, statt den Schwung erneut
    // aufzuladen – sonst prallt eine unbediente Figur endlos zwischen den
    // Wänden hin und her und ist nicht mehr einzufangen.
    WALL_BOUNCE_IDLE: 0.55,
    WALL_BOUNCE_MIN_SPEED: 0.8, // darunter einfach stoppen statt abprallen
    WALL_BOUNCE_MAX: 8.5, // Deckel, damit es sich nicht endlos aufschaukelt
    WALL_LOCK_MS: 380,
    OVERSPEED_FRICTION: 0.022, // px/frame², so langsam verliert sich der Dash-Schwung
    // ... aber nur, solange man ihn auch nutzt. Ohne Eingabe rollt er
    // deutlich schneller aus.
    OVERSPEED_FRICTION_IDLE: 0.14,
    // Hält man nach dem Abprall noch in die alte Richtung geneigt (was
    // fast immer passiert, man kam ja gerade von dort), würde normales
    // Gegenlenk-Bremsen den Dash in ~130ms abwürgen – schneller als man
    // das Handy überhaupt zurückkippen kann. Während des Überschusses
    // bremst Gegenlenken deshalb nur sanft.
    BOOST_COUNTER_BRAKE: 0.1,
    // Wie hart ein Druck auf die Gegenseite den Dash abbremst (nur
    // Tippen-Steuerung). Per Playtest auf diesen Wert festgelegt: der
    // Dash ist nach gut 0,2s ausgebremst und dreht dann um.
    DASH_BRAKE: 0.55,
    // Davor ein kurzes Fenster, in dem der Abprall geschützt läuft: so
    // bleibt Zeit, den Finger zu lösen und den Dash ganz auszukosten.
    // Erst danach greift ein Druck sofort. Per Playtest festgelegt.
    DASH_GRACE_MS: 120,
    // Zeitfenster nach einem Wandabprall, in dem ein Sprung als Combo zählt.
    WALL_BOOST_MS: 1500,

    // Etagen: schmale Plattform (nicht die volle Breite), von unten immer
    // durchspringbar (wie bei Doodle Jump). Steht man beim Fallen über
    // ihr, landet man; sonst fällt man weiter zur nächsten Etage darunter
    // – siehe game.js handleFloorCrossing/onPlank.
    // Enger gesetzt als anfangs (82): bei 480 px Bildhöhe waren nur knapp
    // sechs Etagen zu sehen, ein Fehlsprung von drei Etagen kostete damit
    // sofort den ganzen Puffer nach unten. Bei 58 px sind über acht Etagen
    // im Bild, und derselbe Fehlsprung ist wieder aufzuholen.
    FLOOR_SPACING: 58,
    FLOOR_SPACING_JITTER: 10,
    FLOOR_THICK: 6,
    // Plattenbreite als Stützstellen (Etage -> px), dazwischen linear.
    // Die ersten 100 Etagen bleiben zum Reinkommen auf Startbreite, danach
    // zieht es an. Die Startbreite liegt bewusst unter 164 px (= halbe
    // Laufbreite): darüber deckt jede Platte zwangsläufig die Bildmitte ab,
    // und man klettert ohne jede Eingabe endlos weiter (im Testlauf kam
    // eine völlig unbediente Figur so bis Etage 105). Unten ist bei 48 px
    // Schluss, das ist mit 24 px Figurenbreite gerade noch zu treffen.
    PLANK_WIDTH_CURVE: [[0, 158], [100, 158], [300, 95], [500, 76], [800, 62], [1400, 48]],
    FLOOR_MARK_EVERY: 10, // jede zehnte Etage wird hervorgehoben (wie im Original)
    FLOOR_THEME_EVERY: 100, // alle 100 Etagen wechselt die Optik der Plattformen

    // Kamera: folgt nach oben mit – UND wandert nach einer Schonfrist von
    // selbst weiter nach oben, immer schneller. Das ist der eigentliche
    // Zeitdruck: stehen bleiben heißt irgendwann unten rausfallen.
    // Bildhöhe, auf der die Figur nach einer Landung steht (von oben).
    // Was darunter frei bleibt, ist der Puffer zum Zurückfallen: bei 0.36
    // sind das 307 px, also gut fünf Etagen, die man danebenspringen darf,
    // bevor es eng wird.
    CAMERA_FOLLOW_RATIO: 0.36,
    // Die Basis zieht dem Aufstieg anteilig nach (LERP), aber höchstens mit
    // CAMERA_CATCHUP px/frame. Der Anteil sorgt dafür, dass das Bild beim
    // Klettern sichtbar mitgeht – mit einem festen, langsamen Tempo blieb es
    // beim schnellen Hochspielen einfach stehen und rückte erst nach, wenn
    // man kurz wartete. Der Deckel hält den Vorsprung als Belohnung: wer
    // Tempo macht, steigt trotzdem etwas im Bild und gewinnt Luft nach
    // unten – nur eben nicht unbegrenzt.
    CAMERA_FOLLOW_LERP: 0.12,
    CAMERA_CATCHUP: 3.2,
    // ... und höchstens so weit zurückbleiben, sonst klebt die Figur oben
    // am Rand und stirbt irgendwann weit außerhalb des sichtbaren Bildes.
    CAMERA_MAX_LAG: 110,
    // Näher als das darf die Figur der Oberkante nie kommen; ab da nimmt
    // die Kamera den Sprung mit. Bewusst nicht zu klein: bei 60 px klebte
    // die Figur in 90 % der Bilder ganz oben und man sah nicht mehr, wohin
    // man springt. Bei 130 px bleiben gut zwei Etagen Vorausschau, und
    // zwischen 130 und 216 px steigt man erst sichtbar im Bild, bevor die
    // Kamera überhaupt mitgeht.
    CAMERA_MAX_TOP: 130,
    SCROLL_START_FLOOR: 4, // ab dieser erreichten Etage beginnt das Hochwandern
    SCROLL_START_MS: 8000, // ... spätestens aber nach dieser Zeit, damit Trödeln unten nicht ewig geht
    // Tempo der Kamera als Stützstellen (Etage -> px/frame). Zum Einordnen:
    // wer je Sprung nur EINE Etage schafft, steigt mit ~1.0 px/frame, wer
    // zwei nimmt mit ~2.2, ein sauberer Vollgas-Lauf schafft gut 3.
    // Deshalb ist bei 3.6 (216 px/s) irgendwann für jeden Schluss – die
    // Kurve läuft oben nicht aus, sie holt einen ein.
    SCROLL_SPEED_CURVE: [[0, 0.4], [100, 0.5], [300, 1.35], [500, 1.8], [800, 2.3], [1400, 3.0], [2200, 3.6]],
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

  // Wert aus einer Stützstellen-Kurve [[Etage, Wert], ...] ablesen,
  // dazwischen linear, außerhalb der Endpunkt. Stützstellen statt einer
  // einzigen Rampe, weil die Kurve nicht gleichmäßig sein soll: unten flach
  // zum Reinkommen, dann steil, oben wieder flacher – aber nie waagerecht.
  constants.curveAt = function (curve, x) {
    if (x <= curve[0][0]) return curve[0][1];
    for (var i = 1; i < curve.length; i++) {
      if (x <= curve[i][0]) {
        var a = curve[i - 1];
        var b = curve[i];
        return a[1] + (b[1] - a[1]) * ((x - a[0]) / (b[0] - a[0]));
      }
    }
    return curve[curve.length - 1][1];
  };

  constants.plankWidthAt = function (floorNumber) {
    return constants.curveAt(constants.PLANK_WIDTH_CURVE, floorNumber);
  };

  constants.scrollSpeedAt = function (floorNumber) {
    return constants.curveAt(constants.SCROLL_SPEED_CURVE, floorNumber);
  };

  // Plattform-Welten, die alle FLOOR_THEME_EVERY Etagen durchgewechselt
  // werden. Jede hat neben den Farben eine eigene Deko (siehe sprites.js
  // drawFloor) und einen eigenen Hintergrund (background.js), damit sie
  // sich nicht nur im Farbton unterscheiden.
  //   base = Körper, deep = Unterkante, top = Glanzkante,
  //   mark/markDeep = jede zehnte Etage, deco = Zusatzgrafik,
  //   bg.sky = Himmelsverlauf (oben/unten), bg.deco + bg.dec = Deko-Feld,
  //   bg.wall = Farbe der Seitenwände.
  constants.PLANK_THEMES = [
    {
      name: 'Wolkendeck', en: 'CLOUD DECK', base: '#e8f0fb', deep: '#a8bcd6', top: '#ffffff', mark: '#ffd15c', markDeep: '#c9962c', deco: 'puffs',
      bg: { sky: ['#2f6ea8', '#9fcbe8'], deco: 'clouds', dec: 'rgba(255, 255, 255, 0.5)', wall: '#d8ecff' },
    },
    {
      name: 'Rostwerk', en: 'RUST WORKS', base: '#c47a4a', deep: '#6b3c22', top: '#e8b083', mark: '#9fd8ff', markDeep: '#4a7a96', deco: 'rivets',
      bg: { sky: ['#1e120c', '#6b3f22'], deco: 'pipes', dec: 'rgba(14, 8, 5, 0.42)', wall: '#e8b083' },
    },
    {
      name: 'Wüstenruine', en: 'DESERT RUINS', base: '#e0b878', deep: '#96703c', top: '#f7e2b8', mark: '#7dd6c0', markDeep: '#2e8a78', deco: 'bricks',
      // Deutlich dunklerer Abendhimmel: die Platten sind selbst sandfarben
      // und würden vor einem hellen Sandhimmel verschwinden.
      bg: { sky: ['#4a1a1e', '#b8553a'], deco: 'pillars', dec: 'rgba(52, 22, 16, 0.38)', wall: '#f7e2b8' },
    },
    {
      name: 'Korallenriff', en: 'CORAL REEF', base: '#2fb8a8', deep: '#176b63', top: '#8ff0e0', mark: '#ff8a4c', markDeep: '#b8521f', deco: 'polyps', polyp: '#ff6b81',
      bg: { sky: ['#03303f', '#0d7a88'], deco: 'bubbles', dec: 'rgba(190, 255, 255, 0.32)', wall: '#8ff0e0' },
    },
    {
      name: 'Magmaschlund', en: 'MAGMA PIT', base: '#5a3330', deep: '#2b1715', top: '#ff9a52', mark: '#ffe66b', markDeep: '#c2a01f', deco: 'cracks',
      bg: { sky: ['#140503', '#7a1f0a'], deco: 'embers', dec: '#ff8a3a', wall: '#ff9a52' },
    },
    // Patina-Grün statt Messing: sonst zu nah an der sandfarbenen Wüstenruine
    {
      name: 'Uhrwerk', en: 'CLOCKWORK', base: '#3f8a66', deep: '#1c4433', top: '#8fe0bc', mark: '#ffd15c', markDeep: '#b8891f', deco: 'gears', gear: '#e0be76',
      bg: { sky: ['#0a2119', '#1e4a3c'], deco: 'cogs', dec: 'rgba(160, 230, 200, 0.09)', wall: '#8fe0bc' },
    },
    {
      name: 'Zuckerturm', en: 'SUGAR RUSH', base: '#ffc2e0', deep: '#c26b99', top: '#fff2f8', mark: '#8ef0ff', markDeep: '#3f9ab8', deco: 'sprinkles',
      // Kräftiges Beeren-Violett – die Platten sind fast weiß, davor
      // heben sie sich ab.
      bg: { sky: ['#3a0f52', '#a8348a'], deco: 'candy', dec: 'rgba(255, 240, 250, 0.4)', wall: '#fff2f8' },
    },
    {
      name: 'Neonlabor', en: 'NEON LAB', base: '#26304a', deep: '#141a2b', top: '#5ee6ff', mark: '#ff4fd8', markDeep: '#8a1f74', deco: 'circuit',
      bg: { sky: ['#03060f', '#101f3a'], deco: 'grid', dec: 'rgba(94, 230, 255, 0.16)', wall: '#5ee6ff' },
    },
    // Fast schwarze Wolke in beiden Varianten – der Blitz macht den
    // Unterschied: normal gelb, auf der Zehner-Etage grün.
    {
      name: 'Gewitterfront', en: 'THUNDERHEAD', base: '#14161d', deep: '#07080c', top: '#5a6478', mark: '#0e1016', markDeep: '#05060a', deco: 'storm', bolt: '#ffe66b', boltMark: '#6bff4a',
      bg: { sky: ['#05070c', '#323a4e'], deco: 'storm', dec: '#ffe66b', wall: '#8a94aa' },
    },
    // Finale der Reihe: ganz oben endet der Turm im All.
    {
      name: 'Weltraum', en: 'DEEP SPACE', base: '#241f3d', deep: '#110e1f', top: '#c2b8ff', mark: '#5ee6ff', markDeep: '#2a7a96', deco: 'space',
      bg: { sky: ['#03020a', '#1b1140'], deco: 'stars', dec: '#ffffff', wall: '#c2b8ff' },
    },
  ];

  // Überblendung beim Weltenwechsel – ein harter Schnitt mitten im Sprung
  // würde reißen.
  constants.BG_FADE_MS = 900;

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
