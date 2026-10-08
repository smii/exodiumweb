# Sourced by run-detached.sh (both the launcher and the detached runner).
# The CloudCLI pod has a 4 GiB limit shared by Claude, the dev server and
# Chromium + the emulator; going over it OOM-kills the *whole pod*, chat
# included. Usage = cgroup usage minus reclaimable page cache.
CG=/sys/fs/cgroup
MEM_KILL_MIB="${MEM_KILL_MIB:-3200}"   # stop a test above this
MEM_START_MIB="${MEM_START_MIB:-2000}" # don't start one above this
used_mib() {
  local cur inact
  cur=$(cat "$CG/memory.current" 2>/dev/null) || { echo 0; return; }
  inact=$(awk '$1=="inactive_file"{print $2}' "$CG/memory.stat" 2>/dev/null)
  echo $(( (cur - ${inact:-0}) / 1048576 ))
}
