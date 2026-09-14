# Team-Duell mit Mauer – Spielspezifikation (Spiel 3)

Übergabedokument aus der Prototyp-Phase (Chat/Visualizer). Repo: Web-Games.
Gleiche Design-Leitplanken wie im Grundgerüst (siehe ninja-walljump-spec.md).

## Konzept
Sicht von oben, Spieler unten, Gegner oben. Beide Seiten haben eine
Schutzmauer aus einzelnen Segmenten. Zwei Angriffsarten:
- **Schuss** (Geradeausfeuer): wird von der Mauer blockiert, schwächt sie
  Segment für Segment nur an der getroffenen Stelle, bis dort eine Lücke
  entsteht.
- **Wurf** (Lob-Wurf): fliegt über die Mauer hinweg, trifft nur wenn er
  nah genug am Ziel landet (Zielpunkt bewegt sich, Gegner bewegt sich
  auch – Vorhalten nötig).
3 gegen 3: Spieler + 2 KI-Teammates gegen 3 KI-Gegner. Team-Kommandos
steuern das Verhalten der eigenen Teammates.

## Sicherheits-Reskin (wichtig, nicht vergessen)
Ursprüngliche Idee war Flammenwerfer/Rakete – für die Zielgruppe (siehe
Design-Leitplanken) umbenannt zu harmloseren Varianten: Wasserkanone /
Superwurf statt Flammenwerfer / Rakete. Visuell abstrakt halten
(einfache Formen/Farben, keine realistischen Waffen), Treffer als
"Poof"/Partikel-Effekt, nicht als Verletzung.

## Bewusste Vereinfachung (zur Diskussion, ggf. in Claude Code ändern)
Beide Teams haben je EINEN gemeinsamen Lebenspool (140 HP) statt 6
einzeln verfolgter Einheiten mit eigenem Leben. Das hat den Prototyp
deutlich einfacher gehalten. Falls doch einzelne Einheiten mit eigenem
Leben gewünscht sind (fällt z.B. ein Teammate sichtbar aus), das ist ein
bewusst offener Punkt, keine vergessene Anforderung.

## Feld & Werte
- Canvas-Referenz 340×480, Wände als 8 Segmente je Seite
- Segment-HP 60, Schaden pro Treffer 15 (≈4 Treffer pro Segment)
- Mauerdicke (visuell) bewusst 30% kleiner als ursprünglicher Entwurf
  (von 12px auf 8px) – falls "kleiner" eigentlich die Breite der
  Segmente meinte statt die Dicke, bitte in Claude Code klären
- Team-HP je Seite: 140
- Schaden: Schuss auf Einheit 8, Wurf-Treffer 22, gegnerischer Schuss
  auf Spieler-Team 10
- Bewegungsgeschwindigkeit Spieler 2.6px/frame, Bullet-Geschwindigkeit
  ~3.2px/frame

## Steuerung (Kernidee, Feinschliff steht noch aus)
Drei runde Sticks, kein klassisches Steuerkreuz:
1. **Bewegung** (links, größer, ~84px): freie 2D-Bewegung im eigenen
   Spielfeldbereich
2. **Schuss** (rechts oben, kleiner, ~58px): Richtung bestimmt die
   Schussrichtung, Feuer läuft automatisch in Intervallen solange der
   Stick über eine Totzone hinaus ausgelenkt ist
3. **Wurf** (rechts unten, kleiner, ~58px): relativer Stick, Auslenkung
   bestimmt Zielpunkt (Fadenkreuz live sichtbar während gehalten),
   Loslassen wirft

Zusätzlich 3 Kommando-Buttons oberhalb der Sticks: Rückzug (Teammates
ziehen sich hinter die eigene Position zurück), Angriff (Teammates
rücken weit vor, exponierter), Deckung (Teammates folgen der
Spielerposition eng).

## Bekannte offene Punkte für Claude Code
- **Stick-Gefühl noch nicht final.** In der Chat-Testumgebung schwer
  zu beurteilen, ob Radius, Totzone, Empfindlichkeit stimmen – das war
  hier absichtlich nicht bis zum Schluss durchgetestet, weil echtes
  Touch-Verhalten auf echten Geräten eine bessere Grundlage ist als
  das Antippen im Chat-Fenster. Bitte früh auf einem echten Handy
  testen, nicht nur am Rechner mit Maus.
- Mehrere Touch-Zuverlässigkeitsbugs sind in der Prototyp-Phase
  aufgetreten (Sticks reagierten anfangs nicht zuverlässig). Ursache
  vermutlich die iframe-basierte Chat-Testumgebung, nicht die
  Eingabelogik selbst – trotzdem in Claude Code sauber mit
  Pointer Events plus Touch-Events testen, nicht nur mit einer
  Eingabeart arbeiten.
- Drei gleichzeitige Sticks mit zwei Daumen bedienbar? Ergonomie noch
  nicht abschließend bewertet, ggf. Layout anpassen (z.B. Schuss
  automatisch statt Stick-Richtung, falls sich das als zu viel
  herausstellt)
- Schwierigkeit/Balance zwischen Schuss- und Wurf-Schaden noch nicht
  gegeneinander getestet
- Highscore/Sieg-Screen, Sound, lokale Speicherung fehlen noch

## Repo-Hinweis
Ab jetzt existiert das Repo **Web-Games** für alle Spiele, mit denen
Einnahmen erzielt werden sollen. Bitte in diesem Repo weiterarbeiten,
nicht in einem neuen Ordner, und dieses Dokument dort ablegen (z.B.
unter /specs/).

## Modellwahl
Sonnet reicht für Aufbau und Iteration. Opus bei unklaren
Physik-/Kollisionsproblemen oder wenn sich die drei Sticks trotz
mehrerer Versuche nicht sauber und zuverlässig anfühlen.
