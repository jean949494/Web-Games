# Kurve Solo

Arcade-Prototyp (Canvas, Vanilla JS, keine Build-Abhängigkeiten). Eigener
Name und eigener Look, inspiriert von der Genre-Mechanik "Kurve ziehen,
Kollision = Tod" (siehe Spec-Dokument) – keine Original-Assets oder der
Originaltitel wurden übernommen. Wichtigste Abweichung vom Vorbild: kein
Online-Multiplayer, stattdessen **solo gegen 3 KI-Bots** (spart Server/
Matchmaking/Anti-Cheat, bis ein Spiel nachweislich Publikum hat).

Spieler steuert einen Punkt, der eine durchgehende Linie (mit
gelegentlichen Lücken) hinter sich zieht. Konstante Geschwindigkeit,
Lenken nur links/rechts, keine Bremse. Kollision mit Wand, eigener Linie
oder fremder Linie = Tod. Ziel: möglichst lange überleben.

Alle Physik-/Bot-Werte stammen 1:1 aus dem Spec-Dokument der
Prototyp-Phase (Chat/Visualizer) – siehe `js/constants.js`, jeder Wert
dort kommentiert. Nicht ohne erneutes Playtesting verändern.

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
- `js/constants.js` – alle Spec-Werte (Physik, Bot-KI, Startaufstellung)
- `js/game.js` – Zustandsmaschine, Physik-Loop (fix 60Hz), Kollision,
  Rendering
- `js/bots.js` – Bot-KI (Blickweite-Ausweichen + gelegentliches Wobbeln)
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
- Bot-KI: Blickweite ~26px in Bewegungsrichtung, weicht bei erkannter
  Gefahr in eine beim ersten Erkennen zufällig gewählte, kurz gehaltene
  Richtung aus; sonst gelegentliche kleine zufällige Richtungsänderungen
  für organisches Wirken
- 3 Bots als Startwert, unterschiedliche Farben zur Unterscheidung
- Touch-Steuerung: linke/rechte Bildschirmhälfte halten, nur Pointer
  Events (keine Redundanz-Lösung, siehe Spec-Hinweis zur
  Chat-Iframe-Testumgebung)
- Gelöstes Problem aus der Spec: ein Tap nach Game Over startet
  gleichzeitig neu UND lenkt – das gesamte Game-Over-Overlay ist der
  Tap-Ziel, kein separater Restart-Button nötig (siehe `js/input.js`)
- Grundgerüst: Menü, Pause, Game Over, Highscore lokal (geteilter
  Storage), Sound an/aus, Touch- **und** Tastatursteuerung
  (Pfeiltasten/A-D, Esc = Pause), Analytics-Event-Hooks, Poki-SDK als
  austauschbares Modul
- Design-Leitplanken der Spec: kein Tutorial-Text (nur ein Zeile Hinweis
  "Linke/rechte Seite halten"), sofortiger Start ohne Login, ein Tap zum
  Neustart, Minimal-Menü, kindgerechte Optik (freundlicher "Puff"- statt
  Crash-Sound)
- Juice: Partikel-Burst beim Tod (für alle Spieler, nicht nur den
  Menschen), leichter Screen-Shake beim eigenen Tod

## Bewusst offen gelassen (siehe Spec, "Noch offen")

Laut Spec selbst noch nicht getestet bzw. eine reine Geschäfts-/
Prozessentscheidung – deshalb hier nicht spekulativ vorweggenommen:

- **Schwierigkeit über die Zeit steigern** (Feld verengt sich, mehr/
  aggressivere Bots) – die Spec nennt hierfür explizit nur Beispiele,
  keine Werte ("im Prototyp noch nicht getestet"). Ohne belastbare
  Zahlen hätte eine Umsetzung hier raten bedeutet statt die Spec 1:1
  zu übernehmen; mit `npm run dev` gegenspielen und bei Bedarf in
  `constants.js`/`game.js` ergänzen.
- **Sound-Feintuning/weiteres Juice** (z.B. Ton beim Ausweichen selbst) –
  Grundsound und Partikel/Screen-Shake sind umgesetzt, weitere Verfeinerung
  laut Spec optional ("ggf.").
- **Build-Skript für Portal-Export** – aktuell reicht der Ordner als
  statische Seite; ein Poki-spezifisches Zip/Export-Skript kommt erst,
  wenn die Einreichung ansteht.
- **Portal-Strategie** – laut Spec zuerst exklusiv bei Poki einreichen,
  andere Portale erst bei Absage. Reine Prozessentscheidung, keine
  Code-Änderung.

## Annahmen / Interpretationen (Spec war an diesen Stellen nicht exakt)

- **Score** = Anzahl überlebter Physik-Frames (fix 60Hz) des
  menschlichen Spielers. Die Spec nennt kein konkretes Punktesystem,
  nur "möglichst lange überleben" – Frames sind direkt proportional
  zur Überlebenszeit und ergeben angenehm große, stetig wachsende Zahlen
  (ähnlich der Höhen-Score-Logik in Ninja Wandsprung).
- **Rundenende**: Die Runde endet, sobald der menschliche Spieler
  stirbt – unabhängig davon, ob noch Bots leben. Tote Bots werden aus
  der KI-Aktualisierung genommen, ihre Linie bleibt aber (gedimmt) als
  Hindernis stehen, wie im Original üblich.
- **Startaufstellung**: Spec nennt keine Positionen/Blickrichtungen.
  "Windmühle" an den 4 Feldecken, alle starten tangential im
  Uhrzeigersinn (siehe `START_LAYOUT` in `constants.js`). Eine
  naheliegendere Kompass-Aufstellung (Spieler unten, Bots an den übrigen
  Himmelsrichtungen) wurde verworfen: Sie schickt gegenüberliegende
  Spieler exakt frontal aufeinander zu und führt dadurch garantiert zu
  einem sehr frühen Kopf-an-Kopf-Crash, unabhängig vom Können.
- **Bot-Ausweichdauer** (`BOT_AVOID_HOLD_FRAMES` = 20 Frames) und
  **Vorwarnschwelle** (`BOT_LOOKAHEAD_FACTOR_SQ` = 3.4, etwas großzügiger
  als die exakte Kollisionsgrenze) sind Platzhalter, da die Spec nur
  "kurz gehalten" bzw. "ein Stück voraus" sagt, ohne Zahlen. Mit
  `npm run dev` gegenspielen und anpassen.
- **Steuerung bei Fingerbewegung**: Bleibt der Finger gehalten und
  überquert die Bildschirmmitte, wechselt die Lenkrichtung live mit
  (nicht nur beim ersten Antippen fixiert) – fühlt sich natürlicher an
  und war durch die Spec nicht ausgeschlossen.
