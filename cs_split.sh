#!/bin/bash
set -e
SRC="/Users/lutang/Downloads/Eva-练习/A-level/IG/计算机科学0478/CIE-IGCSE-0478计算机科学-新版教材"
WORK=/tmp/cs_split
OUT="$SRC/分章节"
while IFS='|' read -r n start end name; do
  pages=""
  for ((i=start; i<=end; i++)); do
    f=$(printf "%s/page-%03d.pdf" "$WORK" "$i")
    pages="$pages $f"
  done
  pdfunite $pages "$OUT/$name.pdf" 2>/dev/null
  cnt=$((end-start+1))
  got=$(pdfinfo "$OUT/$name.pdf" 2>/dev/null | awk '/^Pages/{print $2}')
  echo "OK $name: expect=$cnt actual=$got"
done < /tmp/cs_ranges.txt
echo "=== ALL DONE ==="
ls -la "$OUT"
