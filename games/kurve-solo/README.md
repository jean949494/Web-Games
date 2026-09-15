# Kurve Solo

Arcade-Prototyp (Canvas, Vanilla JS, keine Build-Abhängigkeiten). Eigener
Name und eigener Look, inspiriert von der Genre-Mechanik "Kurve ziehen,
Kollision = Tod" (siehe Original-Spec-Dokument) – keine Original-Assets
oder der Originaltitel wurden übernommen.

**Endlos-Modus** (Stand: zweiter Umbau, siehe "Änderungen" unten): der
Punkt steigt endlos nach oben (Kamera folgt, wie bei Ninja Wandsprung)
und zieht dabei seine Linie mit gelegentlichen Lücken hinter sich her.
Waagerechte Hindernis-Balken mit einer Lücke stehen im Weg, durch die
man lenken muss. Das Spielfeld wird mit der Höhe schmaler und die
Hindernis-Lücken springen stärker hin und her – es wird also mit der
Zeit **enger und verzwickter**. Kollision mit Spielfeldrand, Hindernis
oder eigener Linie = Tod. Ziel: möglichst hoch kommen.

Kernphysik-Werte stammen 1:1 aus dem ursprünglichen Spec-Dokument der
Prototyp-Phase (Chat/Visualizer) – siehe `js/constants.js`, jeder Wert
dort kommentiert. Nicht ohne erneutes Playtesting verändern.

## Änderungen gegenüber der ursprünglichen Spec

Die ursprüngliche Spec beschrieb "Solo gegen 3 KI-Bots" in einem festen
340×480-Feld (siehe Original-Spec-Dokument). Nach dem ersten Testspielen
kam der Wunsch nach einem echten Endlos-Modus statt Bots:

- **Bots entfernt** – reiner Single-Player.
- **Endlos statt festes Feld**: Kamera scrollt endlos nach oben (analog
  Ninja Wandsprung) statt eines festen 340×480-Kastens.
- **Hindernisse statt Bot-Linien**: waagerechte Balken mit einer Lücke
  (siehe `js/game.js`, `ensureObstaclesAhead`/`checkObstacleCollision`).
- **Steigende Schwierigkeit**: Feldbreite und Hindernis-Lücke schrumpfen
  mit der Höhe, die Lücken-Position springt stärker – damit ist der
  Punkt "Schwierigkeit über die Zeit steigern (Feld verengt sich
  langsam)" aus der ursprünglichen Spec (dort als "noch offen"
  markiert) umgesetzt.

Kernmechanik (konstante Geschwindigkeit, Lenken nur links/rechts,
Linie mit Lücken, Kollision mit Wand/eigener Linie) ist unverändert
1:1 aus der Original-Spec übernommen.

## Starten

Kein Build-Schritt nötig, `index.html` kann direkt in jedem modernen
Browser geöffnet werden. Für die Entwicklung mit Live-Reload:

```
npm run dev
```

Das Spiel liegt dann unter `http://localhost:5173/games/kurve-solo/`
(oder über die Übersicht auf `http://localhost:5173/`). Details siehe
`../../DEV.md` im Repo-Root (Dev-Server & Deploy-Workflow).

## Struktur

- `index.html` – Markup + Overlay-Screens (Menü, Pause, Game Over)
- `style.css` – Layout, responsive Skalierung auf 340×480-Referenz
- `js/constants.js` – alle Werte (Physik, Endlos-Rampen für
  Feldbreite/Hindernisse)
- `js/game.js` – Zustandsmaschine, Physik-Loop (fix 60Hz), Kamera,
  Hindernis-Generierung, Kollision, Rendering
- `js/input.js` – Touch- (Pointer Events) und Tastatursteuerung
- `js/particles.js` – Partikel-Burst beim Tod
- `js/sounds.js` – kurve-spezifische Ton-Sequenzen auf Basis von
  `shared/audio.js`
- `js/main.js` – Bootstrap, Overlay-Verdrahtung, Bühnen-Skalierung

Die geteilten Module (`storage.js`, `audio.js`, `analytics.js`,
`poki.js`) liegen in [`../../shared/`](../../shared/) – siehe README im
Repo-Root, Abschnitt "Gemeinsames Grundgerüst".

## Umgesetzt aus der Spec

- Kernmechanik 1:1: `SPEED` (1.7 px/frame), `TURN` (0.05 rad/frame),
  `THICK` (3px), Kollisionsradius mit Faktor 2.2 auf `THICK²`
- Zufällige Lücken: ca. 0.6% Chance/Frame auf eine 12-Frame-Lücke,
  solange keine aktive Lücke läuft
- Eigenkollision ignoriert die letzten 10 gezeichneten Punkte
- Touch-Steuerung: linke/rechte Bildschirmhälfte halten, nur Pointer
  Events (keine Redundanz-Lösung, siehe Spec-Hinweis zur
  Chat-Iframe-Testumgebung)
- Gelöstes Problem aus der Spec: ein Tap nach Game Over startet
  gleichzeitig neu UND lenkt – das gesamte Game-Over-Overlay ist der
  Tap-Bereich, kein separater Restart-Button nötig (siehe `js/input.js`)
- Schwierigkeit über die Zeit steigend (siehe "Änderungen" oben):
  Feldbreite und Hindernis-Lücke schrumpfen mit der Höhe, Hindernis-
  Position springt stärker
- Grundgerüst: Menü, Pause, Game Over, Highscore lokal (geteilter
  Storage), Sound an/aus, Touch- **und** Tastatursteuerung
  (Pfeiltasten/A-D, Esc = Pause), Analytics-Event-Hooks, Poki-SDK als
  austauschbares Modul
- Design-Leitplanken: kein Tutorial-Text (nur eine Zeile Hinweis
  "Linke/rechte Seite halten"), sofortiger Start ohne Login, ein Tap zum
  Neustart, Minimal-Menü, kindgerechte Optik (freundlicher "Puff"- statt
  Crash-Sound)
- Juice: Partikel-Burst beim Tod, leichter Screen-Shake

## Bewusst offen gelassen

- **Genaues Balancing der Rampen** (`WIDTH_RAMP_RANGE`,
  `OBSTACLE_RAMP_RANGE`, `OBSTACLE_JITTER_MAX` in `constants.js`) sind
  Platzhalter, mit einem einfachen automatisierten Testlauf
  (proportionale Steuerung Richtung nächster Lücke) auf ca. 30–40
  Sekunden Überlebenszeit bis zum Tod kalibriert – für echtes
  menschliches Spielgefühl mit `npm run dev` gegenspielen und anpassen.
- **Zusätzliche Juice-Elemente** (z.B. Ton beim knappen Vorbeifliegen an
  einem Hindernis, wie Ninjas "Knapp!"-Flash) – nicht umgesetzt, um den
  Umbau überschaubar zu halten; wäre eine einfache spätere Ergänzung.
- **Build-Skript für Portal-Export** – aktuell reicht der Ordner als
  statische Seite; ein Poki-spezifisches Zip/Export-Skript kommt erst,
  wenn die Einreichung ansteht.
- **Portal-Strategie** – laut Ninja-Spec zuerst exklusiv bei Poki
  einreichen, andere Portale erst bei Absage. Reine
  Prozessentscheidung, keine Code-Änderung.

## Annahmen / Interpretationen

- **Score** = höchster je erreichter Punkt (px Höhe), analog zur
  Höhen-Logik in Ninja Wandsprung – fällt nicht mit, falls kurz
  rückwärts/abwärts gelenkt wird. Alte Highscores aus der
  Bots-Version (Score = überlebte Frames) sind mit diesem Umbau
  nicht mehr vergleichbar und werden vom neuen, deutlich größeren
  Höhen-Score schnell überholt.
- **Speicher-/Kollisions-Begrenzung für echte Endlosigkeit**: alte
  Linienpunkte und Hindernisse, die weit unterhalb der Kamera liegen,
  werden regelmäßig gelöscht (`pruneOld()`), damit eine lange Session
  nicht immer langsamer wird.
- **Rückwärts-Sicherheitsnetz**: wer absichtlich abwärts lenkt, wird
  irgendwann durch `FALL_MARGIN` beendet (man kann also nicht durch
  Stillstand/Rückwärtslenken die Verengung dauerhaft umgehen).
- **Hindernis-Optik**: Balken statt Original-Stacheln, in einer eigenen
  Warnfarbe (Amber) statt der Ninja-Stachel-Farbe, damit beide Spiele
  visuell unterscheidbar bleiben.
