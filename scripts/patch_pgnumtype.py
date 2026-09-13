"""Patch post-generation: retire les <w:pgNumType/> vides (compat WPS)."""
import zipfile, shutil, re, sys

SRC = "/home/z/my-project/download/Cahier_des_Charges_Sofascore_Fantasy_Coach.docx"
TMP = SRC + ".tmp"

with zipfile.ZipFile(SRC, "r") as zin:
    items = zin.infolist()
    data = {i.filename: zin.read(i.filename) for i in items}

doc = data.get("word/document.xml", b"").decode("utf-8")
before = doc.count("<w:pgNumType/>")
doc = doc.replace("<w:pgNumType/>", "")
data["word/document.xml"] = doc.encode("utf-8")

with zipfile.ZipFile(TMP, "w", zipfile.ZIP_DEFLATED) as zout:
    for i in items:
        zout.writestr(i, data[i.filename])
shutil.move(TMP, SRC)
print(f"pgNumType vides supprimes: {before}")
