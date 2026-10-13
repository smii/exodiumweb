"""Survey eXoDOS dosbox.conf files for features the browser player must handle.

Usage: python3 -I survey_confs.py <eXoDOS_configs.zip> <exodium.db>
Reads only; prints feature counts and a few small candidate games per feature.
"""
import re
import sqlite3
import sys
import zipfile
from collections import Counter, defaultdict

CONFS, DB = sys.argv[1], sys.argv[2]

FEATURES = {
    "voodoo": re.compile(r"^\s*voodoo\s*=\s*(?!false|none)\S", re.I | re.M),
    "glide": re.compile(r"^\s*glide\s*=\s*true", re.I | re.M),
    "imgmount": re.compile(r"^\s*@?imgmount\b", re.I | re.M),
    "mt32": re.compile(r"^\s*mididevice\s*=\s*mt32", re.I | re.M),
    "gus": re.compile(r"^\s*gus\s*=\s*true", re.I | re.M),
    "ipx": re.compile(r"^\s*ipx\s*=\s*true", re.I | re.M),
    "boot": re.compile(r"^\s*@?boot\b", re.I | re.M),
    "cycles_max": re.compile(r"^\s*cycles\s*=\s*max", re.I | re.M),
    "pcjr_tandy": re.compile(r"^\s*machine\s*=\s*(pcjr|tandy)", re.I | re.M),
}

db = sqlite3.connect(DB)
rows = db.execute(
    "select shortcode, title, download_size, dosbox_conf from games "
    "where torrent_source='eXoDOS' and shortcode is not null"
).fetchall()
by_short = {r[0]: r for r in rows}

counts = Counter()
examples = defaultdict(list)
keys = Counter()
total = 0
with zipfile.ZipFile(CONFS) as z:
    for name in z.namelist():
        if not name.lower().endswith("dosbox.conf"):
            continue
        parts = name.replace("\\", "/").split("/")
        short = parts[-2] if len(parts) >= 2 else ""
        if short not in by_short:
            continue
        total += 1
        text = z.read(name).decode("latin-1", "replace")
        for line in text.splitlines():
            m = re.match(r"^\s*([a-z0-9_]+)\s*=", line, re.I)
            if m:
                keys[m.group(1).lower()] += 1
        for feat, rx in FEATURES.items():
            if rx.search(text):
                counts[feat] += 1
                examples[feat].append(by_short[short])

print(f"confs matched to catalogue: {total} / {len(rows)}")
for feat in FEATURES:
    print(f"{feat:12} {counts[feat]:5}")
print("\nsmallest examples per feature:")
for feat in FEATURES:
    ex = sorted(examples[feat], key=lambda r: r[2] or 0)[:4]
    print(f"  {feat}: " + "; ".join(f"{r[1]} [{r[0]}] {(r[2] or 0)/2**20:.1f}MiB" for r in ex))
print("\nmost common conf keys:", ", ".join(f"{k}({v})" for k, v in keys.most_common(45)))
