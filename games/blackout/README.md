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
- **Gauss-Geschütz** – der Grund für dieses Spiel, und ebenfalls ein Port:
  Die Logik stammt aus dem dekompilierten Originalcode von N v1.4
  (`TurretObject`), von 40 auf 60 Bilder/s umgerechnet.

  Das Entscheidende ist unintuitiv: **Das Geschütz zielt nicht auf dich.**
  Es hat ein eigenes Fadenkreuz, das dir exponentiell *hinterherkriecht*.
  Der Schuss-Countdown richtet sich danach, wie nah das **Fadenkreuz** dir
  schon ist – nicht danach, wie nah der Turm ist:

  | Abstand Fadenkreuz ↔ Spieler | bis zum Schuss |
  |---|---|
  | über 4 Kacheln | **nie** – der Countdown steht still |
  | 1,75–4 Kacheln | 3,0 s |
  | 1–1,75 Kacheln | 1,0 s |
  | unter 1 Kachel | 0,43 s |

  Daraus fällt das ganze Spielgefühl von selbst heraus: Wer in Bewegung
  bleibt, hält das Fadenkreuz in der äußeren Zone und wird **nie** getroffen.
  Wer zögert, lässt es einrasten und stirbt. Dazu:

  - **Sichtlinie brechen setzt alles zurück** – Fadenkreuz springt zum Turm,
    Countdown auf Anfang. Deshalb kann man sich etappenweise von Deckung zu
    Deckung heranarbeiten.
  - **0,25 s Vorwarnung** mit eingefrorenem Fadenkreuz, danach wird die Sicht
    *nochmal* geprüft: Wer sich in diesem Fenster in Deckung wirft, bleibt heil.
  - **Versetzte Wahrnehmung**: Wie im Original prüft nur *ein* Fernkampfgegner
    alle 0,1 s seine Sichtlinie, reihum. Mit drei Geschützen sieht dich jedes
    nur alle 0,3 s – in der Zeit legst du 2,5 Kacheln zurück. Deshalb kann man
    durch eine Schusslinie huschen.

  Nachgemessen (`scratchpad/turret_test2.js`): Stillstehen → tot nach 2,2 s.
  Volles Tempo durchlaufen → überlebt, obwohl fünf Schüsse fallen; sie gehen
  alle dorthin, wo man *war*.

## Räume: endlos, aber garantiert lösbar

Ein Raum = ein Bildschirm, kein Scrollen – wie im Original. Man sieht alle
Gefahren auf einen Blick und plant die Route, bevor man losläuft.

Bei dieser Physik wäre ein unschaffbarer Raum das sofortige Ende eines Laufs.
Deshalb wird nicht frei gewürfelt:

1. Vier Archetypen werden konstruktiv gebaut und reihum durchgewechselt:
   **Plattformen** (Sprungpräzision), **Schacht** (Wandsprung-Ketten),
   **Säulen** (Deckung gegen Geschütze) und **Rampen** (eine lange
   Abfahrt als Beschleuniger, eine lange Auffahrt als Schanze).
   Die Auswahl ist bewusst deterministisch: Beim Würfeln mit Neuversuch
   verschwanden ganze Typen aus der Rotation – Säulenräume kamen nur noch
   in 1 % der Fälle vor, und gerade die liefern die Deckung, ohne die man
   sich an keinem Geschütz vorbeischleichen kann.
2. Danach wird eine **Treppe zum Schalter garantiert eingezogen** – Stufen
   von höchstens 2 Kacheln Höhe und 4 Breite, also mit großem Abstand zu
   dem, was die Physik hergibt (3.09 hoch, über 15 weit).
3. Gefahren werden nie so gesetzt, dass ein Weg komplett dicht ist.

Nachgewiesen mit `scratchpad/solver_test.js` bzw. `solver_mines.js`: eine
Strahlensuche, die den Raum mit der **echten Physik** durchspielt (Minen
als tödliche Hindernisse eingerechnet). Findet sie einen Weg, ist der Raum
bewiesen lösbar. Stand: 80 von 80 geprüften Räumen der Nummern 10–17.

Diese Prüfung hat drei echte Fehler aufgedeckt, die im Spiel jeweils einen
Lauf beendet hätten:

1. **Rampen versiegelten Kletterschächte.** Ein Schacht lässt unten bewusst
   eine Zeile als Durchgang frei – eine Rampe füllte genau die auf und machte
   aus dem Schacht eine raumhohe Mauer quer durch den Raum. Rampen halten
   jetzt Abstand zu hohen Wänden.
2. **Das Erreichbarkeitsmodell war zu großzügig.** Es merkte sich nur
   „in dieser Spalte gibt es irgendwo Wände links und rechts" und hielt eine
   Plattform dadurch für per Wandsprung erreichbar, obwohl die Wandpaarung
   nur in einer einzigen Zeile existierte. Jetzt muss der Schacht die ganze
   Höhe zwischen beiden Flächen abdecken.
3. **Minen in Engpässen.** Zwei Minen lagen übereinander in der einzigen
   Lücke zum Schalter. Minen liegen jetzt nur noch auf Flächen von
   mindestens fünf Kacheln Breite und nie am Rand oder in einem Schacht.

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

## Der Tod als Pointe

In N ist das Sterben nicht bloß ein Game-Over, sondern die Pointe: Die Figur
klappt zusammen und purzelt mit dem Schwung weiter, den sie hatte. In einem
Spiel, in dem man ständig stirbt, ist genau das der Unterschied zwischen
„nochmal!" und „weg damit".

Hier umgesetzt als Verlet-Puppe aus sieben Punkten (Kopf, Brust, Becken,
zwei Arme, zwei Beine) mit Abstands-Zwangsbedingungen, die gegen dieselbe
Weltgeometrie kollidiert wie die Spielfigur. Zwei Fallen dabei, beide
behoben: Die Schwerkraft beschleunigt die Punkte in wenigen Frames über die
Dicke ihrer Kollisionshülle hinaus (sie tunnelten durch den Boden), und wer
auf dem Boden stirbt, hat die Beine bereits *im* Boden – ein Punkt im
Inneren wird beim Entpenetrieren in die falsche Richtung gedrückt und zieht
die ganze Puppe nach unten.

## Die Uhr ist dein Leben – und der Tod beendet nichts

Zwei Regeln aus dem Original, die die ganze Spannung tragen:

**Ein durchlaufender Countdown statt Rundenuhr.** In N sind die 90 Sekunden
nicht pro Level, sondern die *Lebensspanne* des Ninjas über eine ganze
Episode. Hier läuft genauso eine einzige Uhr durch den kompletten Lauf:
Start 45 s, pro geschafftem Raum +10 s, Deckel bei 99 s.

**Gold zählt erst an der Tür.** Jedes Stück bringt +2 s (exakt wie im
Original), aber gutgeschrieben wird es erst beim Durchschreiten der Tür.
Stirbst du vorher, ist es weg. Das macht den Rückweg zur eigentlichen
Entscheidung: Nimmst du das Goldstück neben dem Geschütz noch mit?
Ungebanktes Gold steht sichtbar getrennt neben der Uhr (`+6s`).

**Sterben kostet Zeit, nicht den Lauf.** In N startet man nach dem Tod
sofort dasselbe Level neu, ohne Strafe. Hier kostet ein Tod 3 Sekunden,
das ungebankte Gold und den Fortschritt im Raum – aber der Lauf geht
weiter. Der einzige echte Gegner ist die Uhr. Das erhält das „sofort
nochmal" des Originals und passt zugleich zur Vorgabe, es spürbar
zu entschärfen.

## Bewusst noch offen

- **Schrägen** sind eingebaut (Rampen ab Raum 2), aber noch sparsam
  eingesetzt. Im Original prägen sie ganze Levelabschnitte – hier wäre mehr
  drin, etwa durchgehende Rutschen über den halben Raum.
- **Raumvielfalt**: vier Archetypen sind ein Anfang, keine Endlösung.
- Die Zahlen für Zeit, Gegnerdichte und Geschütz-Timing sind ein erster
  Wurf und noch nicht über viele Runden gegengespielt.
