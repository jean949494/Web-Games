# Kurve Solo

Arcade-Prototyp (Canvas, Vanilla JS, keine Build-Abhängigkeiten). Eigener
Name und eigener Look, inspiriert von der Genre-Mechanik "Kurve ziehen,
Kollision = Tod" (siehe Original-Spec-Dokument) – keine Original-Assets
oder der Originaltitel wurden übernommen.

**Endlos-Modus, Hardcore-Tuning** (dritter Umbau, siehe "Änderungen"
unten): der Punkt steigt endlos nach oben (Kamera folgt, wie bei Ninja
Wandsprung) und zieht dabei eine **durchgehende** Linie hinter sich her.
Waagerechte Hindernis-Balken mit einer Lücke stehen im Weg, ab einer
gewissen Höhe kommen einzelne Gegner dazu, um die man herumschlängeln
muss. Spielfeldbreite, Hindernis-Lücke und Gegner-Dichte werden mit der
Höhe **ohne Plateau** immer enger/knapper/verzwickter. Gelegentlich gibt
es ein Power-Up (kurzer Tempo-Boost + Unverwundbarkeit), das absichtlich
weit von der sicheren Lücke entfernt liegt – ein riskanter Bonus.
Kollision mit Spielfeldrand, Hindernis, Gegner oder eigener Linie = Tod.
Ziel: möglichst hoch kommen.

Kernphysik-Werte (Geschwindigkeit, Lenkrate, Linienstärke, Kollisions-
faktor) stammen 1:1 aus dem ursprünglichen Spec-Dokument der Prototyp-
Phase (Chat/Visualizer) – siehe `js/constants.js`, jeder Wert dort
kommentiert. Nicht ohne erneutes Playtesting verändern.

## Änderungen gegenüber der ursprünglichen Spec

Die ursprüngliche Spec beschrieb "Solo gegen 3 KI-Bots" in einem festen
340×480-Feld (siehe Original-Spec-Dokument). Nach zwei Playtest-Runden
sind das jetzt drei Umbauten in Folge:

1. **Bots → Endlos-Modus**: kein festes Feld/Bots mehr, sondern ein
   echter Single-Player-Endlos-Climber (Kamera scrollt endlos nach
   oben) mit Hindernis-Balken statt Bot-Linien.
2. **Hardcore-Tuning** (dieser Umbau), nach dem Feedback "viel zu
   leicht, 0 Herausforderung":
   - **Keine feste Ramp mehr, die irgendwann stehenbleibt.** Vorher
     erreichten Feldbreite/Hindernis-Lücke bei Höhe ~7600 ihren
     Minimalwert und blieben danach für den Rest der Runde
     unverändert – das fühlte sich nach der Anfangsphase komplett
     flach an. Jetzt nähern sich Feldbreite, Hindernis-Lücke,
     Hindernis-Abstand und Zickzack-Stärke einem Zielwert nur noch
     *asymptotisch* an (`constants.approach()`, HALF_LIFE-Kurve wie ein
     radioaktiver Zerfall) – es wird auch nach Stunden theoretisch
     noch (wenn auch immer langsamer) enger, nie ein echtes Plateau.
     Zum Vergleich: bei Höhe 7600 (altes Plateau) ist die neue Kurve
     schon spürbar enger als das alte Maximum; bei Höhe 15.000 ist sie
     nochmal deutlich enger als das.
   - **Zufällige Lücken in der eigenen Linie entfernt.** Die gab's im
     Original nur für Mehrspieler-Fairness (damit gegnerische Kurven
     aneinander vorbeikommen). Ohne Gegner-Kurven ist das nur noch ein
     kostenloses, unverdientes Entkommen – jetzt ist die eigene Linie
     immer und überall tödlich (außer den letzten paar selbst
     gezeichneten Punkten, sonst crasht man sofort in sich selbst).
   - **Gegner** (`js/game.js`, `checkEnemyCollision`): ab Höhe
     `ENEMY_START_HEIGHT` (Platzhalter: 3500) tauchen zusätzlich zu den
     Hindernis-Balken einzelne Gegner-Punkte im offenen Korridor auf,
     die umschlängelt werden müssen – eine zusätzliche Schicht für
     Fortgeschrittene, kommt bewusst erst "später". Ab der noch
     späteren Höhe `ENEMY_MOVE_START_HEIGHT` (Platzhalter: 7000) fangen
     neu gespawnte Gegner zusätzlich an, langsam seitlich zu pendeln
     (`updateEnemies()`) statt starr zu stehen.
   - **Power-Up**: kurzer Geschwindigkeits-Boost + Unverwundbarkeit
     (`player.invincibleFrames`). Wird absichtlich mit Abstand zur
     sicheren Hindernis-Lücke platziert (`POWERUP_MIN_OFFSET_FROM_GAP`)
     – man muss extra dafür abweichen und danach scharf zurück zur
     Lücke lenken, echtes Risiko für den Bonus.
   - **Steuerungs-Hinweis**: am Rundenstart kurz eine halbtransparente
     Einblendung, die beide Bildschirmhälften mit Pfeilen (◀ / ▶)
     markiert – ganz ohne Text, verschwindet von selbst.
3. **Zweite Tuning-Runde**, nach weiterem Feedback ("immer noch zu
   leicht", "zu viele Perks" → dann wieder zurückgenommen, "Perk-Ende
   ohne Vorwarnung", "Erklärung zu lang"):
   - Rampen deutlich beschleunigt (kleinere `HALF_LIFE`-Werte) und
     `OBSTACLE_GAP_START`/`OBSTACLE_GAP_TARGET` gesenkt – die
     Hindernis-Lücke ist von Anfang an und über die ganze Runde
     spürbar enger.
   - Power-Up-Häufigkeit wurde testweise gesenkt, auf Wunsch aber
     wieder auf den ursprünglichen Wert zurückgesetzt
     (`POWERUP_CHANCE_PER_OBSTACLE`).
   - Der Kopf blinkt während des Power-Ups nicht mehr durchgehend,
     sondern nur noch in den letzten `POWERUP_WARNING_FRAMES` (~0,75s)
     davor, dass es endet – klares "gleich vorbei"-Signal statt
     Dauerblinken. Währenddessen zeigt ein steady Farbring in der
     Power-Up-Farbe durchgehend an, dass man gerade unschlagbar ist.
   - Steuerungs-Hinweis-Dauer deutlich verkürzt (`CONTROL_HINT_FRAMES`).

Kernmechanik (konstante Geschwindigkeit, Lenken nur links/rechts,
Kollision mit Wand/eigener Linie) bleibt unverändert 1:1 aus der
Original-Spec übernommen.

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
- `js/constants.js` – alle Werte (Physik, Endlos-Rampen für Feldbreite/
  Hindernisse/Gegner/Power-Up, `approach()`-Helfer für die
  plateau-freie Annäherungskurve)
- `js/game.js` – Zustandsmaschine, Physik-Loop (fix 60Hz), Kamera,
  Hindernis-/Gegner-/Power-Up-Generierung, Kollision, Rendering,
  Steuerungs-Hinweis-Overlay
- `js/input.js` – Touch- (Pointer Events) und Tastatursteuerung
- `js/particles.js` – Partikel-Burst bei Tod/Power-Up-Pickup
- `js/sounds.js` – kurve-spezifische Ton-Sequenzen auf Basis von
  `shared/audio.js`
- `js/main.js` – Bootstrap, Overlay-Verdrahtung, Bühnen-Skalierung

Die geteilten Module (`storage.js`, `audio.js`, `analytics.js`,
`poki.js`) liegen in [`../../shared/`](../../shared/) – siehe README im
Repo-Root, Abschnitt "Gemeinsames Grundgerüst".

## Umgesetzt aus der Spec

- Kernmechanik 1:1: `SPEED` (1.7 px/frame), `TURN` (0.05 rad/frame),
  `THICK` (3px), Kollisionsradius mit Faktor 2.2 auf `THICK²`
- Eigenkollision ignoriert nur die letzten 10 gezeichneten Punkte,
  sonst ist die eigene Linie überall tödlich (siehe "Änderungen" oben)
- Touch-Steuerung: linke/rechte Bildschirmhälfte halten, nur Pointer
  Events (keine Redundanz-Lösung, siehe Spec-Hinweis zur
  Chat-Iframe-Testumgebung)
- Gelöstes Problem aus der Spec: ein Tap nach Game Over startet
  gleichzeitig neu UND lenkt – das gesamte Game-Over-Overlay ist der
  Tap-Bereich, kein separater Restart-Button nötig (siehe `js/input.js`)
- Schwierigkeit über die Zeit steigend, ohne Plateau (siehe
  "Änderungen" oben)
- Grundgerüst: Menü, Pause, Game Over, Highscore lokal (geteilter
  Storage), Sound an/aus, Touch- **und** Tastatursteuerung
  (Pfeiltasten/A-D, Esc = Pause), Analytics-Event-Hooks, Poki-SDK als
  austauschbares Modul
- Design-Leitplanken: kein Tutorial-**Text** (der Steuerungs-Hinweis am
  Rundenstart ist reine Grafik, keine Wörter), sofortiger Start ohne
  Login, ein Tap zum Neustart, Minimal-Menü, kindgerechte Optik
  (freundlicher "Puff"- statt Crash-Sound, Gegner mit Augen statt
  bedrohlicher Spitzen)
- Juice: Partikel-Burst bei Tod und Power-Up-Pickup, leichter
  Screen-Shake, blinkende Unschlagbarkeits-Animation

## Bewusst offen gelassen

- **Genaues Balancing** (`WIDTH_HALF_LIFE`, `GAP_HALF_LIFE`,
  `ENEMY_START_HEIGHT`, `POWERUP_*` in `constants.js`) sind Platzhalter
  nach einem groben automatisierten Testlauf kalibriert (ein simpler
  Bot, der proportional zur nächsten Lücke lenkt, stirbt jetzt nach
  ca. 13–20s statt vorher 30–40s) – für echtes menschliches
  Spielgefühl mit `npm run dev` gegenspielen und die HALF_LIFE-Werte
  anpassen (kleiner = schneller schwerer).
- **Gegner-Bewegung ist ein simples Sinus-Pendeln** (feste Amplitude/
  Geschwindigkeit, kein Ausweich- oder Verfolgungsverhalten). Reicht
  für "umschlängeln müssen", eine raffiniertere KI wäre eine mögliche
  spätere Ausbaustufe.
- **Build-Skript für Portal-Export** – aktuell reicht der Ordner als
  statische Seite; ein Poki-spezifisches Zip/Export-Skript kommt erst,
  wenn die Einreichung ansteht.
- **Portal-Strategie** – laut Ninja-Spec zuerst exklusiv bei Poki
  einreichen, andere Portale erst bei Absage. Reine
  Prozessentscheidung, keine Code-Änderung.

## Annahmen / Interpretationen

- **Score** = höchster je erreichter Punkt (px Höhe), analog zur
  Höhen-Logik in Ninja Wandsprung – fällt nicht mit, falls kurz
  rückwärts/abwärts gelenkt wird.
- **Speicher-/Kollisions-Begrenzung für echte Endlosigkeit**: alte
  Linienpunkte, Hindernisse, Gegner und Power-Ups, die weit unterhalb
  der Kamera liegen, werden regelmäßig gelöscht (`pruneOld()`), damit
  eine lange Session nicht immer langsamer wird.
- **Rückwärts-Sicherheitsnetz**: wer absichtlich abwärts lenkt, wird
  irgendwann durch `FALL_MARGIN` beendet.
- **Power-Up = "unschlagbar"**: während der Unverwundbarkeit ignoriert
  das Spiel *alle* Kollisionen (Wand, Hindernis, Gegner, eigene Linie)
  komplett, statt nur einzelne Gefahrenquellen zu blocken – klareres
  "jetzt bin ich kurz unbesiegbar"-Gefühl als eine Teil-Immunität.
- **Steuerungs-Hinweis erscheint bei jedem Rundenstart** (nicht nur
  beim allerersten Mal), aber kurz (2,5s) und dezent (max. 30%
  Deckkraft) – hilft neuen Spielern beim Wiedereinstieg nach jedem
  Game Over, ohne erfahrene Spieler zu nerven.
- **Hindernis-/Gegner-Optik**: Balken bzw. kleine Kreise mit
  freundlichen Augen statt Original-Stacheln, in eigenen Warnfarben
  (Amber/Pink) statt der Ninja-Stachel-Farbe, damit beide Spiele
  visuell unterscheidbar bleiben.
