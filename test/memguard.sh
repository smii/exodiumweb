# Sourced by run-detached.sh (both the launcher and the detached runner).
# The CloudCLI pod has a 4 GiB limit shared by Claude, the dev server and
# Chromium + the emulator; going over it OOM-kills the *whole pod*, chat
# included. Usage = cgroup usage minus reclaimable page cache.
CG=/sys/fs/cgroup
# Defaults follow the pod's real limit (raised 4 → 10 GiB on 2026-10-09):
# stop a test at 85% of it, don't start one above 50%.
_max=$(cat "$CG/memory.max" 2>/dev/null)
case "$_max" in ''|max|*[!0-9]*) _max=$((4096 * 1048576)) ;; esac
MEM_KILL_MIB="${MEM_KILL_MIB:-$(( _max / 1048576 * 85 / 100 ))}"
MEM_START_MIB="${MEM_START_MIB:-$(( _max / 1048576 / 2 ))}"
used_mib() {
  local cur inact
  cur=$(cat "$CG/memory.current" 2>/dev/null) || { echo 0; return; }
  inact=$(awk '$1=="inactive_file"{print $2}' "$CG/memory.stat" 2>/dev/null)
  echo $(( (cur - ${inact:-0}) / 1048576 ))
}
