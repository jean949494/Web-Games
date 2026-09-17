# Werkzeuge

Messskripte zu Blackout. Sie sind kein Teil des Spiels und werden von der
Seite nicht geladen – aber jede Zahl in der README des Spiels kommt aus
einem davon, und alle bisher gefundenen Fehler sind hier aufgefallen und
nicht beim Spielen.

Der Grund für den Aufwand: Bei dieser Physik ist ein unlösbarer Raum das
sofortige Ende eines Laufs, und ein Endlosspiel erzeugt Räume, die nie ein
Mensch vorher gesehen hat. Man kann nicht alles durchspielen – aber man kann
es durchrechnen.

## Ohne Browser (`node <datei>`)

| Datei | prüft |
|---|---|
| `physik_test.js` | Bewegungswerte gegen die dokumentierten Originalzahlen (Endfallgeschwindigkeit, Sprunghöhe, Wandsprung-Impuls …) |
| `slope_test.js` | Stürze auf Schrägen – dort überlebt man mehr als auf flachem Boden |
| `uphill_test.js` | ob man eine 45-Grad-Rampe hochlaufen kann |
| `turret_test.js`, `turret_test2.js` | Geschütz-Verhalten: Stillstehen tötet, Laufen schützt, Deckung setzt zurück |
| `level_test.js` | Raumstruktur über 480 Räume: steckt etwas in der Wand, wie verteilen sich die Archetypen |
| `solver_test.js` | **Lösbarkeit**: Strahlensuche über die echte Physik, Weg zum Schalter |
| `solver_mines.js` | dasselbe, mit Minen als tödlichen Hindernissen |
| `run_sim.js` | **Zeit-Haushalt**: spielt ganze Läufe durch (Hin- und Rückweg je Raum) und rechnet die Uhr gegen |
| `pressure_test.js` | **Schwierigkeitskurve**: wie lange man an einer beliebigen Stelle stehen bleiben kann, bevor es tödlich wird |

Die drei fett markierten dauern Minuten, nicht Sekunden – sie spielen
tatsächlich. Argumente sind meist `<Seeds> <Räume> [erster Raum]`, z. B.
`node solver_mines.js 12 9 12` für 12 Seeds × Räume 12–20.

## Im Browser (`browser/`)

Brauchen einen laufenden Dev-Server (`npm run dev`, Vorgabe
`http://localhost:5173`) und Playwright mit Chromium – einmalig `npm install`
im Wurzelverzeichnis.

    node browser/gallery.js                      # nimmt den Standard-Chromium
    CHROMIUM=/pfad/zu/chromium node browser/touch_bars.js
    BASE_URL=http://localhost:8080 node browser/blackout.js

Aufgerufen wird immer aus dem Wurzelverzeichnis, damit `playwright-core`
gefunden wird.

| Datei | prüft |
|---|---|
| `blackout.js` | Rauchtest: startet, läuft, springt, pausiert, keine JS-Fehler |
| `touch.js` | beide Steuerungsvarianten, Mehrfinger-Betrieb |
| `touch_bars.js` | dass die Steuerzonen bis in die schwarzen Balken reichen |
| `gallery.js` | ein Bildschirmfoto je Raum, dazu Gefahren- und Zeitwerte |
| `ragdoll.js`, `respawn.js` | Tod, Puppe, Wiedereinstieg im selben Raum |
| `crosshair.js` | das Fadenkreuz des Geschützes |
| `loop3.js` | längerer Lauf am Stück |

Bildschirmfotos landen in `browser/out/` (nicht eingecheckt).

## Wenn ein Skript einen Fehler meldet

Erst den Raum ansehen, nicht sofort das Modell lockern. Alle bisherigen
Befunde waren echte Baufehler, bis auf zwei – und die zwei waren ein Modell,
das zu **streng** war und dadurch ganze Raumtypen entwertet hat. Beides
kommt vor; welches von beidem, sieht man erst im Kachelbild.
