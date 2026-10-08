#!/bin/bash
# Run a test command (wrapped in with-server.sh) fully detached from the
# calling shell, so it survives the Claude/CloudCLI session restarting — a
# restart kills every child of the session, background jobs included, and the
# chat then just looks hung.
#
#   bash run-detached.sh start <name> <max-seconds> <command...>
#   bash run-detached.sh status [name]     state of one run, or all runs
#   bash run-detached.sh stop <name>
#
# Guards: one run at a time (they share port 8090 — a stale lock whose
# process is gone is cleared), a hard time limit, and the whole process group
# is killed when the limit hits, Chromium included.
# Output: runs/<name>/{log,status,pid}; status is running|done <rc>|timeout|stopped.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
RUNS="$HERE/runs"
LOCK="$RUNS/.active"
mkdir -p "$RUNS"

alive() { [ -n "${1:-}" ] && kill -0 "$1" 2>/dev/null; }

source "$HERE/memguard.sh"

case "${1:-}" in
  start)
    name="$2"; max="$3"; shift 3
    if [ -f "$LOCK" ]; then
      read -r other pid < "$LOCK"
      if alive "$pid"; then echo "busy: run '$other' (pid $pid) is still going"; exit 2; fi
      echo "clearing stale lock from '$other'"
      rm -f "$LOCK"
    fi
    used=$(used_mib)
    if [ "$used" -gt "$MEM_START_MIB" ]; then echo "refusing: pod already uses ${used} MiB (> ${MEM_START_MIB})"; exit 3; fi
    dir="$RUNS/$name"; rm -rf "$dir"; mkdir -p "$dir"
    # setsid: new session + process group, reparented to PID 1 when we exit.
    setsid bash "$HERE/guarded-run.sh" "$dir" "$max" "$LOCK" "$MEM_KILL_MIB" "$@" < /dev/null > /dev/null 2>&1 &
    pid=$!
    echo "$pid" > "$dir/pid"
    echo "$name $pid" > "$LOCK"
    echo "started '$name' (pid $pid, limit ${max}s) -> $dir/log"
    ;;
  status)
    for dir in "$RUNS"/${2:-*}/; do
      [ -d "$dir" ] || continue
      n="$(basename "$dir")"; st="$(cat "$dir/status" 2>/dev/null || echo '?')"; pid="$(cat "$dir/pid" 2>/dev/null)"
      if [ "$st" = running ] && ! alive "$pid"; then st="died (no status written)"; fi
      age=$(( $(date +%s) - $(stat -c %Y "$dir/log" 2>/dev/null || date +%s) ))
      echo "$n: $st, log idle ${age}s, peak $(cat "$dir/peak_mib" 2>/dev/null || echo ?) MiB (pod now $(used_mib) MiB)"
      [ -n "${2:-}" ] && tail -n 15 "$dir/log" 2>/dev/null
    done
    ;;
  mem)
    echo "pod memory $(used_mib) MiB (stop above ${MEM_KILL_MIB}, start below ${MEM_START_MIB})"
    ;;
  stop)
    pid="$(cat "$RUNS/$2/pid" 2>/dev/null)"; tg="$(cat "$RUNS/$2/test_pgid" 2>/dev/null)"
    alive "$pid" && kill -9 -- "-$pid" 2>/dev/null
    [ -n "$tg" ] && kill -9 -- "-$tg" 2>/dev/null
    echo stopped > "$RUNS/$2/status"; rm -f "$LOCK"; echo "stopped '$2'"
    ;;
  *) sed -n '2,15p' "$0"; exit 1 ;;
esac
