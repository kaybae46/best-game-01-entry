#!/bin/bash
# Take MOTHLIGHT's screenshots: each ?shot= scene rendered by the game's own code in a
# headless browser, then converted to JPEG (the gate wants PNG or JPEG, each at most
# 256 KiB, long side at most 1280, short side at least 480). Run from the repo root
# with the static server already up on :8901.
set -e
SHELL_BIN="$HOME/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"
OUT="$HOME/workspace/makefun/best-game-01-entry/screenshots"
TMP="$(mktemp -d)"
for spec in "1-start.jpg:?shot=start&seed=1" "2-play.jpg:?shot=play&seed=1" "3-surge.jpg:?shot=surge&seed=8" "4-end.jpg:?shot=end&seed=2"; do
  name="${spec%%:*}"
  query="${spec#*:}"
  "$SHELL_BIN" --headless --disable-gpu --no-sandbox --window-size=1280,720 --hide-scrollbars \
    --virtual-time-budget=20000 --screenshot="$TMP/$name.png" "http://localhost:8901/$query" 2>/dev/null
  python3 - "$TMP/$name.png" "$OUT/$name" <<'PY'
import sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
img = Image.open(src).convert('RGB')
for quality in (88, 80, 72, 64):
    img.save(dst, 'JPEG', quality=quality)
    import os
    if os.path.getsize(dst) <= 262144:
        break
print(dst, os.path.getsize(dst), 'bytes, quality', quality, img.size)
PY
done
rm -rf "$TMP"
ls -la "$OUT"
