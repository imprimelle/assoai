#!/usr/bin/env python3
"""
Import du CSV matières premières AssoAI vers la table Supabase `materials`.
Idempotent : upsert sur `external_id` (resolution=merge-duplicates).

Usage:
    python3 scripts/import-materials-csv.py [chemin_csv] [--categorie Découpe]

Le CSV doit avoir les colonnes :
    Matériel, épaisseur, Format standard, Lowest Cost, Higher Cost,
    Usinage, Couleur disponibles, Identifiant
"""
import csv
import json
import re
import sys
import urllib.request

SUPABASE_URL = "https://yqioyfuxviiximembver.supabase.co"
ANON_KEY = "sb_publishable_KZfNfiGqqAu2sKShjOys9Q_QtJyCKF7"

DEFAULT_CSV = "/workspace/Copie_de_PROD_Matériaux_-_Découpe.csv"


def parse_price(raw: str):
    """'Fcfa85000' -> 85000 ; '' -> None"""
    if not raw:
        return None
    digits = re.sub(r"[^\d]", "", raw)
    return int(digits) if digits else None


def parse_format(fmt: str):
    """'Grande feuille - 4,20m/1,22m' -> (4.20, 1.22)"""
    if not fmt:
        return None, None
    m = re.search(r"([\d,\.]+)\s*m\s*/\s*([\d,\.]+)\s*m", fmt)
    if not m:
        return None, None
    to_f = lambda s: float(s.replace(",", "."))
    return to_f(m.group(1)), to_f(m.group(2))


def parse_colors(raw: str):
    if not raw:
        return []
    return [c.strip() for c in raw.split(",") if c.strip()]


def build_row(r: dict, categorie: str):
    largeur, hauteur = parse_format(r.get("Format standard", ""))
    ext = r.get("Identifiant", "").strip()
    return {
        "external_id": int(ext) if ext.isdigit() else None,
        "categorie": categorie,
        "materiau": (r.get("Matériel") or "").strip(),
        "epaisseur": (r.get("épaisseur") or "").strip() or None,
        "format_standard": (r.get("Format standard") or "").strip() or None,
        "largeur_std": largeur,
        "hauteur_std": hauteur,
        "cout_min": parse_price(r.get("Lowest Cost", "")),
        "cout_max": parse_price(r.get("Higher Cost", "")),
        "cout_usinage": parse_price(r.get("Usinage", "")),
        "unite": "plaque",
        "couleurs": parse_colors(r.get("Couleur disponibles", "")),
    }


def upsert(rows):
    body = json.dumps(rows).encode("utf-8")
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/materials?on_conflict=external_id",
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "apikey": ANON_KEY,
            "Authorization": f"Bearer {ANON_KEY}",
            "Prefer": "resolution=merge-duplicates,return=representation",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    csv_path = args[0] if args else DEFAULT_CSV
    categorie = "Découpe"
    for a in sys.argv[1:]:
        if a.startswith("--categorie"):
            categorie = a.split("=", 1)[1] if "=" in a else "Découpe"

    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = [build_row(r, categorie) for r in reader]
    rows = [r for r in rows if r["materiau"]]

    print(f"Lignes parsées : {len(rows)}")
    status, data = upsert(rows)
    print(f"HTTP {status} — {len(data)} lignes upsertées")
    for d in data[:3]:
        print("  •", d.get("materiau"), d.get("epaisseur"), "| couleurs:", d.get("couleurs"),
              "|", d.get("largeur_std"), "x", d.get("hauteur_std"))


if __name__ == "__main__":
    main()
