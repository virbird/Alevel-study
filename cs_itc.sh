#!/bin/bash
SRC="/Users/lutang/Downloads/Eva-练习/A-level/IG/计算机科学0478/CIE-IGCSE-0478计算机科学-新版教材/46. Computer Science for Cambridge IGCSE & O Level COURSEBOOK.pdf"
OUT=/tmp/cs_raw_chapters
# 章首页前一页即 LEARNING INTENTIONS 页（Ch01 用 PDF 18）
while IFS='|' read -r n start end name; do
  itc=$((start-1))
  tmp="$OUT/.itc_$name.txt"
  echo "=== LEARNING INTENTIONS (PDF p.$itc) ===" > "$tmp"
  pdftotext -f $itc -l $itc -layout "$SRC" - 2>/dev/null >> "$tmp"
  # 注入到章开头（保持 [p.N] 标记风格）
  { echo ""; echo "[p.$itc LEARNING INTENTIONS]"; cat "$tmp"; echo ""; cat "$OUT/$name.txt"; } > "$OUT/.merged_$name.txt"
  mv "$OUT/.merged_$name.txt" "$OUT/$name.txt"
  rm -f "$tmp"
  echo "OK $name: ITC injected from p.$itc"
done < /tmp/cs_ranges.txt
echo "=== DONE ==="
