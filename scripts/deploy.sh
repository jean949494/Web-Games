#!/usr/bin/env bash
#
# Schickt den aktuellen Stand auf die öffentliche Test-URL.
#
# GitHub Pages ist so eingerichtet, dass es direkt den main-Branch
# ausliefert. Deployen heißt darum schlicht: committen und pushen.
# Dieses Skript macht beides in einem Schritt.
#
#   npm run deploy                      -> Commit-Nachricht mit Zeitstempel
#   npm run deploy "Sprung abgeschwächt" -> eigene Commit-Nachricht
#
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

MESSAGE="${1:-Update $(date '+%d.%m.%Y %H:%M')}"

if [ -z "$(git status --porcelain)" ]; then
  echo "Keine Änderungen zum Deployen – alles schon hochgeladen."
else
  git add -A
  git commit -m "$MESSAGE"
fi

echo "Lade hoch ..."
for attempt in 1 2 3 4; do
  if git push origin HEAD; then
    break
  fi
  if [ "$attempt" = "4" ]; then
    echo "Push fehlgeschlagen. Internetverbindung prüfen und erneut versuchen." >&2
    exit 1
  fi
  wait=$((2 ** attempt))
  echo "Push fehlgeschlagen, neuer Versuch in ${wait}s ..."
  sleep "$wait"
done

echo ""
echo "Fertig. GitHub Pages baut die Seite in ca. 1 Minute neu."
echo "Danach auf dem Handy einfach die Seite neu laden."
