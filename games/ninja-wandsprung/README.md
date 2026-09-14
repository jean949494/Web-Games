# Ninja Wandsprung

Endless-Climber-Prototyp (Canvas, Vanilla JS, keine Build-Abhängigkeiten).
Ninja hängt an einer Wand, rutscht langsam runter, Halten lädt den Sprung
auf (bis 2s, 5 Stufen), Loslassen springt zur gegenüberliegenden Wand.
Ziel: möglichst hoch kommen, roten Stacheln ausweichen.

Alle Physik-Werte stammen 1:1 aus dem Spec-Dokument der Prototyp-Phase
(Chat/Visualizer) – siehe `js/constants.js`, jeder Wert dort kommentiert.
Nicht ohne erneutes Playtesting verändern.

## Starten

Kein Build-Schritt nötig, `index.html` kann direkt in jedem modernen
Browser geöffnet werden. Für die Entwicklung mit Live-Reload:

```
npm run dev
```

Das Spiel liegt dann unter `http://localhost:5173/games/ninja-wandsprung/`
(oder über die Übersicht auf `http://localhost:5173/`). Details siehe
`../../DEV.md` im Repo-Root (Dev-Server & Deploy-Workflow).

## Struktur

- `index.html` – Markup + Overlay-Screens (Menü, Pause, Game Over)
- `style.css` – Layout, responsive Skalierung auf 340×480-Referenz
- `js/constants.js` – alle Spec-Werte (Physik, Stacheln, Schwierigkeit)
- `js/game.js` – Zustandsmaschine, Physik-Loop (fix 60Hz), Rendering
- `js/input.js` – Touch- (Pointer Events) und Tastatursteuerung
- `js/storage.js` – Highscore lokal (localStorage)
- `js/audio.js` – WebAudio-Synth-Sounds, an/aus, kein Asset nötig
- `js/analytics.js` – Event-Hook (`nw:analytics` CustomEvent), austauschbar
- `js/poki.js` – Poki-SDK-Wrapper, No-Op falls `window.PokiSDK` fehlt
- `js/particles.js` – Staubpartikel bei Wandkontakt

## Umgesetzt aus der Spec

- Kernmechanik & alle 5 Ladestufen (Tier 0–4) mit den finalen
  Geschwindigkeits-/Gravitations-Werten
- Schwierigkeitskurve (`lvl` ab Höhe 6000, Cap 1.18) inkl. großzügigem
  Start-Abstand für die ersten Stacheln (siehe "gelöste Bugs" in der Spec)
- Großzügige Stachel-Hitbox (45% des Ninja-Radius)
- Juice: Landung-Squash/Stretch, Staubpartikel, "Knapp!"-Flash bei
  Abstand < 10px (einmal pro Stachel), Ladering pro erreichter Stufe
- Grundgerüst: Menü, Pause, Game Over, Highscore lokal, Sound an/aus,
  Touch- **und** Tastatursteuerung (Leertaste/Pfeil hoch, Esc = Pause),
  Analytics-Event-Hooks, Poki-SDK als austauschbares Modul
- Design-Leitplanken der Spec: kein Tutorial-Text (nur "Halten &
  loslassen"), sofortiger Start ohne Login/Ladebildschirm, ein Tap zum
  Neustart, Minimal-Menü, kindgerechte Optik (freundliches Gesicht,
  kein harter Sterbe-Sound)

## Bewusst offen gelassen (siehe Spec, "Noch offen")

Diese Punkte sind laut Spec selbst noch nicht fertig entschieden bzw.
brauchen echtes Playtesting oder eine Geschäftsentscheidung, deshalb hier
nicht spekulativ vorweggenommen:

- **Schwierigkeitskurve über eine volle Runde tunen** – `LEVEL_RAMP_RANGE`
  in `constants.js` ist ein Platzhalter (6000px), explizit als "noch
  nicht getestet" markiert. Mit `npm run dev` gegenspielen und Wert
  anpassen.
- **Ist die Stärke evtl. schon zu leicht?** – noch nicht bewertet, dafür
  ist genau der Punkt oben da.
- **Build-Skript für Portal-Export** – aktuell reicht der Ordner als
  statische Seite; ein Poki-spezifisches Zip/Export-Skript kommt erst,
  wenn die Einreichung ansteht.
- **Portal-Strategie** – laut Spec zuerst exklusiv bei Poki einreichen,
  andere Portale erst bei Absage. Reine Prozessentscheidung, keine
  Code-Änderung.

## Annahmen / Interpretationen (Spec war an diesen Stellen nicht exakt)

- Stachel-Kollision: Spitze als kleiner Kollisionskreis (`SPIKE_BASE_HALF`
  = 3px) am Ende der Protrusion, kombiniert mit dem 45%-Ninja-Radius.
  Bewusst kleiner als die sichtbare Stachelbreite, damit unterhalb der
  "Knapp!"-Schwelle (10px) ein spürbares Fenster für knappe Vorbeiflüge
  bleibt, ohne zu treffen.
- Score = höchster je erreichter Punkt der aktuellen Runde (nicht die
  aktuelle Position), da diese zwischen zwei Sprüngen durchs
  Wandrutschen leicht sinkt – sonst würde der angezeigte Punktestand
  während des Rutschens "zurückzählen".
- `lvl` wird aus der aktuell erreichten Höhe berechnet (nicht der
  Bestleistung), damit Auf-und-Ab-Bewegungen die Schwierigkeit
  konsistent mit der sichtbaren Kamera-Position halten.
