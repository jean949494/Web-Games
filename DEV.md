# Entwickeln & Testen

Zwei Wege zum Testen – einer am Rechner, einer auf dem Handy.

## 1. Am Rechner: Dev-Server mit Live-Reload

```
npm run dev
```

Öffnet `http://localhost:5173/`. Dort siehst du die Spieleübersicht,
ein Tipp aufs Spiel startet es. **Jede gespeicherte Änderung lädt die
Seite automatisch neu** – kein manuelles Aktualisieren nötig.

Es ist keine Installation nötig (kein `npm install`), nur Node.

Die Konsole zeigt beim Start zusätzlich eine WLAN-Adresse
(`http://192.168.x.x:5173/`). Wenn dein Handy im selben WLAN ist, kannst
du die im Handy-Browser öffnen und sofort die Touch-Steuerung testen –
ganz ohne Deploy. Beenden mit `Strg+C`.

## 2. Auf dem Handy: öffentliche Test-URL

Die Seite liegt auf GitHub Pages unter:

```
https://jean949494.github.io/Web-Games/
```

Einzelnes Spiel direkt:
`https://jean949494.github.io/Web-Games/games/ninja-wandsprung/`

**Aktualisieren nach einer Änderung:**

```
npm run deploy
```

Das committet deine Änderungen und lädt sie hoch. Nach ca. einer Minute
ist die neue Version live – auf dem Handy einfach die Seite neu laden.
Der Link bleibt immer gleich.

Optional mit eigener Beschreibung:

```
npm run deploy "Sprunghöhe angepasst"
```

### Einmalige Einrichtung von GitHub Pages

Nur beim allerersten Mal nötig:

1. Im Browser öffnen: `github.com/jean949494/Web-Games/settings/pages`
2. Bei **Source**: „Deploy from a branch" wählen
3. Branch: **`main`**, Ordner: **`/ (root)`**
4. **Save**

Danach zeigt dieselbe Seite oben die genaue URL an.

## Ein neues Spiel hinzufügen

1. Neuen Ordner `games/<spielname>/` anlegen mit eigener `index.html`
2. In der `index.html` im Repo-Root eine Karte für das Spiel ergänzen
3. `npm run deploy` – fertig, das neue Spiel ist unter
   `https://jean949494.github.io/Web-Games/games/<spielname>/` erreichbar

## Kurzfassung

| Zweck | Befehl |
|---|---|
| Beim Coden sofort sehen | `npm run dev` |
| Auf echtem Handy testen | `npm run deploy`, dann Seite neu laden |
