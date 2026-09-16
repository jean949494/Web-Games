# Eisturm

Icy-Tower-Prototyp (Canvas, Vanilla JS, keine Build-Abhängigkeiten):
Etagen erklimmen, Anlauftempo und Haltedauer bestimmen die Sprunghöhe.
Der Dreh- und Angelpunkt ist der Wandabprall: an den Seitenwänden kommt
man schneller zurück als man ankam, und **nur** aus diesem Schwung heraus
gibt es Combo-Punkte. Der Bildausschnitt wandert von selbst nach oben und
wird immer schneller – wer stehen bleibt oder aus dem Bild fällt, ist raus.

## Steuerung

Im Menü umschaltbar (lokal gespeichert, siehe `js/settings.js`):

**Neigen** (Standard)

- **Handy links/rechts neigen** – laufen, stufenlos: je stärker geneigt,
  desto schneller
- **Antippen** (egal wo) – springen; **länger gedrückt halten springt
  höher**, kurzes Tippen gibt nur einen kleinen Hüpfer
- **Finger liegen lassen** – die Figur springt bei jeder Landung sofort
  weiter. Damit lässt sich die Runde komplett über die Neigung spielen,
  ohne nachzutippen.

**Tippen** (zum Testen ohne Gyroskop)

- Die Figur **springt durchgehend von selbst**
- **Linke/rechte Bildschirmhälfte drücken** – in die Richtung laufen,
  loslassen – ausrollen. Die Neigung ist in diesem Modus ohne Wirkung.
- Direkt nach dem Abprall läuft der Dash kurz **geschützt** weiter
  (`DASH_GRACE_MS`, 120 ms, per Playtest festgelegt):
  So bleibt Zeit, den Finger zu lösen und den Dash ganz auszukosten.
  Danach greift ein Druck auf die Gegenseite sofort und **bremst** den
  Schwung mit `DASH_BRAKE` aus, statt ihn schlagartig umzudrehen.
  Beim Neigen bleibt der Schwung dagegen erhalten, weil man das Handy gar
  nicht so schnell zurückkippen könnte.
- Mehrere Finger werden mitgeführt: es zählt der zuletzt aufgesetzte,
  und wird der gehoben, übernimmt wieder der noch liegende.

Beides gilt für den **ganzen Bildschirm**, nicht nur für das Spielfeld:
die Bühne füllt ein hohes Handy nicht aus, über und unter ihr bleibt ein
Rand – ein Druck dorthin muss genauso zählen. Deshalb
hängen die Zeiger-Listener am `document`, nicht am Bühnen-Element, und die
Bildschirmhälfte wird gegen `window.innerWidth` gemessen. Die
Overlay-Knöpfe (Start, Pause, Sound, Skin, Modus) stoppen ihr
`pointerdown` selbst und lösen deshalb keinen Sprung aus.

Tastatur am PC zum Testen: Pfeiltasten/A+D halten = laufen,
Leertaste/Pfeil-hoch halten = springen (Höhe ebenfalls über die
Haltedauer), ESC = Pause.

## Starten

Kein Build-Schritt nötig, `index.html` kann direkt in jedem modernen
Browser geöffnet werden. Für die Entwicklung mit Live-Reload:

```
npm run dev
```

Das Spiel liegt dann unter `http://localhost:5173/games/eisturm/` (oder
über die Übersicht auf `http://localhost:5173/`). Details siehe
`../../DEV.md` im Repo-Root (Dev-Server & Deploy-Workflow).

Die Neigungssteuerung braucht ein echtes Gerät mit Gyroskop – am
Rechner testest du mit der Tastatur. Auf dem Handy im selben WLAN
funktioniert die echte Neigung, siehe "Im WLAN"-Adresse in der
`npm run dev`-Ausgabe.

Mit `?debug` in der URL (z.B.
`http://192.168.x.x:5173/games/eisturm/?debug`) zeigt das Spiel oben
links live den Neigungswinkel und den daraus abgeleiteten Lenkwert –
nützlich, um `TILT_STEER_MAX_DEG` in `js/constants.js` auf dem eigenen
Handy nachzujustieren.

## Struktur

- `index.html` – Markup + Overlay-Screens (Menü, Pause, Game Over)
- `style.css` – Layout, responsive Skalierung auf 340×600-Referenz (9:16)
- `js/constants.js` – Physik, Etagen, Kamera/Scroll, Combo, Neigung
- `js/settings.js` – gewählte Steuerung (Neigen/Tippen) und Figur, lokal
  gespeichert
- `js/game.js` – Zustandsmaschine, Physik-Loop (fix 60Hz), Rendering,
  Etagen-Kollision, Wandabprall, Combo-Wertung, Auto-Scroll-Kamera
- `js/input.js` – Neigung (Lenken), Antippen/Halten (Sprunghöhe), Tastatur
- `js/sprites.js` – die vier Figuren (Shadow/Steel/Emperor/Arcane) mit
  ihren Posen sowie die Plattformen aller Welten, prozedural gezeichnet
- `js/background.js` – der Himmel je Welt: Farbverlauf und gehashtes
  Deko-Feld mit Parallaxe
- `js/trail.js` – Regenbogen-Schweif
- `js/particles.js` – Landestaub, Wandabprall-Funken
- `js/sounds.js` – spielspezifische Ton-Sequenzen (aufbauend auf
  `shared/audio.js`)

## Bild-Studio

`preview.html` im Spielordner zeigt alle Grafiken vergrößert nebeneinander
(Figur in allen Posen, Schweif nach Tempo, Plattformen und Hintergründe
aller zehn Welten, Etagen-Breiten, Combo-Stufen, Beispielszene).
Praktisch, um an der Optik zu schrauben, ohne im Spiel danach zu jagen:
`https://jean949494.github.io/Web-Games/games/eisturm/preview.html`

## Mechanik im Detail

- **Etagen** sind schmale Plattformen, von unten immer durchspringbar –
  beim Steigen gibt es nie ein Hindernis. Beim Fallen entscheidet die
  Position: über der Plattform = Landung (die Figur steht oben auf der
  Kante), daneben = weiterfallen zur nächsten Etage darunter.
- **Sprunghöhe** = Anlauftempo + Haltedauer. Der Absprung setzt
  `JUMP_VY_BASE + JUMP_VY_BONUS * Tempo-Anteil`; das Loslassen kappt
  einen noch steigenden Sprung auf `JUMP_CUT_FACTOR` (mindestens
  `JUMP_VY_MIN`, damit ein kurzer Tipp nie völlig ins Leere geht).
- **Wandabprall**: an den Seitenwänden kommt man mit `WALL_BOUNCE` (1.55,
  also deutlich schneller als man ankam) zurück, gedeckelt durch
  `WALL_BOUNCE_MAX` – aber nur, wenn man aktiv hineinläuft. Ohne Eingabe
  schluckt der Abprall Energie (`WALL_BOUNCE_IDLE`) und der Überschuss
  rollt schneller aus (`OVERSPEED_FRICTION_IDLE`); sonst prallt eine
  unbediente Figur endlos zwischen den Wänden hin und her. Für `WALL_LOCK_MS` ignoriert die Figur dabei die
  Steuerung – sonst würde die weiterhin gehaltene Richtung sie sofort
  wieder in die Wand ziehen und der Abpraller verpuffen. Solange das
  Tempo über dem normalen Lauftempo liegt, hat der Schwung generell
  Vorrang vor der Steuerung (auch vor dem Richtungs-Snap, der ihn sonst
  schlagartig vernichten würde). Gegenlenken bremst ihn dabei nur sanft
  (`BOOST_COUNTER_BRAKE`): nach dem Abprall hält man das Handy fast immer
  noch in die Anlaufrichtung geneigt, normales Gegenbremsen würde den
  Dash in ~130 ms abwürgen – schneller, als man zurückkippen kann. Sonst
  baut er sich nur mit `OVERSPEED_FRICTION` ab. Über
  `JUMP_SPEED_FACTOR_MAX` trägt er direkt in die Sprunghöhe. Sprunghöhen
  bei `FLOOR_SPACING` 58: **kurzer Tipp 1,6 Etagen · aus dem Stand
  gehalten 2,5 · mit vollem Anlauf 7 · aus dem Wand-Dash 11,5.**
- **Combo nur aus dem Wandabprall**: ein Sprung zählt nur dann als Combo,
  wenn er innerhalb von `WALL_BOOST_MS` nach einem Wandabprall startet
  (oder die Figur mitten im Flug eine Wand trifft). Genau dieser Zustand
  ist am vollen Regenbogen-Schweif sichtbar. Übersprungene Etagen ab
  `COMBO_MIN_FLOORS` starten dann eine Serie; solange innerhalb von
  `COMBO_WINDOW_MS` nachgelegt wird, läuft sie weiter und der
  Multiplikator steigt je `COMBO_FLOORS_PER_MULT` Serien-Etagen. Oben
  läuft ein Restzeit-Balken, bei jedem Combo-Sprung ploppt eine
  Stufen-Meldung auf ("Gut!" bis "UNFASSBAR!", siehe `COMBO_LABELS`).
- **Richtungswechsel** schlägt sofort um (`TURN_SNAP_FACTOR`) statt erst
  auszubremsen; volles Tempo braucht danach trotzdem wieder Anlauf.
- **Neigung**: Totzone (`TILT_DEAD_DEG`) und Tiefpass (`TILT_SMOOTH`)
  halten die Nulllage ruhig, damit leichtes Handzittern die Figur nicht
  eiern lässt; hält man ruhig, zentriert sich die Nulllage langsam nach
  (`TILT_RECENTER`), damit sie sich nicht verzieht, wenn man sich während
  der Runde anders hinsetzt. Darüber wirkt eine Kennlinie (`TILT_EXPO` < 1), die kleine
  Winkel überproportional umsetzt: das Handy bleibt nahezu aufrecht
  (1,5° ≈ 22 % Tempo, 2° ≈ 39 %, 2,5° ≈ 53 %, ab 5° Vollgas), man sieht
  den Bildschirm also weiterhin gut. Gegengetestet: ±1,6° Handzittern
  bewegen die Figur nicht, 2,2° klare Neigung ziehen sofort an.
- **Kamera**: `camera.base` wandert ausschließlich nach oben – durch den
  Auto-Scroll und durch `chr.anchorY`, die höchste Etage, auf der wirklich
  **gelandet** wurde. Bewusst nicht durch die Momentanhöhe: sonst reißt
  jeder hohe Sprung das Bild mit hoch, die Figur landet ein Stück weiter
  unten und klebt nach ein paar Sprüngen am unteren Rand (genau daran
  scheiterten Testläufe vorher schon bei Etage 15). Nachgezogen wird
  höchstens mit `CAMERA_CATCHUP` (0,9 px/frame) – langsamer, als man
  klettern kann. Wer Tempo macht, steigt dadurch im Bild nach oben und
  sammelt bis zu `CAMERA_MAX_LAG` (130 px) zusätzliche Luft nach unten;
  genau das macht einen schnellen Lauf sicher. Gezeichnet wird `camera.y`
  = die Basis, vorübergehend weiter hochgeschoben, solange die Figur sonst
  oben aus dem Bild klettern würde – das verschiebt die Basis nicht, das
  Bild kommt nach der Landung von selbst zurück. Aufgeräumt wird ebenfalls
  gegen die Basis: `pruneOldFloors` gegen `camera.y` warf im Sprung Etagen
  weg, die noch klar über der Verlustgrenze lagen – ein Fehlsprung fiel
  dann durch ein Loch aus dem Nichts (gemessen: elf Etagen ohne eine
  einzige Platte).
- **Zeitdruck**: ab Etage `SCROLL_START_FLOOR` (spätestens nach
  `SCROLL_START_MS`) wandert die Basis von selbst nach oben und
  beschleunigt über `SCROLL_RAMP_FLOORS` (1500) Etagen von
  `SCROLL_SPEED_START` (0,4) auf `SCROLL_SPEED_MAX` (1,8 px/frame).
  Vorher waren es 2,6 px/frame schon ab Etage 100 – schneller, als man
  überhaupt klettern kann. Entscheidend ist ohnehin nicht das
  Klettertempo, sondern die Sekunden nach einem Fehlsprung: da steigt man
  kaum, und die Kamera frisst den Puffer.
- **Score** = erreichte Etage × `POINTS_PER_FLOOR` + Combo-Punkte. Jede
  zehnte Etage ist farblich hervorgehoben, die Etagennummern stehen am
  linken Rand.
- **Welten**: alle `FLOOR_THEME_EVERY` (100) Etagen wechselt die Optik
  durch zehn Welten – Plattform-Deko (`drawDeco` in `sprites.js`) **und**
  Hintergrund (`js/background.js`): eigener Himmelsverlauf, ein Deko-Feld
  mit Parallaxe (Wolken, Rohre, Säulen, Blasen, Glut, Zahnräder, Bonbons,
  Leiterbahnen, Blitze, Sterne) und passend eingefärbte Seitenwände. Das
  Deko-Feld ist aus den Zellkoordinaten gehasht statt gewürfelt: derselbe
  Ausschnitt sieht beim Zurückfallen wieder gleich aus und muss nirgends
  gespeichert werden. Beim Wechsel blendet der Hintergrund über
  `BG_FADE_MS` um, ein harter Schnitt mitten im Sprung würde reißen.
  Ganz oben endet der Turm im All (DEEP SPACE), danach beginnt die Reihe
  von vorn. Bei jedem Wechsel zieht der englische Weltname groß auf;
  geprüft wird dabei der Welt-Index, nicht die Etagennummer, weil die
  100er-Etage per Combo auch übersprungen werden kann.
- **Figuren**: vier auswählbare Skins, im Menü umschaltbar und lokal
  gespeichert.
- **Verloren** ist, wer komplett unter den sichtbaren Bildausschnitt
  fällt – ohne Puffer, sobald die Figur weg ist, ist die Runde vorbei.
  Es gibt keine andere Verlustbedingung.

## Rundenlänge (gemessen)

Ziel war eine Runde von mindestens drei Minuten (Poki bewertet das). Mit
drei Bot-Profilen über je sechs Runden gegengetestet (`getDebugState()`
und ein Steuer-Bot im Browser, alle Runden parallel in eigenen Tabs):

| Profil | Beschreibung | Median | ≥ 3 min | Etage |
| --- | --- | --- | --- | --- |
| aktiv | läuft durchgehend Vollgas, wechselt an den Wänden | 200 s+ | 6/6 | 730–780 |
| mittel | 70 % Tempo, 10 % Pausen | 200 s | 3/6 | 360–650 |
| stur | rührt die Steuerung überhaupt nicht an | 165 s | 0/4 | 280–360 |

Vor diesen Änderungen endete dasselbe mittlere Profil nach **8–25
Sekunden** bei Etage 13–60. Dass "stur" am Ende trotzdem untergeht, ist
Absicht: stehen bleiben muss die Runde kosten.

## Bewusst offen gelassen / noch zu tunen

- **Neigungs-Schwellwert** (`TILT_STEER_MAX_DEG`) ist ein Platzhalter –
  im Entwicklungscontainer stand kein Gyroskop zum Kalibrieren zur
  Verfügung. Mit `?debug` live nachjustieren (siehe oben).
- **Schwierigkeitskurve über eine volle Runde** – `SCROLL_RAMP_FLOORS`
  und `PLANK_RAMP_FLOORS` sind jetzt über Bot-Läufe gegengetestet (siehe
  oben), aber nur gegen Bots: wie es sich mit echter Neigung anfühlt,
  muss auf dem Handy nachjustiert werden.
- **Bewegliche/kaputte Etagen, Power-Ups** – im Original später dazu,
  hier erstmal Kernmechanik + Combo + Zeitdruck.
