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
(`tools/physik_test.js`):

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

### Ein Fehler, der lange unsichtbar war: die Schrägen waren umgestülpt

Die Weltgeometrie wird in *orientierte* Liniensegmente zerlegt – jede Kante
weiß, welche Seite außen ist. Bei allen vier Schrägen-Typen war die
Hypotenuse **verkehrt herum gewickelt**: Außen lag rechnerisch auf der
massiven Seite. Die beiden Katheten stimmten, damit widersprachen sich die
Segmente ein und derselben Kachel.

Beim Laufen über eine Rampe fiel das nie auf, weil dort meist die Kante der
massiven Nachbarkachel näher liegt und die Abfrage gewinnt. Sichtbar wurde
es erst im Dauerlauf-Test (`tools/browser/soak.js`), als ein Schalter direkt
über einer einzeln stehenden Schräge lag: Die Figur galt dort als „in der
Wand" und wurde in einem einzigen Bild **80 Pixel weit** weggeschoben – der
Schalter war nicht auslösbar, der Raum nicht zu schaffen. Betroffen waren
28 von 1200 geprüften Räumen; jetzt sind es 0 (größte Abweichung 0,1 px).

Nebenbei stimmt seitdem auch etwas, das hier vorher fälschlich behauptet
stand: Auf einer langen Abwärtsschräge wird man jetzt **wirklich schneller
als auf flachem Boden** (3,42 gegen 3,33 px/Frame). Vorher kam die
Abfahrt auf 3,32 – also kein Extra-Schub, und der ganze Zweck eines
Rampen-Raums war damit dahin.

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

  Nachgemessen (`tools/turret_test2.js`): Stillstehen → tot nach 2,2 s.
  Volles Tempo durchlaufen → überlebt, obwohl fünf Schüsse fallen; sie gehen
  alle dorthin, wo man *war*.

## Räume: endlos, aber garantiert lösbar

Ein Raum = ein Bildschirm, kein Scrollen – wie im Original. Man sieht alle
Gefahren auf einen Blick und plant die Route, bevor man losläuft.

Bei dieser Physik wäre ein unschaffbarer Raum das sofortige Ende eines Laufs.
Deshalb wird nicht frei gewürfelt:

1. Sieben Archetypen werden konstruktiv gebaut und reihum durchgewechselt:

   | # | Raumtyp | wofür er da ist |
   |---|---|---|
   | 0 | Plattformen | Sprungpräzision |
   | 1 | Schacht | eine lange Wandsprung-Kette |
   | 2 | Säulen | Deckung gegen Geschütze |
   | 3 | Rampen | lange Abfahrt als Beschleuniger, Gegenrampe als Schanze |
   | 4 | Wellental | Rutsche runter, mit dem Schwung die andere Flanke hoch |
   | 5 | Kamin-Kette | mehrere Aufstiege nebeneinander, man wählt den Weg |
   | 6 | Terrassen | Treppe mit Brüstungen – Deckung Stufe für Stufe |

   Die Auswahl ist bewusst deterministisch: Beim Würfeln mit Neuversuch
   verschwanden ganze Typen aus der Rotation – Säulenräume kamen nur noch
   in 1 % der Fälle vor, und gerade die liefern die Deckung, ohne die man
   sich an keinem Geschütz vorbeischleichen kann.
2. Danach wird eine **Treppe zum Schalter garantiert eingezogen** – Stufen
   von höchstens 2 Kacheln Höhe und 4 Breite, also mit großem Abstand zu
   dem, was die Physik hergibt (3.09 hoch, über 15 weit).
3. Gefahren werden nie so gesetzt, dass ein Weg komplett dicht ist.

Nachgewiesen mit `tools/solver_test.js` bzw. `tools/solver_mines.js`
(`npm run check:loesbar`): eine Strahlensuche, die den Raum mit der
**echten Physik** durchspielt – Minen als tödliche Hindernisse eingerechnet.
Findet sie einen Weg, ist der Raum bewiesen lösbar; findet sie keinen, heißt
das „nicht nachgewiesen", nicht „unmöglich". Stand: **216 von 216**
geprüften Räumen – je 108 aus den Nummern 0–8 und 12–20, über zwölf Seeds,
also alle sieben Archetypen mehrfach.

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

### Und einen vierten, den erst das Nachmessen zeigte

Das Erreichbarkeitsmodell war an einer Stelle **zu streng**, und das war
schlimmer als zu großzügig: Es forderte für einen Kletterschacht, dass auch
die oberste Zeile beidseitig eingefasst ist. Das ist die Zeile, in der man
oben aussteigt – dort *muss* es offen sein. Folge: Kein Kamin galt je als
erreichbar. Nachgemessen über 900 Räume lag der Schalter in Schacht-Räumen
nie höher als 7 Kacheln, obwohl das Podest oben im Schacht auf 10 bis 12
sitzt. Die Wandsprung-Kette, für die es diesen Raumtyp überhaupt gibt, kam
also in keinem einzigen Raum vor. Dasselbe bei den Säulen: Die Höhen waren
frei gewürfelt, keine Spitze war erreichbar, und der Schalter landete in
60 % der Fälle unten auf dem Boden.

| Raumtyp | Schalterhöhe vorher | jetzt | auf dem Boden |
|---|---|---|---|
| Schacht | Ø 6,1 (max 7) | Ø 8,7 (max 12) | 5 % → 0 % |
| Säulen | Ø 1,5 (max 8) | Ø 6,6 (max 10) | 60 % → 3 % |

### Und einen fünften: das Modell kannte keine Decken

Gefunden hat ihn die Laufzeit-Simulation (`tools/run_sim.js`), nicht die
Lösbarkeitsprüfung – weil sie auch den **Rückweg zur Tür** mitspielt und
dadurch mehr Räume anfasst. Ein Raum hatte eine Rampe, die unter eine Platte
führte:

```
 8 #...M....................#
 9 #..#####.................#     <- Platte
10 #...\....................#     <- Rampe endet hier, zwei Kacheln darunter
11 #...#\...................#
12 #...##\..................#
13 #...###\.S.D....M........#
```

Die oberste Rampenstufe liegt genau zwei Kacheln unter der Platte – nach
Höhe und Weite also erreichbar. Nur ist direkt über dem Kopf massiv:
springen geht nicht, seitlich heraus geht nur hinunter, und vom Boden aus
sind es fünf Kacheln. Der Schalter lag auf dieser Platte, der Raum war nicht
lösbar. Das Modell prüft jetzt, ob es zwischen den beiden Flächen überhaupt
eine freie Spalte gibt.

Dieselbe Prüfung entwertete anschließend ein Viertel aller Plattform-Räume:
Frei gewürfelte Plattformen landen oft direkt übereinander, und der Schalter
rutschte zurück auf den Boden. Sie werden deshalb nicht mehr gewürfelt,
sondern als Schlangenlinie gesetzt – abwechselnd nach links und rechts, je
zwei Kacheln höher, drei bis fünf Kacheln Lücke.

## Steuerung

Zwei Varianten, im Menü und in der Pause umschaltbar – bitte beide auf dem
Handy antesten, die schlechtere fliegt danach raus:

- **Bildschirmhälften** (Voreinstellung): linkes Viertel = links laufen,
  zweites Viertel = rechts laufen, rechte Hälfte = Sprung (halten = höher).
  Entspricht am genauesten der Tastatursteuerung des Originals, das dort
  ebenfalls digital ist, nicht analog.
- **Joystick**: Daumen-Stick erscheint links, wo man aufsetzt; Sprung rechts.

Unter dem Umschalter steht ein daumengroßes Schaubild vom Handy mit den
Zonen. Zwei Wörter erklären den Unterschied nicht – und genau diese Wahl
soll am Gerät getroffen werden, nicht im Kopf.

Am Rechner: Pfeiltasten/A+D laufen, Leertaste/Pfeil hoch springen, Esc pausiert.

**Die Zonen hängen am Bildschirm, nicht an der Spielfläche.** Das Spiel läuft
in 640×360 und wird mittig eingepasst; ein heutiges Handy im Querformat ist
eher 19,5:9, also bleiben links und rechts schwarze Balken – und genau dort
liegen beim Halten die Daumen. Vorher waren die Zonen an der Spielfläche
festgemacht, damit war der äußerste Zentimeter auf beiden Seiten tot.
Nachgewiesen mit `tools/browser/touch_bars.js`: ein 900×360 breites
Fenster (130 px Balken je Seite), Berührungen mitten im Balken müssen laufen
und springen auslösen – auch beide gleichzeitig. Wie breit diese Balken auf
echten Geräten sind, misst `tools/browser/viewports.js`:

| Gerät (quer) | Balken je Seite |
|---|---|
| iPhone SE (568×320) | 0 px – passt genau |
| iPhone 14 (844×390) | 75 px |
| Pixel (892×412) | 80 px |

Auf zwei von drei Geräten wären also je gut anderthalb Zentimeter am Rand
tot gewesen – genau dort, wo die Daumen liegen.

Zwei weitere Fallen, beide behoben: „Loslassen" wird jetzt am **Fenster**
abgefangen statt am Element (wandert der Daumen beim Loslassen über den
Rand, kam das Ereignis sonst nie an und die Figur lief weiter), und
`pointerleave` ist raus – das feuerte schon, wenn der Sprungdaumen kurz über
die Kante rutschte, und ließ mitten im Sprung die Taste los. Bei variabler
Sprunghöhe ist das sofort spürbar.

## Schwierigkeit

Nach Absprache **spürbar entschärft**, aber nicht zahnlos:

- Gegner töten weiterhin sofort – das ist die Spannung beim Anschleichen.
- Der Aufpralltod ist milder eingestellt (Schwelle 7.5 statt 6, tödlich erst
  ab ca. 14 statt 10 Kacheln Sturz). Im Menü auf "original (hart)"
  umschaltbar, um beides direkt zu vergleichen.
- Raum 1 ist bewusst leer: dort lernt man die Bewegung ohne Strafe.
  Minen ab Raum 2, Drohnen ab Raum 3, Geschütze ab Raum 4.

Wie hart das wirklich ist, lässt sich messen, ohne einen Spieler zu
simulieren (`tools/pressure_test.js`): Figur auf eine begehbare Kachel
setzen, **nichts drücken**, Zeit bis zum Tod stoppen. Genau das ist die
Zeit, die man zum Überlegen hat. 24 Seeds, 14 Stellen je Raum, Kacheln
direkt an einer Mine ausgenommen:

| Raum | Anteil tödlicher Stellen | Median bis zum Schuss | Geschütze |
|---|---|---|---|
| 1–2 | 0 % | – | 0 |
| 3 | 17 % | 1,7 s | 0 |
| 4–7 | 38–45 % | 1,6 s | 1 |
| 8–11 | 53–65 % | 1,6 s | 2 |
| 12–20 | 63–70 % | 1,4 s | 3 |

Drei saubere Stufen, je eine pro Geschütz, danach ein Plateau. Das ist
Absicht: **Ab Raum 12 steigt nicht mehr die Gefahr, sondern der Zeitdruck**
(siehe unten). Ein Raum, in dem 100 % der Stellen tödlich wären, hätte keine
Deckung mehr – und Deckung ist die halbe Spielmechanik.

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
Start 45 s, Deckel bei 99 s.

**Die Gutschrift pro Raum schrumpft** – von 10 s auf 6 s ab Raum 25, eine
Sekunde weniger alle fünf Räume. Das ist keine Willkür, sondern nachgemessen
(`tools/run_sim.js`): Die Strahlensuche spielt jeden Raum vollständig
durch, Hinweg zum Schalter und Rückweg zur Tür, und braucht

| | Sekunden |
|---|---|
| im Median | 6,7 |
| in 90 % der Fälle unter | 9,0 |
| schnellster / langsamster Raum | 2,2 / 15,2 |

Bei festen 10 s hieß das für jemanden, der kaum stirbt: Die Uhr klebt
dauerhaft am Deckel. Sechs simulierte Läufe über vierzehn Räume endeten alle
mit 94 bis 99 s Rest – der Lauf wäre nie zu Ende gegangen. Ein Endlosspiel
ohne Ende ist aber keins, sondern nur ein Spiel ohne Pointe. Ab Raum 25
liegt die Gutschrift knapp unter dem Median, von da an kostet jeder Raum
netto Zeit und der Lauf läuft aus. Bis Raum 5 bleibt es bei den vollen
10 s, damit Anfänger nichts davon merken. Nach jeder Tür steht kurz
sichtbar, wie viel es war (`+8s`) – sonst würde niemand merken, dass die
Luft dünner wird.

Ehrlicherweise: Für jemanden, der wirklich kaum stirbt, ist auch das keine
harte Grenze. Drei Goldstücke pro Raum bringen zusammen 6 s, die Uhr steht
also weiter am Deckel, solange man sie einsammelt und lebend zur Tür kommt.
Der eigentliche Gegner ist dann nicht mehr die Uhr, sondern das Sterben – so
wie im Original auch. Die schrumpfende Gutschrift sorgt nur dafür, dass es
nicht *beliebig* lange gut geht.

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

- **Die Steuerung muss aufs echte Gerät.** Beide Varianten sind eingebaut
  und im Menü umschaltbar; welche bleibt, entscheidet der Daumen, nicht die
  Theorie. Die schlechtere fliegt danach raus, damit das Menü kleiner wird.
- **Gegnerdichte und Geschütz-Timing** sind weiterhin ein erster Wurf. Die
  Zeit ist inzwischen gegengerechnet, diese beiden nicht – dafür bräuchte es
  echte Runden, keine Suche.
- **Die Strahlensuche ist kein Mensch.** Sie stirbt nicht an Geschützen, sie
  verwirft nur die Äste, in denen sie stirbt. Für Geometrie und Zeit ist sie
  ein guter Maßstab, für Nervenkitzel nicht. Sie hält Eingaben außerdem
  immer zehn Bilder am Stück – **tippen kann sie nicht**, und damit auch
  keine Wandsprung-Kette. Dass trotzdem jeder Raum als lösbar durchgeht,
  liegt an der garantierten Treppe: Sie ist der Weg für alle, die den Kamin
  nicht hochkommen. In der Simulation blieben genau drei Räume ohne
  gefundenen Weg, alle drei Schacht-Räume – dort ist der Kamin die schnelle
  Route und die Treppe der Umweg.

Alle Werkzeuge liegen unter `tools/` mit eigener Beschreibung, oder als
`npm run check:physik`, `check:raeume`, `check:loesbar`, `check:zeit`,
`check:druck`.
