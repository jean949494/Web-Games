# Spiele

Browser-Spiele für Web-Portale (zuerst Poki). Jedes Spiel liegt in einem
eigenen Ordner unter `games/` und läuft ohne Build-Schritt – reines
HTML/CSS/JavaScript.

## Spiele

- [`games/ninja-wandsprung`](games/ninja-wandsprung/) – Endless-Climber:
  Ladesprung von Wand zu Wand, Stacheln ausweichen
- [`games/kurve-solo`](games/kurve-solo/) – Endlos-Climber: Linie hinter
  sich herziehen, Hindernissen ausweichen, Feld wird mit der Höhe
  schmaler und verzwickter
- [`games/team-duell`](games/team-duell/) – 3 gegen 3 mit Schutzmauer:
  Wasserkanone (blockierbar) vs. Superwurf (über die Mauer), Teammates
  per Kommando steuern
- [`games/eisturm`](games/eisturm/) – Icy-Tower-Etagen erklimmen:
  Handy neigen zum Laufen (je stärker, desto schneller), antippen zum
  Springen. Schnellerer Anlauf = höherer Sprung, mehrere Etagen auf
  einmal geben Combo-Bonus
- [`games/astro-ascent`](games/astro-ascent/) – dieselbe Grundmechanik
  wie Ninja Wandsprung, aber schwerelosere Physik und Laser-Geschütze
  zum Timen/Anschleichen statt nur Ausweichen (Details in der eigenen
  README)

## Loslegen

```
npm run dev      # lokaler Server mit Live-Reload, http://localhost:5173/
npm run deploy   # aktuellen Stand auf die öffentliche Test-URL schicken
```

Ausführlich erklärt in [`DEV.md`](DEV.md).

## Gemeinsames Grundgerüst

Diese Bausteine sind bewusst spielunabhängig geschrieben und liegen in
[`shared/`](shared/), seit mit Kurve Solo das zweite Spiel dazugekommen
ist. Jedes Spiel bindet sie per `<script>`-Tag ein und meldet sich beim
Start mit seiner eigenen `GAME_ID` an (Highscore-Namespace,
Analytics-Tag):

- `storage.js` – Highscore (pro Spiel) und Einstellungen (global, z.B.
  Sound an/aus) lokal speichern
- `audio.js` – Ton-Synthesizer ohne Asset-Dateien, an/aus, wird gemerkt;
  spielspezifische Ton-Sequenzen liegen als kleine `sounds.js` je Spiel
  obendrauf (siehe `games/*/js/sounds.js`)
- `analytics.js` – Event-Hook, später an ein echtes Analytics andockbar
- `poki.js` – Poki-SDK-Wrapper, tut nichts wenn kein SDK geladen ist

Dazu die Design-Leitplanken, die für **jedes** Spiel hier gelten:
kein Tutorial-Text, sofortiger Start ohne Login, kurze Runden, Neustart
mit einem Tap, Minimal-Menü, kindgerechte Optik, keine In-App-Käufe.
