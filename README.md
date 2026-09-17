# Spiele

Browser-Spiele für Web-Portale (zuerst Poki). Jedes Spiel liegt in einem
eigenen Ordner unter `games/` und läuft ohne Build-Schritt – reines
HTML/CSS/JavaScript.

## Spiele

- [`games/blackout`](games/blackout/) – Endlos-Platformer nach dem Vorbild
  von *N – The Way of the Ninja*. Die Bewegungsphysik ist ein exakter Port
  der N++-Physik (Konstanten aus dem reverse-engineerten Original, gegen
  die dokumentierten Werte nachgemessen). Querformat.
  Der am weitesten entwickelte Titel hier – mit eigenen Messskripten unter
  [`games/blackout/tools`](games/blackout/tools/), die Lösbarkeit,
  Zeit-Haushalt und Schwierigkeitskurve nachrechnen.
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
- [`games/astro-ascent`](games/astro-ascent/) – Endlos-Climber im
  Weltall: schwereloser Ladesprung von Wand zu Wand, Asteroiden
  ausweichen, Laser-Geschütze im Rhythmus timen

## Loslegen

```
npm run dev      # lokaler Server mit Live-Reload, http://localhost:5173/
npm run deploy   # aktuellen Stand auf die öffentliche Test-URL schicken
```

Dazu die Messskripte von Blackout – `check:physik`, `check:geometrie`,
`check:raeume`, `check:loesbar`, `check:zeit`, `check:druck`. Ausführlich
erklärt in
[`DEV.md`](DEV.md).

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
