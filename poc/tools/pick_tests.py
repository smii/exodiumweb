"""Pick PoC test games that actually exist on the NAS, one per feature.

Usage: python3 -I pick_tests.py <eXoDOS_configs.zip> <exodium.db> <nas_zip_listing.txt>
Prints `shortcode|zip name|feature|MiB` lines (smallest available per feature).
"""
import re
import sqlite3
import sys
import zipfile

CONFS, DB, LISTING = sys.argv[1:4]
present = {l.strip() for l in open(LISTING, encoding="utf-8", errors="replace") if l.strip()}

db = sqlite3.connect(DB)
games = {}
for short, title, size, app in db.execute(
    "select shortcode, title, download_size, application_path from games where torrent_source='eXoDOS'"
):
    zipname = app.replace("\\", "/").split("/")[-1][:-4] + ".zip"
    if zipname in present:
        games[short] = (title, size or 0, zipname)

FEATURES = [
    ("plain-ega", r"^\s*@?call run", r"(imgmount|mididevice\s*=\s*mt32|ipx\s*=\s*true|^\s*@?boot)"),
    ("cd-imgmount", r"^\s*@?imgmount\b", None),
    ("mt32", r"^\s*mididevice\s*=\s*mt32", None),
    ("gus", r"^\s*gus\s*=\s*true", None),
    ("ipx", r"^\s*ipx\s*=\s*true", None),
    ("boot-disk", r"^\s*@?boot\b", None),
    ("pcjr-tandy", r"^\s*machine\s*=\s*(pcjr|tandy)", None),
    ("3dfx", r"^\s*voodoo_bilinear_filtering\s*=\s*true", None),
]

confs = {}
with zipfile.ZipFile(CONFS) as z:
    for n in z.namelist():
        if n.endswith("/dosbox.conf"):
            confs[n.split("/")[-2]] = z.read(n).decode("latin-1", "replace")

picked = set()
for name, want, avoid in FEATURES:
    cands = []
    for short, (title, size, zipname) in games.items():
        text = confs.get(short, "")
        if re.search(want, text, re.I | re.M) and not (avoid and re.search(avoid, text, re.I | re.M)):
            # prefer something recognisable but small: >= 0.5 MiB unless nothing else
            cands.append((size < 0.5 * 2**20, size, short, zipname, title))
    cands.sort()
    for _, size, short, zipname, title in cands:
        if short not in picked:
            picked.add(short)
            print(f"{short}|{zipname}|{name}|{size/2**20:.1f}|{title}")
            break
    else:
        print(f"-|-|{name}|-|none available")
