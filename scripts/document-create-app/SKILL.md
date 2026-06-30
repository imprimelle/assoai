---
name: document-create-app
description: Créer une facture, un devis ou une commande dans Supabase via l'App AssoAI. Utilisé par Wari (et PM/Brico) depuis l'interface web — PAS par le Communicateur WhatsApp.
version: 1.0.0
metadata:
  updated: "2026-06-27"
  changes: "v1.0.0: Extraits du document-create v2.3.0 — sections hors Communicateur uniquement. Skill dédié à l'app."
---

# Document Create (App AssoAI)

## ⚠️ RÈGLE FONDAMENTALE — Le serveur pré-alloue, tu utilises

Le serveur Express (`hermes-api.ts` v3) pré-alloue les numéros via le RPC `next_document_number()` et te les injecte dans le prompt sous `⚠️⚠️⚠️ CONTRAINTE ABSOLUE — NUMÉRO RÉSERVÉ`. Tu reçois le numéro déjà attribué.

**Tu ne dois PAS appeler le RPC toi-même** quand la contrainte est présente.

Si la section `⚠️⚠️⚠️ CONTRAINTE ABSOLUE` est ABSENTE du prompt (mode autonome, ex: cron), alors tu peux appeler le RPC :
```bash
curl -s "https://yqioyfuxviiximembver.supabase.co/rest/v1/rpc/next_document_number" \
  -H "apikey: sb_publishable_KZfNfiGqqAu2sKShjOys9Q_QtJyCKF7" \
  -H "Authorization: Bearer sb_pub...KF7" \
  -H "Content-Type: application/json" \
  -d '{"p_doc_type": "facture"}'
```
Types : `facture`→F-YYYY-NNN, `devis`→D-YYYY-NNN, `commande`→CMD-YYYY-NNN, `cahier_des_charges`→CDC-YYYY-NNN

### ✏️ MODIFICATION → Réutilise le numéro
Si « 📋 CE DOCUMENT T'EST FOURNI EN CONTEXTE » apparaît dans le prompt :
- **N'appelle PAS** le RPC
- **Réutilise** le numéro du document fourni
- **Incrémente** la version (v1→v2)
- `is_latest: true`

### 🔗 DÉRIVATION → Appelle le RPC pour le nouveau type
- Facture→Commande : `linked_facture_id` = factureNumero source
- Commande→CDC : `commande_id` = commandeNumero source

## Structure JSON

UN JSON valide — pas de markdown, pas de ```json```.

## Mode "template" — FACTURE
```json
{
  "mode": "template",
  "templateType": "facture",
  "textFallback": "Voici la facture.",
  "data": {
    "factureNumero": "F-2026-015",
    "dateEmission": "2026-06-27",
    "client": {
      "nom": "Entreprise X",
      "adresse": "Abidjan, Cocody",
      "telephone": "+225 01 02 03 04"
    },
    "details": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "description": "Caisson lumineux LED",
        "quantite": 2,
        "prixUnitaire": 150000,
        "sous_total": 300000
      }
    ],
    "total": 300000,
    "statut": "En attente",
    "version": 1,
    "is_latest": true
  }
}
```

## Mode "template" — DEVIS
```json
{
  "mode": "template",
  "templateType": "devis",
  "textFallback": "Voici le devis.",
  "data": {
    "devisNumero": "D-2026-001",
    "dateEmission": "2026-06-27",
    "validiteJours": 30,
    "client": {
      "nom": "Entreprise X",
      "adresse": "Abidjan, Cocody"
    },
    "details": [
      {
        "id": "550e8400-...",
        "description": "Enseigne dibond",
        "quantite": 1,
        "prixUnitaire": 250000,
        "sous_total": 250000
      }
    ],
    "total": 250000,
    "version": 1,
    "is_latest": true
  }
}
```

## Mode "template" — COMMANDE
```json
{
  "mode": "template",
  "templateType": "commande",
  "textFallback": "Voici la commande.",
  "data": {
    "commandeNumero": "CMD-2026-001",
    "dateCommande": "2026-06-27",
    "client": {
      "nom": "Entreprise X",
      "adresse": "Abidjan, Cocody",
      "telephone": "+225 01 02 03 04"
    },
    "items": [
      {
        "id": "550e8400-...",
        "nom": "Totem lumineux",
        "quantite": 1,
        "prixUnitaire": 450000,
        "sous_total": 450000
      }
    ],
    "details": [
      {"note": "Livraison express"}
    ],
    "total": 450000,
    "statut": "En cours",
    "linked_facture_id": "F-2026-005",
    "version": 1,
    "is_latest": true
  }
}
```

## Champs obligatoires

- **Facture** : factureNumero, dateEmission, client{nom,adresse}, details[], total, version, is_latest
- **Devis** : devisNumero, dateEmission, validiteJours, client, details[], total, version, is_latest
- **Commande** : commandeNumero, client, items[], total, statut, version, is_latest

## Rappel des différences Facture vs Commande

- FACTURE : details[].description (pas "nom")
- DEVIS : details[].description + validiteJours
- COMMANDE : items[].nom (pas "description") + linked_facture_id + details[].{note,option,delaiLivraison,montantAvance} + recu_image_url

## Règles métier

- Prix : toujours depuis le catalogue via product-search
- Total = somme des sous_totaux (ne pas arrondir)
- Quantités et prix sont des **nombres** (pas des chaînes)
- Chaque id doit être un UUID unique

## Pièges

- Nombres = numbers (pas strings)
- ids = UUID uniques
- is_latest = boolean true
- version = 1 pour création, >1 pour modification
- total = number (pas string), somme exacte de tous les sous_totaux
- details[] pour facture/devis, items[] pour commande — ne pas confondre

## Stockage

Les documents sont persistés dans la table `messages` (colonne `template_data` JSONB).
