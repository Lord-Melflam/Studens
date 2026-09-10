#!/usr/bin/env bash
# Fetch institution logos for the frontend design draft.
#
# NOT COMMITTED, on purpose. Two reasons:
#   - the EPL mark is CC BY-SA 4.0, and a share-alike file sits awkwardly in a
#     repository whose README promises MIT inbound equals outbound
#   - a logo is a TRADEMARK regardless of the copyright status of the file, so
#     the repository should not look like it ships them
#
# Licences as recorded on Wikimedia Commons, checked 2026-09-10:
#   UCLouvain logo.svg                        Public domain
#   Universite libre de Bruxelles logo.svg    Public domain
#   Logo EPL.svg                              CC BY-SA 4.0, Administration UCLouvain EPL
#
# "Public domain" here means below the threshold of originality for COPYRIGHT.
# It says nothing about trademark. See the design document, section on marks.
set -euo pipefail

dir="$(cd "$(dirname "$0")/.." && pwd)/docs/design/frontend/logos"
mkdir -p "$dir"
ua="StudensDesignDraft/0.1 (+https://github.com/Lord-Melflam/Studens)"

fetch() { # <commons file name> <output stem>
  local url
  url=$(curl -s -m 25 -A "$ua" \
    "https://commons.wikimedia.org/w/api.php?action=query&titles=File:$(printf %s "$1" | sed 's/ /%20/g')&prop=imageinfo&iiprop=url&format=json" \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); print(next(iter(d["query"]["pages"].values()))["imageinfo"][0]["url"])')
  curl -s -m 30 -A "$ua" "$url" -o "$dir/$2.svg"
  rsvg-convert -f pdf -h 160 "$dir/$2.svg" -o "$dir/$2.pdf"
  printf '  %-28s %s bytes\n' "$2.pdf" "$(stat -c%s "$dir/$2.pdf")"
}

fetch "UCLouvain logo.svg" uclouvain
fetch "Logo EPL.svg" epl
fetch "Université libre de Bruxelles logo.svg" ulb
echo "logos in $dir (gitignored)"
