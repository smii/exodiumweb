#!/bin/bash
# The detached half of run-detached.sh (started via setsid; don't call by hand).
# Runs with-server.sh <command...> (or $RUN_WRAPPER, e.g. no-server.sh for a deployed instance) under a time limit and the memory guard.
#   guarded-run.sh <run-dir> <max-seconds> <lock-file> <mem-limit-MiB> <command...>
dir="$1"; max="$2"; lock="$3"; limit="$4"; shift 4
here="$(cd "$(dirname "$0")" && pwd)"
exec 2>> "$dir/trace"
source "$here/memguard.sh"
cd "$here"
echo running > "$dir/status"

# timeout(1) moves itself and the test into a process group of its own
# (pgid = its pid), so that group is what has to be killed, Chromium included.
timeout --kill-after=15 "$max" bash "$here/${RUN_WRAPPER:-with-server.sh}" "$@" > "$dir/log" 2>&1 &
job=$!
echo "$job" > "$dir/test_pgid"

finish() {
  echo "$1" > "$dir/status"
  kill -9 -- "-$job" 2>/dev/null
  rm -f "$lock"
  exit 0
}

peak=0
while kill -0 "$job" 2>/dev/null; do
  u=$(used_mib)
  # Fail closed: an unreadable value stops the test instead of letting it
  # run unguarded (the first version OOM-killed the pod exactly like that).
  case "$u" in ''|*[!0-9]*) echo "unreadable memory value '$u'" >&2; u=999999 ;; esac
  if [ "$u" -gt "$peak" ]; then peak=$u; echo "$peak" > "$dir/peak_mib"; fi
  if [ "$u" -gt "$limit" ]; then
    echo "[guard] pod memory ${u} MiB > ${limit} MiB: stopping the test" >> "$dir/log"
    finish "memkill ${u}MiB"
  fi
  sleep 1
done
wait "$job"; rc=$?
if [ "$rc" = 124 ] || [ "$rc" = 137 ]; then finish timeout; else finish "done $rc"; fi
