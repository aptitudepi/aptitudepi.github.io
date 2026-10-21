#!/usr/bin/env bash
# tools/media-watch.sh — folder-action: inbox drop → media-push --upload → R2.
# Watches $1 / $INBOX_DIR (default ~/Pictures/Blog-Inbox) for close_write/moved_to
# of jpg/jpeg/png/heic/heif/webp/avif; success → notify + mv to .done/, fail → notify + log.
# Needs: inotify-tools. Autostart: copy tools/media-watch.{path,service} to
# ~/.config/systemd/user/ (NOT enabled by default — see PLAN-BLOG.md App W).
# Usage: bash tools/media-watch.sh [~/Inbox]   (INBOX_DIR env also honored)
set -u
INBOX="${1:-${INBOX_DIR:-$HOME/Pictures/Blog-Inbox}}"
SCRIPT="$(dirname "$0")/media-push.mjs"
command -v inotifywait >/dev/null || { echo "media-watch: install inotify-tools (sudo apt install inotify-tools)" >&2; exit 1; }
[ -f "$SCRIPT" ] || { echo "media-watch: $SCRIPT missing" >&2; exit 1; }
mkdir -p "$INBOX" "$INBOX/.done"
LOG="$INBOX/media-watch.log"
say() { command -v notify-send >/dev/null && notify-send "media-watch: $1" "$2" || true; echo "$(date -Is) $1 $2" >>"$LOG"; }
inotifywait -m -e close_write,moved_to --format '%f' "$INBOX" | while IFS= read -r f; do
  case "${f,,}" in *.jpg|*.jpeg|*.png|*.heic|*.heif|*.webp|*.avif) ;; *) continue;; esac
  if url=$(node "$SCRIPT" "$INBOX/$f" --upload 2>>"$LOG"); then
    mv "$INBOX/$f" "$INBOX/.done/" && say "uploaded" "$url" || say "uploaded (move failed)" "$url"
  else
    say "FAILED (left in place)" "$f — see $LOG"
  fi
done
