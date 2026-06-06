# Plan d'implémentation — Gestion des Images AssoAI

**Date :** 6 Juin 2026
**Statut actuel :** 🔴 Pipeline d'images **non fonctionnel** — RLS bloque l'upload

---

## 1. Diagnostic complet

### 🔴 Problème Bloquant — RLS Storage

Le bucket Supabase `images` **existe** (5 buckets : images, videos, audio, documents, other) mais :

```
UPLOAD avec anon key → 403 "new row violates row-level security policy"
```

Le client Supabase (`src/integrations/supabase/client.ts`) utilise la **anon key** (`VITE_SUPABASE_ANON_KEY`). Cette clé n'a pas la permission d'écrire dans le bucket storage car **les politiques RLS ne sont pas configurées**.

**Conséquence :** le composant `ImageUpload.tsx` échoue silencieusement (il catch l'erreur et affiche l'icône rouge `AlertTriangle`). Aucun fichier n'est uploadé dans le bucket (0 fichiers actuellement).

### 🔴 Aucun produit n'a d'images

| Champ | État |
|-------|------|
| `main_image_url` | `null` sur tous les produits |
| `gallery_images` | `[]` vide sur tous les produits |
| `variants[].image_url` | Absent sur tous les variants |

### ✅ Code frontend correct

| Composant | État | Détail |
|-----------|------|--------|
| `ImageUpload.tsx` | ✅ | Upload vers `images/public/{uuid}.ext`, catch erreur propre |
| `ImageGallery.tsx` | ✅ | Carrousel, preview plein écran, download, badges "Variante" |
| `ProductSuggestions.tsx` | ✅ | Mappe `main_image_url` → `image_url` pour factures/commandes/CDC |
| `CommandeTemplate.tsx` | ✅ | `handleProductSelection` → `item.image_url`, `DetailItemForm` avec `ImageUpload` |
| `EnseigneSection.tsx` | ✅ | Miniature produit + `ImageUpload` pour image projet enseigne |
| `FactureTemplate.tsx` | ✅ | `DetailItemForm` avec `image_url` supporté |
| `pdfGenerator.ts` | ✅ | Images incluses dans PDFs commande (`item.image_url`) et CDC (`enseigne.details.image_url`) |
| `dataInjector.ts` | ✅ | (Design choice) N'injecte pas les images dans les prompts IA — les images sont ajoutées manuellement après génération |

### 🟡 Anomalies existantes

| # | Problème | Impact |
|---|----------|--------|
| 1 | **DevisTemplate n'a PAS de ProductSuggestions** (pitfall #16) | Impossible de mapper un produit du catalogue → devis (ni prix, ni image) |
| 2 | **ProductSuggestions → Facture** : le mapping `product.description` → `detail.description` écrase la description, mais le `DetailItemForm` dans FactureTemplate n'utilise pas `image_url` explicitement (c'est dans le type `DetailItemFormProps` mais pas connecté au formulaire) | Les images sélectionnées ne sont pas sauvegardées dans la facture |
| 3 | **L'IA ne génère pas d'`image_url`** (design) | Normal — les images viennent du catalogue via ProductSuggestions |

---

## 2. Plan d'implémentation

### Phase 1 — 🔴 Fix RLS Storage (bloquant)

**Objectif :** Permettre l'upload d'images avec la anon key.

#### Étape 1.1 — Créer les politiques RLS

Exécuter ce SQL dans l'**éditeur SQL Supabase** (SQL Editor) :

```sql
-- ============================================================
-- POLITIQUES RLS pour le bucket "images" (Supabase Storage)
-- ============================================================

-- 1. Autoriser la lecture publique de tous les fichiers
CREATE POLICY "images_public_read"
ON storage.objects
FOR SELECT
USING (bucket_id = 'images');

-- 2. Autoriser l'insertion (upload) pour tout le monde (anon + authenticated)
CREATE POLICY "images_public_insert"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'images');

-- 3. Autoriser la mise à jour pour les propriétaires (optionnel — pour renommer/supprimer)
CREATE POLICY "images_owner_update"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'images' AND owner = auth.uid())
WITH CHECK (bucket_id = 'images' AND owner = auth.uid());

-- 4. Autoriser la suppression pour les propriétaires
CREATE POLICY "images_owner_delete"
ON storage.objects
FOR DELETE
USING (bucket_id = 'images' AND owner = auth.uid());
```

> ⚠️ **Note** : Cloudflare bloque `api.supabase.com` depuis le VPS Hostinger → les migrations DDL ne peuvent pas être exécutées via Management API. Le SQL doit être exécuté manuellement dans l'éditeur SQL de la console Supabase.

#### Étape 1.2 — Vérifier les politiques existantes

Si les politiques existent déjà mais sont restrictives, lister d'abord :

```sql
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage';
```

Puis adapter.

#### Étape 1.3 — Tester l'upload

Après application des politiques, tester avec un petit fichier :

```bash
# Via ImageUpload dans l'app, ou via curl
curl -X POST "https://yqioyfuxviiximembver.supabase.co/storage/v1/object/images/public/test.png" \
  -H "apikey: sb_publishable_KZfNf..." \
  -H "Authorization: Bearer sb_publishable_KZfNf..." \
  -F "file=@test.png"
```

---

### Phase 2 — 🟡 Connecter les images au flux produit

**Objectif :** Peupler `main_image_url` et `gallery_images` dans la table `products`.

#### Étape 2.1 — Vérifier les colonnes DB

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'products'
  AND column_name IN ('main_image_url', 'gallery_images', 'variants');
```

Les colonnes existent déjà (vérifiées via PostgREST).

#### Étape 2.2 — Tester le cycle complet

1. Ouvrir AssoAI → Catalogue (`/products`)
2. Éditer un produit → ajouter une image principale via `ImageGallery`
3. Vérifier que l'image s'affiche dans la `ProductCard`
4. Créer une commande → sélectionner le produit via `ProductSuggestions` → l'image doit apparaître dans l'article

---

### Phase 3 — 🟡 Fix DevisTemplate (ProductSuggestions manquant)

**Objectif :** Ajouter le sélecteur de produit dans l'édition de devis (comme dans FactureTemplate/CommandeTemplate).

#### Modifications nécessaires

1. `DevisTemplate.tsx` :
   - Importer `ProductSuggestions`
   - Ajouter le composant au-dessus de chaque `DetailItemForm` en mode édition
   - Créer `handleProductSelection` comme dans `CommandeTemplate`
   - Mapper `product.description` → `detail.description`, `product.prixUnitaire` → `detail.prixUnitaire`, `product.image_url` → `detail.image_url`

2. `DetailItemForm.tsx` : (déjà OK, supporte `image_url`)

---

### Phase 4 — 🟡 Vérifier FactureTemplate image_url

**Objectif :** S'assurer que `image_url` est correctement sauvegardé dans les détails de facture.

#### À vérifier

1. `FactureTemplate.tsx` : est-ce que `handleProductSelection` passe `image_url` au `DetailItemForm` ?
2. Le type `DetailItem` (dans `template-data.ts`) n'a pas de champ `image_url` — il faut l'ajouter ou utiliser la version étendue de `DetailItemFormProps`.

---

### Phase 5 — Ajouter les images dans les prompts IA (optionnel)

**Objectif :** L'IA pourrait mentionner les images disponibles dans le catalogue.

#### Modification

Dans `dataInjector.ts`, ajouter `main_image_url` au `.select()` et l'inclure dans `formatForWari()` :

```ts
.select("name, description, main_image_url, variants, manufacturing_rules")

// Dans formatForWari:
const img = p.main_image_url ? `📷 Image: ${p.main_image_url}` : "";
```

> ⚠️ Attention au coût en tokens : les URLs sont longues. Peser le bénéfice.

---

## 3. Résumé des fichiers à modifier

| Phase | Fichier | Action |
|-------|---------|--------|
| 1 | Supabase SQL Editor | Créer 4 politiques RLS storage |
| 3 | `src/components/templates/DevisTemplate.tsx` | Ajouter ProductSuggestions |
| 4 | `src/components/templates/FactureTemplate.tsx` | Vérifier/corriger le mapping `image_url` |
| 4 | `src/types/template-data.ts` | Ajouter `image_url?` à `DetailItem` (si absent) |
| 5 | `src/services/dataInjector.ts` | Optionnel : injecter `main_image_url` |

---

## 4. Ordre de priorité

1. **🔴 Phase 1** — RLS Storage (bloquant, empêche tout upload)
2. **🟡 Phase 3** — DevisTemplate ProductSuggestions (incohérence UX)
3. **🟡 Phase 4** — FactureTemplate image_url (vérification)
4. **Phase 2** — Test bout-en-bout
5. **Phase 5** — Injection IA (nice-to-have)
