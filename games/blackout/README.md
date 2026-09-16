# Blackout

Endlos-Platformer nach dem Vorbild von **N – The Way of the Ninja**
(Metanet Software, 2004). Schalter finden, damit die Tür aufgeht, raus,
nächster Raum – bevor die Uhr abläuft.

## Das Wichtigste zuerst: die Physik ist ein exakter Port

Beim ersten Versuch wurde ein vorhandenes Spiel nur umgeskinnt. Diesmal
nicht: Die Bewegungsphysik stammt **Zeile für Zeile** aus dem öffentlich
reverse-engineerten N++-Simulator (`nclone/nsim.py`, Klasse `Ninja`) –
Konstanten, Reihenfolge der Rechenschritte, Kollisionsauflösung,
Sprunglogik und Aufpralltod inklusive.

Nachgemessen gegen die dokumentierten Originalwerte
(`scratchpad/physik_test.js`):

| Größe | Original | Dieser Port |
|---|---|---|
| Endfallgeschwindigkeit | 9.9833 px/Frame | 9.9833 |
| Wandrutsch-Endgeschwindigkeit | 0.6412 px/Frame | 0.6412 |
| Max. überlebbarer Sturz | 244.5 px | 244.47 |
| Sprunghöhe (Antippen … voll) | 1.06–3.09 Kacheln | 1.20–3.20 |
| Wandsprung-Impuls (1. Sprung) | −1.40 px/Frame | −1.40 |

Warum sich das so anfühlt, wie es sich anfühlt:

- **Variable Sprunghöhe**: Solange die Taste gehalten wird (max. 45 Frames),
  wirkt exakt ein Sechstel der Schwerkraft. Kurz antippen = kleiner Hüpfer.
- **Momentum bleibt erhalten**: Die Kollisionsantwort projiziert die
  Geschwindigkeit nur auf die Oberfläche – kein Abprall, keine
  Landungsstrafe. Wer mit vollem Tempo landet, läuft mit vollem Tempo weiter.
- **Wandsprung-Ketten**: Beim Wandsprung wird nur Abwärtstempo genullt;
  Aufwärtstempo bleibt und der Impuls addiert sich. In einem engen Schacht
  schraubt man sich dadurch immer schneller hoch – und ab dem vierten
  Kettensprung über die tödliche Aufprallschwelle.
- **Nachsicht-Fenster**: Coyote Time (4 Frames), Sprungpuffer (5), Wandpuffer
  (4) – alles aus dem Original übernommen.

## Gegner

- **Mine** – steht still, tötet bei Berührung. Verengt Wege.
- **Drohne** – patrouilliert auf dem Kachelraster und biegt an Wänden ab
  (Rasterlogik aus `EntityDroneBase`). Vorhersehbar, zwingt zum Timen.
- **Geschütz** – der Grund für dieses Spiel. Es sieht dich nur bei freier
  Sichtlinie, dreht sich mit **begrenzter** Geschwindigkeit auf dich zu,
  lädt sichtbar 0,63 s auf und feuert dann tödlich. Daraus entsteht das
  Anpirschen: in Deckung warten, den Moment abpassen, schnell durchhuschen.
  Wer quer und schnell genug läuft, wird gar nicht erst erfasst.
  (Das Original-N++ hat stattdessen rotierende Laser; das zielende Geschütz
  stammt aus N von 2004 und ist hier eigenständig umgesetzt.)

## Räume: endlos, aber garantiert lösbar

Ein Raum = ein Bildschirm, kein Scrollen – wie im Original. Man sieht alle
Gefahren auf einen Blick und plant die Route, bevor man losläuft.

Bei dieser Physik wäre ein unschaffbarer Raum das sofortige Ende eines Laufs.
Deshalb wird nicht frei gewürfelt:

1. Drei Archetypen (Plattformen, Schacht, Säulen) werden konstruktiv gebaut.
2. Danach wird eine **Treppe zum Schalter garantiert eingezogen** – Stufen
   von höchstens 2 Kacheln Höhe und 4 Breite, also mit großem Abstand zu
   dem, was die Physik hergibt (3.09 hoch, über 15 weit).
3. Gefahren werden nie so gesetzt, dass ein Weg komplett dicht ist.

Nachgewiesen mit `scratchpad/solver_test.js`: eine Strahlensuche, die den
Raum mit der **echten Physik** durchspielt. Findet sie einen Weg, ist der
Raum bewiesen lösbar.

## Steuerung

Zwei Varianten, im Menü und in der Pause umschaltbar – bitte beide auf dem
Handy antesten, die schlechtere fliegt danach raus:

- **Bildschirmhälften** (Voreinstellung): linkes Viertel = links laufen,
  zweites Viertel = rechts laufen, rechte Hälfte = Sprung (halten = höher).
  Entspricht am genauesten der Tastatursteuerung des Originals, das dort
  ebenfalls digital ist, nicht analog.
- **Joystick**: Daumen-Stick erscheint links, wo man aufsetzt; Sprung rechts.

Am Rechner: Pfeiltasten/A+D laufen, Leertaste/Pfeil hoch springen, Esc pausiert.

## Schwierigkeit

Nach Absprache **spürbar entschärft**, aber nicht zahnlos:

- Gegner töten weiterhin sofort – das ist die Spannung beim Anschleichen.
- Der Aufpralltod ist milder eingestellt (Schwelle 7.5 statt 6, tödlich erst
  ab ca. 14 statt 10 Kacheln Sturz). Im Menü auf "original (hart)"
  umschaltbar, um beides direkt zu vergleichen.
- Raum 1 ist bewusst leer: dort lernt man die Bewegung ohne Strafe.
  Minen ab Raum 2, Drohnen ab Raum 3, Geschütze ab Raum 4.

Zeit: Start 45 s, pro geschafftem Raum +15 s, pro Goldstück +2 s, Deckel bei
99 s. Wer trödelt, verliert – wer Gold mitnimmt, kauft sich Luft.

## Bewusst noch offen

- **Schrägen** sind in der Kollision und im Renderer vorbereitet
  (`T_SLOPE_*`), werden vom Generator aber noch nicht gesetzt. Im Original
  sind sie ein großer Teil des Flows (Fall wird in Tempo umgelenkt) – das ist
  der nächste sinnvolle Ausbauschritt.
- **Ragdoll-Tod**: aktuell ein Partikel-Burst statt des Original-Ragdolls.
- **Raumvielfalt**: drei Archetypen sind ein Anfang, keine Endlösung.
- Die Zahlen für Zeit, Gegnerdichte und Geschütz-Timing sind ein erster
  Wurf und noch nicht über viele Runden gegengespielt.
