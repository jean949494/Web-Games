# Eisturm

Icy-Tower-Prototyp (Canvas, Vanilla JS, keine Build-Abhängigkeiten):
Etagen erklimmen, Anlauftempo und Haltedauer bestimmen die Sprunghöhe,
an den Seitenwänden prallt man mit vollem Schwung ab, mehrere Etagen in
einem Sprung starten eine Combo-Serie. Der Bildausschnitt wandert von
selbst nach oben und wird immer schneller – wer stehen bleibt oder zu
tief zurückfällt, fällt unten raus.

## Steuerung

- **Handy links/rechts neigen** – laufen, stufenlos: je stärker geneigt,
  desto schneller
- **Antippen** (egal wo) – springen; **länger gedrückt halten springt
  höher**, kurzes Tippen gibt nur einen kleinen Hüpfer

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
- `style.css` – Layout, responsive Skalierung auf 340×480-Referenz
- `js/constants.js` – Physik, Etagen, Kamera/Scroll, Combo, Neigung
- `js/game.js` – Zustandsmaschine, Physik-Loop (fix 60Hz), Rendering,
  Etagen-Kollision, Wandabprall, Combo-Wertung, Auto-Scroll-Kamera
- `js/input.js` – Neigung (Lenken), Antippen/Halten (Sprunghöhe), Tastatur
- `js/particles.js` – Landestaub, Wandabprall-Funken
- `js/sounds.js` – spielspezifische Ton-Sequenzen (aufbauend auf
  `shared/audio.js`)

## Mechanik im Detail

- **Etagen** sind schmale Plattformen, von unten immer durchspringbar –
  beim Steigen gibt es nie ein Hindernis. Beim Fallen entscheidet die
  Position: über der Plattform = Landung (die Figur steht oben auf der
  Kante), daneben = weiterfallen zur nächsten Etage darunter.
- **Sprunghöhe** = Anlauftempo + Haltedauer. Der Absprung setzt
  `JUMP_VY_BASE + JUMP_VY_BONUS * Tempo-Anteil`; das Loslassen kappt
  einen noch steigenden Sprung auf `JUMP_CUT_FACTOR` (mindestens
  `JUMP_VY_MIN`, damit ein kurzer Tipp nie völlig ins Leere geht).
- **Wandabprall**: an den Seitenwänden geht es mit `WALL_BOUNCE` des
  Schwungs zurück. Für `WALL_LOCK_MS` ignoriert die Figur dabei die
  Steuerung – sonst würde die weiterhin gehaltene Richtung sie sofort
  wieder in die Wand ziehen und der Abpraller verpuffen.
- **Combo**: Etagen, die in EINEM Sprung übersprungen werden (ab
  `COMBO_MIN_FLOORS`), starten eine Serie. Solange innerhalb von
  `COMBO_WINDOW_MS` nachgelegt wird, läuft die Serie weiter, der
  Multiplikator steigt je `COMBO_FLOORS_PER_MULT` Serien-Etagen. Oben
  läuft dazu ein Restzeit-Balken, bei jedem Combo-Sprung ploppt eine
  Stufen-Meldung auf ("Gut!" bis "UNFASSBAR!", siehe `COMBO_LABELS`).
- **Zeitdruck**: ab Etage `SCROLL_START_FLOOR` (spätestens nach
  `SCROLL_START_MS`) wandert die Kamera von selbst nach oben und
  beschleunigt über `SCROLL_RAMP_FLOORS` Etagen von
  `SCROLL_SPEED_START` auf `SCROLL_SPEED_MAX`. Sie folgt zusätzlich dem
  Aufstieg, zieht aber nur weich nach (`CAMERA_FOLLOW_LERP`), damit ein
  Riesensprung einen nicht anschließend am unteren Bildrand kleben lässt.
- **Score** = erreichte Etage × `POINTS_PER_FLOOR` + Combo-Punkte. Jede
  zehnte Etage ist farblich hervorgehoben, die Etagennummern stehen am
  linken Rand.
- **Verloren** ist nur, wer `FALL_MARGIN` unter den Bildausschnitt
  fällt. Es gibt keine andere Verlustbedingung.

## Bewusst offen gelassen / noch zu tunen

- **Neigungs-Schwellwert** (`TILT_STEER_MAX_DEG`) ist ein Platzhalter –
  im Entwicklungscontainer stand kein Gyroskop zum Kalibrieren zur
  Verfügung. Mit `?debug` live nachjustieren (siehe oben).
- **Schwierigkeitskurve über eine volle Runde** – `SCROLL_RAMP_FLOORS`
  und `PLANK_RAMP_FLOORS` sind erste Schätzwerte, noch nicht über viele
  Runden gegengetestet.
- **Bewegliche/kaputte Etagen, Power-Ups** – im Original später dazu,
  hier erstmal Kernmechanik + Combo + Zeitdruck.
