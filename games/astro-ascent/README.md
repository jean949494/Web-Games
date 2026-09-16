# Astro Ascent

Endless-Climber im Weltall. Astronaut hängt magnetisch an der Wand eines
Schachts, rutscht langsam ab. Halten lädt den Sprung auf (bis 2s, 5
Stufen), Loslassen springt zur gegenüberliegenden Wand. Endlos nach oben,
vorbei an Planeten und Sternenfeldern, Asteroidenbrocken und
Laser-Geschützen ausweichen.

> Historie: Das Spiel entstand als Weiterentwicklung eines früheren
> Prototyps ("Ninja Wandsprung"), der dieselbe Grundmechanik hatte und
> deshalb entfernt wurde. Die beiden folgenden Punkte sind das, was hier
> gegenüber dem Prototyp dazukam.

## Eigenheiten

1. **Schwerelosigkeit statt straffer Physik.** Niedrige Basis-Schwerkraft,
   niedriger Gravitations-Multiplikator pro Ladestufe, plus ein
   "Apex-Float": nahe des Scheitelpunkts eines Sprungs wirkt kurz
   zusätzlich weniger Schwerkraft. Bei hoher Ladestufe fühlt sich das wie
   ein kurzer freier Flug an, nicht nur wie ein höherer Sprung.
2. **Laser-Geschütze als zweiter Hindernis-Typ** neben den
   Asteroidenbrocken. Ein Geschütz läuft in festem Rhythmus sicher →
   Warnung → Feuer. Man muss sich anschleichen, den Rhythmus abwarten und
   im sicheren Fenster durchqueren – Timing statt reinem Ausweichen.

Alle anderen Bausteine (Menü, Pause, Game Over, Highscore, Sound,
Touch/Tastatur, Analytics, Poki-Wrapper) kommen unverändert aus dem
gemeinsamen Grundgerüst, siehe `../../README.md`.

## Hintergrund: Sterne & Planeten

Beide werden nicht als wachsendes Array gespeichert (das Spiel endet nie
außer durch Tod), sondern als feste kleine Menge mit Zufalls-"Saat", die
per Modulo auf die aktuelle Kamera-Position abgebildet wird – kachelt
dadurch endlos ohne Nachladen/Aufräumen. Sterne kacheln kurzzyklisch
(wirken einzeln), Planeten langzyklisch (wirken wie seltene, große
Objekte, an denen man vorbeifliegt).

## Bewusst offen / Platzhalter

- `LASER_GATE_CHANCE`, `LASER_IDLE_MS`, `LASER_WARNING_MS`,
  `LASER_FIRING_MS` in `js/constants.js` sind ein erster Wurf, nicht
  durchgespielt – Timing-Fenster ggf. nach ein paar Testrunden anpassen.
- `GRAVITY`, `TIER_GM`, `APEX_FLOAT_*` sind bewusst floatiger als beim
  Ninja gewählt, aber ebenfalls noch nicht über eine volle Runde
  gegengetestet.
- Planeten-Look ist bewusst einfach (Kreis + Schatten + optionaler Ring)
  – reicht für Tiefenwirkung, kein Anspruch auf Detailgrafik.
