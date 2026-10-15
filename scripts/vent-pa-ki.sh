#!/bin/sh
# Venter til det ligger en ubesvart forespørsel i rapportkøen (data/ki-ko), og skriver den ut.
# Brukes av Claude Code-økten som svarer på forespørslene fra nettsiden.
cd "$(dirname "$0")/.." || exit 1
mkdir -p data/ki-ko
while true; do
  for f in data/ki-ko/*.foresporsel.json; do
    [ -e "$f" ] || continue
    svar="${f%.foresporsel.json}.svar.json"
    if [ ! -e "$svar" ]; then
      echo "NY FORESPØRSEL: $f"
      exit 0
    fi
  done
  sleep 2
done
