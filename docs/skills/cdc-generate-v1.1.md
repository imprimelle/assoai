---
name: cdc-generate
description: Générer un cahier des charges complet (multi-enseignes) avec sections matériaux, équipe, et dimensions. Intègre l'analyse visuelle des images d'enseigne. Persister dans Supabase. Utilisé par Brico.
version: 1.1.0
---

# CDC Generate

## ⚠️ RÈGLE ABSOLUE
Le numéro `cdcNumero` t'est FOURNI dans le prompt. Utilise-le tel quel. Interdit d'en inventer.
Si `commande_id` est fourni dans le prompt → inclus-le dans le CDC.

## Workflow complet

1. **Analyser la commande** : items[], client, deliveryAddress
2. **🔍 Analyser les images** (si image_url présente) : `vision_analyze(image_url)` pour détecter type, couleurs LED, matériaux
3. **Charger les règles** : `skill_view('manufacturing-rules')` → guidage LED/couleurs
4. **Valider les dimensions** : `skill_view('enseigne-dimensions')`
5. **Calculer les matériaux** : `skill_view('material-calculator')` + `execute_code` pour calculs exacts
6. **Structurer le CDC** : assembler le JSON final
7. **Persister** : le système persiste automatiquement dans `messages`

## Structure du CDC

```json
{
  "titre": "Cahier des Charges — Nom Projet",
  "cdcNumero": "CDC-2026-001",
  "commande_id": "CMD-2026-004",
  "statut": "Brouillon",
  "enseignes": [{
    "id": "uuid",
    "nom": "Enseigne façade 4m×1.5m",
    "produits": [{"id":"uuid","nom":"Caisson Lumineux","image_url":"https://..."}],
    "details": {
      "image_url": "https://...",
      "dimensions": {"largeur": 400, "hauteur": 150, "profondeur": 15},
      "technique": {
        "type_structure": "Cadre aluminium",
        "method_fabrication": "Découpe CNC + assemblage"
      },
      "analyse_visuelle": {
        "type_detecte": "Caisson lumineux",
        "couleur_led": "Blanc froid 6000K",
        "couleur_facade": "Blanc laiteux",
        "materiaux_visibles": ["Aluminium", "Plexiglass"],
        "complexite": "Simple - rectangle"
      }
    },
    "materiauxSections": {
      "Découpe": [{"id":"uuid","nom":"Plexiglass blanc laiteux 5mm 4m/1.5m","quantite":1,"unite":"plaque","reference":"[Découpe-1]"}],
      "Éclairage": [{"id":"uuid","nom":"Bande LED Samsung 12V 6000K","quantite":12,"unite":"mètres","reference":"[Éclairage-1]"}],
      "Métal": [{"id":"uuid","nom":"Profilé alu 40x40mm","quantite":4,"unite":"barres","reference":"[Métal-1]"}],
      "Outillage": [{"id":"uuid","nom":"Kit visserie inox","quantite":1,"unite":"lot","reference":"[Outillage-1]"}],
      "Vinyl": [{"id":"uuid","nom":"Vinyle blanc 4m/1.5m","quantite":1,"unite":"rouleau","reference":"[Vinyl-1]"}]
    }
  }],
  "equipe": [
    {"id":"uuid","nom":"Kouadio","role":"Découpeur"},
    {"id":"uuid","nom":"Traoré","role":"Assembleur"},
    {"id":"uuid","nom":"Koné","role":"Éclairagiste"},
    {"id":"uuid","nom":"Diallo","role":"Finisseur"}
  ],
  "deliveryAddress": {"label":"Abidjan, Cocody","lat":5.3599,"lng":-4.0083},
  "version": 1,
  "is_latest": true
}
```

## Règles de nommage des matériaux

Quand tu nommes un matériau dans `materiauxSections`, suis ce format :
`[Type] [Couleur si pertinent] [Épaisseur/Dimension] [Dimensions calculées]`

Exemples :
- `"Plexiglass blanc laiteux 5mm 4m/1.5m"` ← couleur + épaisseur + dimensions
- `"Bande LED Samsung 12V 6000K"` ← température de couleur
- `"Vinyle rouge transparent 4m/1.5m"` ← couleur + type
- `"Profilé alu 40x40mm"` ← dimensions standard

## Sections obligatoires (5 uniquement)
Découpe, Éclairage, Outillage, Métal, Vinyl — ne pas inventer d'autres clés.

## Règles de fabrication
Charger depuis Supabase : `products.manufacturing_rules.description_complete`
Utiliser le GUIDAGE COULEURS LED du skill `manufacturing-rules` pour choisir la bonne référence.
