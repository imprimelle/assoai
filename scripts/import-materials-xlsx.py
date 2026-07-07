#!/usr/bin/env python3
"""
Import du classeur XLSX matières premières AssoAI vers la table Supabase `materials`.
Une feuille = une catégorie. Colonnes variables selon la feuille (parsées par en-tête).
Idempotent : upsert sur (categorie, external_id).

Usage:
    python3 scripts/import-materials-xlsx.py [chemin_xlsx]
Défaut : /workspace/Matériaux.xlsx
"""
import json
import re
import sys
import urllib.request
import zipfile
import xml.etree.ElementTree as ET

SUPABASE_URL = "https://yqioyfuxviiximembver.supabase.co"
ANON_KEY = "sb_publishable_KZfNfiGqqAu2sKShjOys9Q_QtJyCKF7"
DEFAULT_XLSX = "/workspace/Matériaux.xlsx"

M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"

# Nom de feuille -> catégorie canonique (doit matcher MATERIAL_CATEGORIES du frontend)
SHEET_TO_CATEGORIE = {
    "Découpe": "Découpe",
    "Outillage": "Outillage",
    "Métal": "Métal",
    "Eclairage": "Éclairage",
    "Vinyles": "Vinyl",
}


def load_shared_strings(z):
    ss = []
    if "xl/sharedStrings.xml" in z.namelist():
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
        for si in root.findall(f"{M}si"):
            ss.append("".join(t.text or "" for t in si.iter(f"{M}t")))
    return ss


def col_letter(ref):
    return re.match(r"([A-Z]+)", ref).group(1)


def cell_value(c, ss):
    t = c.get("t")
    v = c.find(f"{M}v")
    if t == "s":
        return ss[int(v.text)] if v is not None else ""
    if t == "inlineStr":
        isn = c.find(f"{M}is")
        return "".join(x.text or "" for x in isn.iter(f"{M}t")) if isn is not None else ""
    return v.text if v is not None else ""


def read_sheet_rows(z, fname, ss):
    root = ET.fromstring(z.read(fname))
    rows = []
    for row in root.findall(f".//{M}row"):
        d = {}
        for c in row.findall(f"{M}c"):
            d[col_letter(c.get("r"))] = cell_value(c, ss)
        rows.append(d)
    return rows


def derive_soustype(categorie, materiau):
    m = (materiau or "").lower()
    if categorie == "Découpe":
        return materiau
    if categorie == "Éclairage":
        if m.startswith("led"):
            return "LED"
        if "transformateur" in m:
            return "Transformateur"
        return "Consommable"
    if categorie == "Métal":
        if "tube" in m:
            return "Tube"
        if "cornière" in m or "corniere" in m:
            return "Cornière"
        if "tôle" in m or "tole" in m:
            return "Tôle"
        return None
    if categorie == "Outillage":
        if any(k in m for k in ["entretoise", "vice", "cheville", "chaine", "typhon"]):
            return "Fixation"
        if "peinture" in m:
            return "Peinture"
        if any(k in m for k in ["colle", "diluant", "disque", "mèche", "meche"]):
            return "Consommable"
        return "Outil"
    if categorie == "Vinyl":
        return "Bâche" if "bâche" in m or "bache" in m else "Vinyle"
    return None


def parse_price(raw):
    if raw is None:
        return None
    digits = re.sub(r"[^\d]", "", str(raw))
    return int(digits) if digits else None


def parse_format_dims(fmt):
    if not fmt:
        return None, None
    m = re.search(r"([\d,\.]+)\s*m\s*/\s*([\d,\.]+)\s*m", fmt)
    if not m:
        return None, None
    f = lambda s: float(s.replace(",", "."))
    return f(m.group(1)), f(m.group(2))


def parse_colors(raw):
    if not raw:
        return []
    return [c.strip() for c in str(raw).split(",") if c.strip()]


def to_int(raw):
    if raw is None or raw == "":
        return None
    try:
        return int(float(raw))
    except (ValueError, TypeError):
        return None


def derive_unite(categorie, fmt, unite_col):
    if unite_col:
        u = unite_col.strip().lower()
        if "carr" in u:
            return "m²"
        return unite_col.strip()
    if categorie == "Découpe":
        return "plaque"
    if not fmt:
        return None
    lead = fmt.strip().split()[0].lower()
    return {
        "barre": "barre", "paquet": "paquet", "pièce": "pièce", "piece": "pièce",
        "pot": "pot", "détail": "mètre", "detail": "mètre",
    }.get(lead)


# Alias d'en-têtes -> champ interne
HEADER_ALIASES = {
    "matériel": "materiau", "materiel": "materiau",
    "épaisseur": "epaisseur", "epaisseur": "epaisseur",
    "format standard": "format_standard",
    "lowest cost": "cout_min",
    "higher cost": "cout_max", "highest cost": "cout_max",
    "usinage": "cout_usinage",
    "couleur disponibles": "couleurs", "couleurs": "couleurs",
    "unité": "unite", "unite": "unite",
    "puissance/volt": "puissance_volt",
    "etanchéité": "etancheite", "etancheite": "etancheite",
    "indications": "indications",
    "identifiant": "external_id",
}


def build_rows(z, ss):
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    rid_to_file = {rel.get("Id"): "xl/" + rel.get("Target").lstrip("/").replace("xl/", "")
                   for rel in rels}
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    out = []
    per_sheet = {}
    for s in wb.findall(f".//{M}sheet"):
        name = s.get("name")
        rid = s.get(f"{R}id")
        categorie = SHEET_TO_CATEGORIE.get(name, name)
        rows = read_sheet_rows(z, rid_to_file[rid], ss)
        if not rows:
            continue
        header = {letter: HEADER_ALIASES.get((val or "").strip().lower())
                  for letter, val in rows[0].items()}
        count = 0
        for r in rows[1:]:
            rec = {"categorie": categorie}
            for letter, field in header.items():
                if not field:
                    continue
                rec[field] = r.get(letter, "")
            materiau = (rec.get("materiau") or "").strip()
            if not materiau:
                continue
            largeur, hauteur = parse_format_dims(rec.get("format_standard"))
            row = {
                "external_id": to_int(rec.get("external_id")),
                "categorie": categorie,
                "sous_type": derive_soustype(categorie, materiau),
                "materiau": materiau,
                "epaisseur": (rec.get("epaisseur") or "").strip() or None,
                "format_standard": (rec.get("format_standard") or "").strip() or None,
                "largeur_std": largeur,
                "hauteur_std": hauteur,
                "cout_min": parse_price(rec.get("cout_min")),
                "cout_max": parse_price(rec.get("cout_max")),
                "cout_usinage": parse_price(rec.get("cout_usinage")),
                "unite": derive_unite(categorie, rec.get("format_standard"), rec.get("unite")),
                "couleurs": parse_colors(rec.get("couleurs")),
                "puissance_volt": (rec.get("puissance_volt") or "").strip() or None,
                "etancheite": (rec.get("etancheite") or "").strip() or None,
                "indications": (rec.get("indications") or "").strip() or None,
            }
            out.append(row)
            count += 1
        per_sheet[categorie] = count
    return out, per_sheet


def upsert(rows):
    body = json.dumps(rows).encode("utf-8")
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/materials?on_conflict=categorie,external_id",
        data=body, method="POST",
        headers={
            "Content-Type": "application/json",
            "apikey": ANON_KEY,
            "Authorization": f"Bearer {ANON_KEY}",
            "Prefer": "resolution=merge-duplicates,return=representation",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_XLSX
    z = zipfile.ZipFile(path)
    ss = load_shared_strings(z)
    rows, per_sheet = build_rows(z, ss)
    print("Lignes par catégorie :", per_sheet, "| total", len(rows))
    status, data = upsert(rows)
    print(f"HTTP {status} — {len(data)} lignes upsertées")


if __name__ == "__main__":
    main()
