"""Build a tiny stand-in for eXo's German magazine add-on, to test the
Reading Room without the real multi-GB pack: an outer zip holding a STORED
inner zip that holds one PDF at the entry path the catalogue expects.
Usage: python3 -I make-fake-pack.py <out-dir> <inner-zip-name> <entry-path>"""
import io
import sys
import zipfile
from pathlib import Path

out_dir, inner_name, entry = sys.argv[1:4]
pdf = (b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
       b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
       b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Contents 4 0 R"
       b"/Resources<</Font<</F1 5 0 R>>>>>>endobj\n"
       b"4 0 obj<</Length 52>>stream\nBT /F1 18 Tf 40 100 Td (Reading Room test) Tj ET\nendstream endobj\n"
       b"5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n"
       b"trailer<</Root 1 0 R>>\n%%EOF\n")
inner = io.BytesIO()
with zipfile.ZipFile(inner, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr(entry, pdf)
outer = Path(out_dir) / Path(sys.argv[4] if len(sys.argv) > 4 else "eXoDOS_GLP_Addonpack_MagazinesGLP.zip").name
with zipfile.ZipFile(outer, "w", zipfile.ZIP_STORED) as z:
    z.writestr(inner_name, inner.getvalue())
print(outer, outer.stat().st_size)
