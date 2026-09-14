# Team-Duell

Top-Down-Arcade-Prototyp (Canvas, Vanilla JS, keine Build-Abhängigkeiten).
3 gegen 3: Spieler + 2 KI-Teammates (unten) gegen 3 KI-Gegner (oben),
jede Seite mit eigener Schutzmauer aus 8 Segmenten. Zwei Angriffsarten –
Wasserkanone (Geradeausfeuer, von der gegnerischen Mauer blockierbar) und
Superwurf (Lob über die Mauer hinweg, braucht Vorhalten) – plus drei
Team-Kommandos zum Steuern der eigenen Teammates. Sicherheits-Reskin laut
Spec: keine realistischen Waffen, Treffer nur als abstrakter
Partikel-"Poof".

Das Spec-Dokument der Prototyp-Phase (Chat/Visualizer) liegt unter
[`/specs/team-duell-mauer-spec.md`](../../specs/team-duell-mauer-spec.md).
Alle dort bezifferten Werte sind 1:1 übernommen und in `js/constants.js`
einzeln kommentiert – nicht ohne erneutes Playtesting verändern.

## Starten

Kein Build-Schritt nötig, `index.html` kann direkt in jedem modernen
Browser geöffnet werden. Für die Entwicklung mit Live-Reload:

```
npm run dev
```

Das Spiel liegt dann unter `http://localhost:5173/games/team-duell/`
(oder über die Übersicht auf `http://localhost:5173/`). Details siehe
`../../DEV.md` im Repo-Root (Dev-Server & Deploy-Workflow).

**Wichtig laut Spec:** Die drei Sticks unbedingt früh auf einem echten
Handy testen (`npm run deploy`), nicht nur am Rechner mit der Maus –
siehe "Bekannte offene Punkte" unten.

## Struktur

- `index.html` – Markup: Canvas-Bühne (Menü/Pause/Sieg-Overlay) +
  separate, nicht mitskalierte Steuerungsleiste (`#controls`)
- `style.css` – Layout, responsive Skalierung der Bühne auf
  340×480-Referenz; Sticks/Kommando-Buttons bewusst als fixe
  Overlay-Leiste außerhalb der Skalierung (siehe Kommentar dort)
- `js/constants.js` – alle Spec-Werte + dokumentierte Annahmen
- `js/wall.js` – Mauer-Segmente: Treffer, Schwächung, Lücken, Zeichnen
- `js/projectiles.js` – Schuss (Mauer-Kollision) und Wurf (Lob mit
  Landeprüfung), Bewegung + Zeichnen
- `js/ai.js` – Teammate-Formationen nach Kommando, Gegner-Formation,
  Feuer-/Wurf-Entscheidungen für alle KI-Einheiten
- `js/game.js` – Zustandsmaschine, Physik-Loop (fix 60Hz), Team-HP,
  Sieg-/Niederlage-Bedingung, Rendering-Orchestrierung
- `js/input.js` – drei Sticks (Pointer Events, Multi-Touch-fähig via
  `setPointerCapture`) + Kommando-Buttons + Tastatur-Testkomfort
- `js/particles.js` – Poof-/Splash-Partikel bei Treffern
- `js/sounds.js` – team-duell-spezifische Ton-Sequenzen auf Basis von
  `shared/audio.js`
- `js/main.js` – Bootstrap, Overlay-Verdrahtung, Bühnen-Skalierung

Die geteilten Module (`storage.js`, `audio.js`, `analytics.js`,
`poki.js`) liegen in [`../../shared/`](../../shared/) – siehe README im
Repo-Root, Abschnitt "Gemeinsames Grundgerüst".

## Umgesetzt aus der Spec

- Kernkonzept 1:1: Sicht von oben, Spieler unten/Gegner oben, 3 gegen 3,
  je Seite ein Team-HP-Pool (140, Spec: "bewusste Vereinfachung")
- Mauer: 8 Segmente je Seite, Segment-HP 60, Schaden 15/Treffer
  (~4 Treffer bis zur Lücke), Dicke 8px (Spec: bewusst 30% kleiner als
  ursprünglich 12px – siehe "Annahmen" unten zur offenen Frage
  Dicke/Breite)
- Schuss wird ausschließlich vom getroffenen Segment blockiert und
  schwächt nur dieses; bei 0 HP entsteht eine dauerhafte Lücke, durch
  die nachfolgende Schüsse ungehindert fliegen
- Wurf fliegt über jede Mauer hinweg, trifft nur bei ausreichender Nähe
  zum tatsächlichen Zielort bei Landung (nicht zum Zeitpunkt des Wurfs) –
  bewegliche Ziele erfordern Vorhalten, gilt symmetrisch auch für die
  KI (siehe `ai.js`, `decideThrow`)
- Schadenswerte 1:1: Schuss auf Einheit 8 (Spieler-Team trifft Gegner),
  gegnerischer Schuss auf Spieler-Team 10, Wurf-Treffer 22
- Bewegungsgeschwindigkeit Spieler 2.6px/frame, Bullet-Geschwindigkeit
  3.2px/frame
- Drei runde Sticks mit den Spec-Radien (Bewegung ~84px, Schuss/Wurf je
  ~58px): Bewegung frei im eigenen Feldbereich, Schuss mit
  Totzone + automatischem Intervallfeuer, Wurf als relativer Stick mit
  live sichtbarem Fadenkreuz, Loslassen wirft
- Drei Kommando-Buttons oberhalb der Sticks: Rückzug, Angriff, Deckung –
  ändern die Formation der beiden Teammates relativ zur Spielerposition
- Sicherheits-Reskin: "Wasserkanone"/"Superwurf" statt
  Flammenwerfer/Rakete, abstrakte Kreis-/Partikelformen, Treffer als
  Poof/Splash statt Verletzungsdarstellung
- Grundgerüst ergänzt (laut Spec selbst noch offen): Menü, Pause,
  Sieg-/Niederlage-Screen, Highscore lokal (geteilter Storage), Sound
  an/aus, Analytics-Event-Hooks, Poki-SDK als austauschbares Modul
- Design-Leitplanken: kein Tutorial-Text (nur eine Zeile Hinweis),
  sofortiger Start ohne Login, ein Tap zum Neustart, Minimal-Menü,
  kindgerechte Optik/Sounds

## Bewusst offen gelassen (siehe Spec, "Bekannte offene Punkte")

Laut Spec selbst noch nicht fertig entschieden bzw. braucht echtes
Playtesting auf einem echten Gerät – deshalb hier nicht spekulativ
vorweggenommen:

- **Stick-Gefühl (Radius/Totzone/Empfindlichkeit).** Die Spec sagt
  ausdrücklich, dass das im Chat-Prototyp nicht auf einem echten Gerät
  testbar war. `STICK_DEADZONE` in `constants.js` ist ein Platzhalter –
  mit `npm run deploy` auf einem echten Handy testen und bei Bedarf
  anpassen.
- **Drei gleichzeitige Sticks mit zwei Daumen.** Die Ergonomie der
  aktuellen Anordnung (Bewegung links, Schuss oben rechts, Wurf unten
  rechts) ist nicht abschließend bewertet. Die Spec nennt als möglichen
  Ausweg "Schuss automatisch statt Stick-Richtung" – hier nicht
  umgesetzt, da noch nicht klar ist, ob es überhaupt nötig ist.
- **Schuss- vs. Wurf-Schaden-Balance.** Laut Spec "noch nicht
  gegeneinander getestet". Mit `npm run dev` gegenspielen und bei Bedarf
  `SHOT_DAMAGE_TO_ENEMY`/`SHOT_DAMAGE_TO_PLAYER`/`THROW_HIT_DAMAGE`
  anpassen.
- **Mauerdicke vs. Segmentbreite.** Die Spec merkt selbst an, dass die
  "30% kleiner"-Vorgabe eventuell die Segment-**Breite** statt die
  **Dicke** meinte. Hier wurde die Dicke (12px -> 8px) wie im Wortlaut
  umgesetzt; die Segmentbreite ergibt sich unverändert aus der
  Feldbreite / 8 Segmenten. Falls doch die Breite gemeint war, in
  `constants.js`/`wall.js` anpassen.
- **Build-Skript für Portal-Export / Portal-Strategie** – reine
  Geschäfts-/Prozessentscheidung, keine Code-Änderung (siehe
  `../ninja-wandsprung/README.md` für dieselbe Begründung).

## Annahmen / Interpretationen (Spec war an diesen Stellen nicht exakt)

- **Einzelne Einheiten bleiben immer sichtbar.** Die Spec beschreibt den
  gemeinsamen Team-HP-Pool ausdrücklich als bewusste Vereinfachung
  gegenüber 6 Einheiten mit eigenem Leben und nennt "ein sichtbar
  ausfallender Teammate" explizit als *offenen*, nicht als vergessenen
  Punkt. Deshalb hier: alle 3 Einheiten je Seite bleiben immer auf dem
  Feld, nur der Team-HP-Balken sinkt. Individuelles Ausfallen wäre eine
  spätere, separate Erweiterung.
- **Zonen-Grenzen, Mauer-Y-Position, Start-Aufstellung.** Die Spec gibt
  Canvas-Referenz und Mauer-Segmentzahl vor, aber keine konkreten
  Y-Koordinaten. Beide Mauern liegen spiegelbildlich zur Feldmitte
  (Gegner bei y=140, Spieler bei y=340); Einheiten dürfen sich nur in
  ihrer eigenen Zone bewegen (siehe `FIELD_X_MIN/MAX`,
  `*_ZONE_Y_MIN/MAX` in `constants.js`).
- **Schuss-Trefferradius, Wurf-Trefferradius ("nah genug").** Die Spec
  nennt für "nah genug am Ziel" keinen Wert – `THROW_HIT_RADIUS` (24px)
  und `BULLET_HIT_RADIUS` (13px) sind großzügige Annahmen, die sich auf
  einem kleinen Touch-Bildschirm fair anfühlen sollen.
- **Wurf-Reichweite und -Flugzeit.** `THROW_RANGE` (280px, volle
  Stick-Auslenkung) und `THROW_FLIGHT_SPEED` (3.6px/frame-äquivalent)
  sind Annahmen, da die Spec nur "relativer Stick, Auslenkung bestimmt
  Zielpunkt" ohne Zahlen beschreibt.
- **Team-Kommando-Offsets und Gegner-KI-Verhalten.** Die Spec beschreibt
  die drei Kommandos nur verbal ("ziehen sich zurück" / "rücken weit
  vor" / "folgen eng"). Konkrete Zieloffsets in `ai.js`
  (`teammateFormationTarget`) sind Annahmen. Für die Gegner-KI nennt die
  Spec kein eigenes Kommando-System; hier halten die Gegner eine lockere
  Formation mit leichtem Drift und ziehen sich bei niedrigem eigenem
  Team-HP automatisch zurück – eine Annahme für organischeres,
  reaktives Wirken statt einer starren Formation.
- **Kein Default-Kommando vor dem ersten Tastendruck.** Die Spec sagt
  nicht, wie sich Teammates verhalten, bevor der Spieler zum ersten Mal
  einen Kommando-Button drückt. Hier: Start mit "Deckung" als
  naheliegendstem Default (Button ist von Rundenbeginn an markiert).
- **Score = verbleibendes eigenes Team-HP bei Sieg.** Die Spec nennt
  explizit kein Punktesystem ("Highscore/Sieg-Screen... fehlen noch").
  Verbleibendes Team-HP beim Sieg (0–140) drückt aus, wie "sauber"
  gewonnen wurde und ist ein naheliegender Highscore-Wert für ein Duell;
  bei einer Niederlage wird kein neuer Rekord gewertet.
- **Kein Freundschaftsfeuer.** Schüsse/Würfe prüfen nur Treffer gegen
  die jeweils gegnerische Seite, nie gegen die eigenen Mitspieler –
  auch wenn ein Schuss technisch rückwärts durch die eigene Formation
  fliegt. Vereinfachung, damit sich die Steuerung nie gegen einen
  selbst richtet.
- **Nur Pointer Events, keine parallele Touch-Events-Implementierung**
  (siehe ausführliche Begründung in `js/input.js`) – konsistent mit den
  anderen Spielen im Repo; die Spec bittet zwar um Tests mit "Pointer
  Events plus Touch-Events", das wird hier als Test-Empfehlung (auf
  einem echten Gerät verifizieren) statt als Implementierungs-Vorgabe
  (zwei redundante Event-Systeme gleichzeitig binden) gelesen.
