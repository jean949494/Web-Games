# Spiele

Browser-Spiele für Web-Portale (zuerst Poki). Jedes Spiel liegt in einem
eigenen Ordner unter `games/` und läuft ohne Build-Schritt – reines
HTML/CSS/JavaScript.

## Spiele

- [`games/ninja-wandsprung`](games/ninja-wandsprung/) – Endless-Climber:
  Ladesprung von Wand zu Wand, Stacheln ausweichen

## Loslegen

```
npm run dev      # lokaler Server mit Live-Reload, http://localhost:5173/
npm run deploy   # aktuellen Stand auf die öffentliche Test-URL schicken
```

Ausführlich erklärt in [`DEV.md`](DEV.md).

## Gemeinsames Grundgerüst

Diese Bausteine sind bewusst spielunabhängig geschrieben und lassen sich
für jedes weitere Spiel wiederverwenden (aktuell in
`games/ninja-wandsprung/js/`, beim zweiten Spiel wandern sie in einen
gemeinsamen `shared/`-Ordner):

- `storage.js` – Highscore und Einstellungen lokal speichern
- `audio.js` – Sounds ohne Asset-Dateien, an/aus, wird gemerkt
- `analytics.js` – Event-Hook, später an ein echtes Analytics andockbar
- `poki.js` – Poki-SDK-Wrapper, tut nichts wenn kein SDK geladen ist

Dazu die Design-Leitplanken, die für **jedes** Spiel hier gelten:
kein Tutorial-Text, sofortiger Start ohne Login, kurze Runden, Neustart
mit einem Tap, Minimal-Menü, kindgerechte Optik, keine In-App-Käufe.
