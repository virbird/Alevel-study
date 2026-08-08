#!/bin/bash
SRC="/Users/lutang/Downloads/Eva-练习/A-level/IG/计算机科学0478/CIE-IGCSE-0478计算机科学-新版教材/46. Computer Science for Cambridge IGCSE & O Level COURSEBOOK.pdf"
OUT=/tmp/cs_raw_chapters
rm -rf "$OUT"
mkdir -p "$OUT"
while IFS='|' read -r n start end name; do
  file="$OUT/$name.txt"
  > "$file"
  for ((i=start; i<=end; i++)); do
    echo "" >> "$file"
    echo "[p.$i]" >> "$file"
    pdftotext -f $i -l $i -layout "$SRC" - 2>/dev/null >> "$file"
  done
  lines=$(wc -l < "$file")
  echo "OK $name: $lines lines"
done < /tmp/cs_ranges.txt
echo "=== ALL DONE ==="
