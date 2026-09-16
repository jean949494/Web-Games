# Eisturm

Icy-Tower-Prototyp (Canvas, Vanilla JS, keine Build-Abhängigkeiten):
Etagen erklimmen, Anlauftempo bestimmt Sprunghöhe/-weite, mehrere Etagen
in einem Sprung übersteigen bringt einen Combo-Bonus. Ziel: möglichst
hoch kommen.

Steuerung ist bewusst neu gegenüber dem Original (kein Tastatur-Timing),
angelehnt an Doodle Jump. Über das ⚙️-Einstellungen-Icon im Menü lässt
sich zwischen zwei Modi wählen (lokal gespeichert, nur einer ist
gleichzeitig aktiv, damit sich Neigung und Halten/Tippen nicht in die
Quere kommen – siehe `js/settings.js`):

- **Neigung** (Standard): Handy links/rechts neigen lenkt, stufenlos,
  je stärker geneigt desto schneller. Kurz antippen löst den Sprung aus.
- **Halten**: linke/rechte Bildschirmhälfte **halten** lässt in die
  Richtung laufen (wie bei Kurve Solo). Handy **Richtung Gesicht
  kippen** löst den Sprung aus.

Tastatur am PC läuft unabhängig vom gewählten Modus immer mit:
Pfeiltasten/A+D halten = laufen, Leertaste/Pfeil-hoch = springen,
ESC = Pause.

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
Rechner testest du am besten mit der Tastatur oder per Maus-Halten auf
einer Bildschirmhälfte. Auf dem Handy im selben WLAN funktioniert auch
die echte Neigung, siehe "Im WLAN"-Adresse in der `npm run dev`-Ausgabe.

Mit `?debug` in der URL (z.B.
`http://192.168.x.x:5173/games/eisturm/?debug`) zeigt das Spiel oben
links live die aktuellen Neigungs-Deltas an – nützlich, um die
Schwellwerte in `js/constants.js` (`TILT_STEER_MAX_DEG`,
`TILT_JUMP_TRIGGER_DEG`, `TILT_JUMP_SIGN`) auf dem eigenen Handy
nachzujustieren.

## Struktur

- `index.html` – Markup + Overlay-Screens (Menü, Pause, Game Over)
- `style.css` – Layout, responsive Skalierung auf 340×480-Referenz
- `js/constants.js` – Physik-, Etagen- und Neigungs-Konstanten
- `js/settings.js` – gewählter Steuerungsmodus (Neigung/Halten), lokal
  gespeichert
- `js/game.js` – Zustandsmaschine, Physik-Loop (fix 60Hz), Rendering,
  Etagen-Kollision (Landung/Anstoßen/Durchqueren), Combo-Wertung
- `js/input.js` – Neigung, Antippen/Halten, Tastatur, je nach Modus aus
  `settings.js` geschaltet
- `js/particles.js` – Landestaub, Anstoß-Funken
- `js/sounds.js` – spielspezifische Ton-Sequenzen (aufbauend auf
  `shared/audio.js`)

## Mechanik im Detail

- Etagen sind waagerechte Linien mit einer Lücke. Beim **Steigen**
  außerhalb der Lücke gekreuzt = Anstoßen, der Sprung endet sofort
  (Strafe fürs Verfehlen, wie im Original). Beim **Fallen** außerhalb
  der Lücke gekreuzt = Landung. Innerhalb der Lücke wird jede Etage
  einfach durchquert.
- Sprunghöhe/-weite hängt vom aktuellen Lauftempo beim Absprung ab
  (`JUMP_VY_BASE` + `JUMP_VY_BONUS * Tempo-Anteil`) – schneller Anlauf
  vor dem Sprung erlaubt, mehrere Etagen in einem Rutsch zu überspringen.
- Combo: jede Etage, die während eines einzelnen Sprungs im Steigflug
  durch die Lücke passiert wird, zählt mit. Ab 2 Etagen gibt es einen
  Punktebonus und eine kurze Einblendung bei der Landung.
- Schwierigkeit: die Lücken werden mit steigender Höhe schmaler
  (`GAP_WIDTH_START` -> `GAP_WIDTH_TARGET` über `GAP_RAMP_RANGE` px).

## Bewusst offen gelassen / noch zu tunen

- **Neigungs-Schwellwerte** (`TILT_STEER_MAX_DEG`,
  `TILT_JUMP_TRIGGER_DEG`, `TILT_JUMP_REARM_DEG`, `TILT_JUMP_SIGN`) sind
  Platzhalter – im Entwicklungscontainer stand kein Gyroskop zum
  Kalibrieren zur Verfügung. Mit `?debug` live nachjustieren (siehe
  oben), ggf. `TILT_JUMP_SIGN` auf `-1` drehen, falls der Sprung beim
  Kippen in die falsche Richtung reagiert.
- **Schwierigkeitskurve über eine volle Runde** – `GAP_RAMP_RANGE` ist
  ein erster Schätzwert, noch nicht über viele Runden gegengetestet.
- **Bewegliche/kaputte Etagen, Power-Ups** – im Original später dazu,
  hier erstmal nur die Kernmechanik (Etage + Lücke + Combo).
