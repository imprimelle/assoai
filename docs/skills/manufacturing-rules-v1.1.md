---
name: manufacturing-rules
description: Consulter les règles de fabrication d'Imprimelle depuis Supabase. Utilisé par Brico pour élaborer les cahiers des charges. Contient les 6 types d'enseignes standards avec leurs matériaux, opérations, formules, et variantes LED/couleurs.
version: 1.1.0
---

# Manufacturing Rules

## Déclencheur
Brico doit générer un CDC ou répondre à une question technique sur la fabrication.

## Règles par type d'enseigne

Les règles sont stockées dans la table `products`, champ `manufacturing_rules` (JSONB) :
```json
{
  "description_complete": "Processus de fabrication complet...",
  "exemples": "CDC types pour différents scénarios..."
}
```

## Requête Supabase

```bash
ANON_KEY="sb_publishable_KZfNfiGqqAu2sKShjOys9Q_QtJyCKF7"
curl -s "https://yqioyfuxviiximembver.supabase.co/rest/v1/products?select=name,manufacturing_rules" \
  -H "apikey: ${ANON_KEY}" | jq '.[] | select(.manufacturing_rules != null)'
```

## Les 6 types d'enseignes standards
1. **Caisson lumineux** — Aluminium + plexiglass + LED
2. **Enseigne dibond** — Dibond 3mm + vinyle + structure alu
3. **Lettres 3D** — PVC expansé + finition peinture/laminé
4. **Totem** — Acier galvanisé + dibond + éclairage solaire
5. **Panneau LED** — Acrylique + profilés + bandeau LED
6. **Enseigne néon** — Tube néon + support + transformateur

## Règles de calcul
- Surface (m²) = largeur × hauteur en mètres
- LED nécessaires = surface × densité (150 LEDs/m² standard)
- Coût matériaux = somme(quantité × prix_unitaire)
- Marge atelier = 20% du coût matériaux

---

## 🎨 GUIDAGE COULEURS LED — Basé sur l'analyse visuelle

Quand tu analyses une image via `vision_analyze()`, utilise ce tableau pour choisir le bon type de LED :

| Couleur observée | Température | Type de LED à commander | Référence catalogue |
|-----------------|-------------|------------------------|---------------------|
| Blanc très chaud / doré | 2700-3000K | Bande LED Samsung 12V 3000K | LED-SAM-WW-12V |
| Blanc neutre | 4000-4500K | Bande LED Samsung 12V 4000K | LED-SAM-NW-12V |
| Blanc froid / bleuté | 6000-6500K | Bande LED Samsung 12V 6000K | LED-SAM-CW-12V |
| Rouge | — | Bande LED Samsung 12V Rouge | LED-SAM-R-12V |
| Bleu | — | Bande LED Samsung 12V Bleu | LED-SAM-B-12V |
| Vert | — | Bande LED Samsung 12V Vert | LED-SAM-G-12V |
| RGB / Multicolore | — | Bande LED RGB 12V + Contrôleur | LED-RGB-12V-CTRL |
| Non visible / éteinte | — | Par défaut : blanc froid 6000K | LED-SAM-CW-12V |

**Règle :** Si l'image montre l'enseigne ALLUMÉE, la couleur des LED est UNE INFORMATION CRITIQUE. Ne la devine pas — décris ce que tu vois.

## 🎨 GUIDAGE COULEUR FAÇADE — Impact sur les matériaux

| Couleur façade | Type de vinyle/plexi | Notes |
|---------------|---------------------|-------|
| Blanc | Vinyle blanc vierge ou Plexiglass blanc laiteux | Standard, bonne diffusion LED |
| Noir / foncé | Vinyle noir mat ou Plexiglass fumé | Attention : réduit la luminosité LED de ~30% |
| Rouge | Vinyle rouge transparent | Filtre la lumière — prévoir LED plus puissantes |
| Transparent | Plexiglass transparent + vinyle imprimé | Pour les enseignes avec graphisme visible |
| Miroir / Réflectif | Vinyle miroir ou Plexiglass miroir | Effet jour/nuit — LED puissantes recommandées |

## 🏗️ GUIDAGE STRUCTURE — Basé sur l'analyse visuelle

| Observation visuelle | Type de structure | Matériau |
|---------------------|------------------|----------|
| Cadre fin (< 5cm visible) | Cadre aluminium | Profilé alu 40×40mm |
| Cadre épais (> 10cm) | Structure acier | Tube carré acier 40×40mm |
| Pas de cadre visible (fixation murale directe) | Support mural | Équerres acier + chevilles |
| Sur pied / autoportante | Totem ou structure au sol | Acier galvanisé + platine |

## Références
- `references/fabrication-rules.md` (skill assoai-development)
- Sections UNIQUEMENT : Découpe, Éclairage, Outillage, Métal, Vinyl
