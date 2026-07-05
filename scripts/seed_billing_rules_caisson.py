#!/usr/bin/env python3
"""
Insert billing_rules for Caisson Lumineux rectangle.
Run AFTER applying migration 005_billing_rules.sql.
"""
import os, json, urllib.request, urllib.error

SUPABASE_URL = "https://yqioyfuxviiximembver.supabase.co"
ANON_KEY = os.environ.get("VITE_SUPABASE_ANON_KEY", "")

# Charger depuis .env.local si dispo
env_paths = [
    "/workspace/chat-flow-templates-main/.env.local",
    "/docker/hermes-webui-693e/.env",
]
for p in env_paths:
    if os.path.exists(p):
        with open(p) as f:
            for line in f:
                if line.startswith("VITE_SUPABASE_ANON_KEY="):
                    ANON_KEY = line.split("=", 1)[1].strip()
                    break

if not ANON_KEY:
    print("❌ ANON_KEY introuvable")
    exit(1)

BILLING_RULES = {
    "description_complete": """# Tarification Caisson Lumineux rectangle

## Formule de prix

Prix Final = (Coût Matériaux + Main d'Œuvre) × Marge Commerciale

### 1. Coût des Matériaux

| Matériau | Unité | Prix unitaire (FCFA) | Formule |
|----------|-------|---------------------|--------|
| Plexiglass transparent 3mm | m² | 18 000 | L × H |
| Vinyle transparent imprimé | m² | 12 000 | L × H |
| Vinyle blanc vierge | m² | 4 000 | L × H |
| Tube carré 40mm (box métal) | barre 5,8m | 8 500 | 6×(L+H)÷5,8 ↑ |
| Tôle (box métal) | feuille 2m² | 22 000 | Surface÷2 ↑ |
| Cornière aluminium | barre 5,8m | 6 000 | 2×(L+H)÷5,8 ↑ |
| Forex 8mm fond (box forex) | m² | 15 000 | (L-0,01)×(H-0,01) |
| Bande coffrage forex 8mm | bande 1,2m | 1 200 | 4×(L+H)÷1,2 ↑ |
| Paquet LED Samsung 100 LEDs | paquet | 35 000 | Surface×0,5 ↑ |
| Transformateur 200W | unité | 25 000 | selon puissance |
| Transformateur 300W | unité | 35 000 | selon puissance |
| Transformateur 400W | unité | 45 000 | selon puissance |
| Consommables (colle, silicone, visserie) | forfait | 5 000 | fixe |

↑ = arrondi à l'entier supérieur

### 2. Main d'Œuvre

| Opération | Temps estimé | Taux horaire |
|-----------|-------------|-------------|
| Découpe plexiglass | 30 min | 5 000 F/h |
| Fabrication box | 1h30 (métal) / 1h (forex) | 5 000 F/h |
| Assemblage + pose LED | 1h | 5 000 F/h |
| Pose vinyles | 30 min | 5 000 F/h |
| Finitions + contrôle | 30 min | 5 000 F/h |

MO totale ≈ 3h30 (box métal) ou 3h (box forex)

### 3. Marges

| Marge | Taux |
|-------|------|
| Marge atelier | +20% du coût matériaux |
| Marge commerciale | +35% du coût total |

### 4. Règles conditionnelles

- Si Surface ≥ 1,05 m² → Box MÉTALLIQUE
- Si Surface < 1,05 m² → Box FOREX
- Puissance transfo = nb_paquets_LED × 100W

### 5. Prix plancher

Prix minimum = 80 000 FCFA""",

    "exemples": """## Exemple 1 — Caisson 1m × 70cm (Surface = 0,70 m² → Box FOREX)

Matériaux : 106 200 F | MO : 17 500 F | Marge atelier : 21 240 F | Marge com : 50 729 F
→ Prix Final = 196 000 FCFA

## Exemple 2 — Caisson 2m × 1m (Surface = 2,0 m² → BOX MÉTALLIQUE)

Matériaux : 201 000 F | MO : 20 000 F | Marge atelier : 40 200 F | Marge com : 91 420 F
→ Prix Final = 353 000 FCFA

## Exemple 3 — Caisson 3m × 1m (Surface = 3,0 m² → BOX MÉTALLIQUE)

Matériaux : 300 500 F | MO : 20 000 F | Marge atelier : 60 100 F | Marge com : 133 210 F
→ Prix Final = 514 000 FCFA

## Grille de prix rapide

| 1m×70cm = 196 000 | 1m×1m = 248 000 | 1,5m×70cm = 290 000 |
| 2m×70cm = 310 000 | 2m×1m = 353 000 | 3m×1m = 514 000 |""",
}

# Trouver l'ID du Caisson Lumineux rectangle
req = urllib.request.Request(
    f"{SUPABASE_URL}/rest/v1/products?name=eq.Caisson%20Lumineux%20rectangle&select=id",
    headers={"apikey": ANON_KEY}
)
resp = urllib.request.urlopen(req)
products = json.loads(resp.read())

if not products:
    print("❌ Produit 'Caisson Lumineux rectangle' non trouvé")
    exit(1)

product_id = products[0]["id"]
print(f"✅ Produit trouvé: {product_id}")

# Mettre à jour billing_rules
update_req = urllib.request.Request(
    f"{SUPABASE_URL}/rest/v1/products?id=eq.{product_id}",
    data=json.dumps({"billing_rules": BILLING_RULES}).encode(),
    headers={
        "apikey": ANON_KEY,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    },
    method="PATCH",
)
try:
    urllib.request.urlopen(update_req)
    print("✅ billing_rules insérées avec succès !")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"❌ Erreur: {body}")
