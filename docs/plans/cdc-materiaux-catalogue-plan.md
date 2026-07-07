# Plan — Édition matériaux CDC + Catalogue Matériaux lié

> Basé sur le code réel d'AssoAI (`chat-flow-templates-main`). Chaque phase est testable et déployable indépendamment. Ordre = risque croissant.

## ✅ Validation (auto-audit du plan vs code réel)

Plan revu contre le code. Faisabilité confirmée, avec 4 ajustements intégrés ci-dessous :

| # | Vérifié | Verdict / Ajustement |
|---|---------|----------------------|
| A | `smartSearch` (`utils/productSearch.ts`) réutilisable pour matériaux ? | ❌ **Non** — scoré sur `product.variants`/`name`/`description`. ✅ On réutilise `SearchableDropdown` (générique `<T extends DropdownItem>`, avec `filterFn` optionnel) + filtre natif label/subtitle, ou un mini `materialSearch` basé sur `normalizeText`/`tokenize` (déjà exportés). **Ne pas dépendre de `smartSearch`.** |
| B | Composant `Select` dispo ? | ✅ `ui/select.tsx` (shadcn/Radix) existe. ⚠️ Mais `MaterialCard` est une carte *click-to-collapse* avec `stopPropagation` → le portail Radix peut mal interagir. **Phase 1 : garder le `<select>` natif** (comme l'existant, risque min). Réserver shadcn `Select`/multi-select aux formulaires de la page catalogue. |
| C | Dossier `supabase/migrations` ? | ❌ Absent → DDL via API (`supabase-ddl-autonomy`). ✅ `useProducts` fait create/update via **fetch PostgREST brut (URL + ANON_KEY en dur)** et read via client supabase. `useMaterials` **copie ce pattern exact**. |
| D | Emplacement nav `/products` ? | ✅ HomePage `cardDefs` (l.72, objet `{id,title,description,icon,path,color}`) **et** `TopBar.secondaryNavItems` (l.74, `{to,icon,label}`). Ajouter l'entrée « Matériaux » aux **deux**. |
| E | Table/hook `materials` déjà présents ? | ✅ Aucune collision — `useMaterials`, table `materials`, `MaterialCatalog` sont neufs. |
| F | Barrel export produits (`components/products/index.ts`) ? | ✅ Confirmé → créer `components/materials/index.ts` sur le même modèle. |

## 0. Constat (code réel)

| Élément | Fichier | Problème |
|--------|---------|----------|
| Édition d'un matériau | `src/components/templates/shared/MaterialCard.tsx` (481 l.) | Carte lourde, tout derrière collapse ; **Unité = texte libre** (l.257) ; **Couleur & Épaisseur = `<select>` codés en dur** (l.362-399) ; **bug** `value="1mm"` / label `"3 mm"` (l.394-396) → écrit une mauvaise valeur. |
| Où on édite | `EnseigneSection.tsx` (l.325-335) | Édition **par enseigne** uniquement. La section « Matériaux » globale (`CahierDesChargesTemplate.tsx` l.334) est `isEditable={false}`. |
| Type | `src/types/material.ts` | `MaterialItem` : `unite?`, `couleur?`, `epaisseur?` en `string` libre. Aucun lien vers un catalogue. |
| Catalogue produits (existant) | `useProducts.ts`, `pages/ProductCatalog.tsx`, `components/products/*`, `ProductSuggestions.tsx`, route `/products` (`App.tsx` l.342) | Table `products` (variants, manufacturing_rules, billing_rules). **Ne contient PAS les matières premières.** |
| Source matériaux | `Copie_de_PROD_Matériaux_-_Découpe.csv` | Onglet « Découpe » : Plexiglass 3/5/8mm, Plexiglass miroir, Forex 5/8/10/18mm, Allucobond 5mm. Colonnes prix FCFA + format standard + couleurs dispo + identifiant. |

**Décision d'architecture** : créer une **table `materials` dédiée** (matières premières : épaisseur, format, coût, couleurs), *distincte* de `products` (produits finis signalétique). On calque strictement les patterns existants (`useProducts` → `useMaterials`, `ProductCatalog` → `MaterialCatalog`, `ProductSuggestions` → `MaterialSuggestions`).

---

## Phase 1 — Correctifs immédiats de l'édition (0 dépendance DB, faible risque)

Objectif : rendre l'édition « unité + détails » simple et fiable **sans** attendre le catalogue.

1. **Créer `src/constants/materials.ts`** — listes canoniques partagées :
   - `UNITES = ["plaque","m²","mètre","ml","unité","lot","barre","rouleau","kg","tube"]`
   - `COULEURS = ["Transparent","Blanc","Noir","Rouge","Bleu","Jaune","Vert","Violet","Orange","Rose","Marron","Doré","Blanc chaud","Blue ice"]` (dédupliqué, casse corrigée)
   - `EPAISSEURS = ["3mm","5mm","8mm","10mm","18mm"]` (valeur == label, corrige le bug)
2. **`MaterialCard.tsx`** (⚠️ garder `<select>` **natif**, pas shadcn — cf. audit B) :
   - Remplacer l'`<Input>` Unité (l.256-262) par un `<select>` natif alimenté par `UNITES`. **Préserver la valeur existante** : si `item.unite` n'est pas dans `UNITES`, l'injecter comme `<option>` sélectionnée (+ option « Autre… » gardant la saisie libre) → aucune perte de donnée sur les CDC déjà remplis (« mètres », « panneaux »…).
   - Remplacer les `<select>` Couleur (l.365-380) et Épaisseur (l.388-397) par des maps sur `COULEURS` / `EPAISSEURS` → **supprime les valeurs codées en dur et le bug label/valeur** (`value="1mm"`/label `"3 mm"`).
   - Optionnel UX : afficher les champs Unité/Qté en ligne visible même carte repliée.
3. **Rendre la vue globale « Matériaux » cohérente** (`CahierDesChargesTemplate.tsx`) : soit garder read-only (agrégation), soit brancher les callbacks vers l'enseigne concernée. Recommandé Phase 1 : garder read-only, tout l'édition passe par `EnseigneSection` (déjà fonctionnel).

**Tests** : `npx tsc --noEmit` ; ouvrir un CDC, éditer un matériau, vérifier que couleur/épaisseur/unité se sauvent correctement (plus de « 1mm/3mm »).
**Livrable** : commit + `./scripts/deploy-safe.sh`.

---

## Phase 2 — Table `materials` + seed CSV (backend)

1. **DDL Supabase** (via pattern `supabase-ddl-autonomy`) — table `materials` :
   ```sql
   create table if not exists materials (
     id uuid primary key default gen_random_uuid(),
     external_id int,               -- "Identifiant" du CSV
     categorie text not null,       -- 'Découpe','Éclairage','Métal','Vinyl','Outillage'
     materiau text not null,        -- 'Plexiglass','Forex','Allucobond'
     epaisseur text,                -- '3mm'
     format_standard text,          -- 'Grande feuille - 4,20m/1,22m'
     largeur_std numeric,           -- 4.20 (m)
     hauteur_std numeric,           -- 1.22 (m)
     cout_min numeric,              -- 85000
     cout_max numeric,              -- 90000
     cout_usinage numeric,          -- 15000
     unite text default 'plaque',
     couleurs text[] default '{}',  -- ['Transparent'] | ['Rouge','Bleu',...]
     image_url text,
     created_at timestamptz default now(),
     updated_at timestamptz default now()
   );
   ```
   RLS : calquer la policy ouverte de `products` (auditée dans `supabase-rls-audit`).
2. **Script d'import CSV** `scripts/import-materials-csv.py` (one-shot, idempotent sur `external_id`) :
   - Parse `Fcfa85000` → `85000`.
   - Parse `Grande feuille - 4,20m/1,22m` → `largeur_std=4.20, hauteur_std=1.22`.
   - Split `Couleurs disponibles` sur `,` → `text[]`.
   - `categorie = 'Découpe'` pour ce CSV (les autres onglets suivront).
   - Upsert PostgREST (`Prefer: resolution=merge-duplicates` sur `external_id`).
3. **Vérif** : `select count(*) from materials` == nb lignes CSV ; contrôle d'un échantillon (Plexiglass miroir → couleurs multiples).

**Tests** : requête PostgREST de lecture, comptage, échantillon.

---

## Phase 3 — Page Catalogue Matériaux `/materials` (frontend, miroir de Produits)

1. **`src/types/materialCatalog.ts`** : `interface MaterialCatalogEntry` (miroir du schéma).
2. **`src/hooks/useMaterials.ts`** : copier `useProducts.ts` **à l'identique dans son pattern** — read via client supabase (`.from('materials').select('*')`), mais **create/update via `fetch` PostgREST brut** avec `SUPABASE_URL` + `ANON_KEY` en dur (comme `useProducts` l.156-171 / 243-265), delete via client. Search `ilike` sur `materiau`, filtre `categorie`.
3. **`src/components/materials/`** : `MaterialCatalogList.tsx`, `MaterialCatalogCard.tsx`, `MaterialCatalogModal.tsx`/`MaterialCatalogForm.tsx` (calqués sur `components/products/*`). Champs éditables : matériau, catégorie, épaisseur, format, coûts, unité, couleurs (multi), image.
4. **`src/pages/MaterialCatalog.tsx`** : calqué sur `ProductCatalog.tsx` (recherche debounce, filtre catégorie, CRUD modal).
5. **Route** dans `App.tsx` (après le bloc `/products`, l.349) :
   ```tsx
   <Route path="/materials" element={<RequireAuth persistentSessionId={persistentSessionId}><MaterialCatalog /></RequireAuth>} />
   ```
6. **Entrées menu** (les deux, cf. audit D) :
   - `HomePage.tsx` `cardDefs` (près de l.72) : ajouter `{ id:"materiaux", title:"Matériaux", description:"Catalogue des matières premières", icon:<Boxes/>, path:"/materials", color:"bg-amber-100 text-amber-700" }`.
   - `TopBar.tsx` `secondaryNavItems` (l.74) : ajouter `{ to:"/materials", icon:<Boxes className="h-4 w-4"/>, label:"Matériaux" }`.

**Tests** : naviguer `/materials`, CRUD complet, recherche + filtre catégorie.

---

## Phase 4 — Lier le catalogue au CDC (le cœur de la demande)

1. **Étendre `MaterialItem`** (`src/types/material.ts`) — champs optionnels rétrocompatibles :
   ```ts
   material_id?: string;      // FK vers materials.id
   format_standard?: string;
   cout_unitaire?: number;    // snapshot coût au moment du choix
   ```
2. **`src/components/shared/MaterialSuggestions.tsx`** : réutilise **`SearchableDropdown`** (générique) — **PAS `ProductSuggestions`/`smartSearch`** (cf. audit A). Items construits depuis `useMaterials` (`label = "{materiau} {epaisseur}"`, `subtitle = "{format_standard} • {couleurs.join(', ')}"`). Filtrage : filtre natif label/subtitle du `SearchableDropdown` (suffisant), ou `filterFn` maison via `normalizeText`/`tokenize`. `onSelect` retourne l'entrée catalogue complète.
3. **`MaterialSection.tsx`** : ajouter au-dessus de la liste un `MaterialSuggestions` (visible si `isEditable`). Élargir les props avec **`onAddFromCatalog?: (section: string, preset: Partial<MaterialItem>) => void`** (nouveau callback, laisse `onAddItem(section)` intact pour l'ajout vide via le bouton `+`). À la sélection → préremplit un `MaterialItem` :
   - `nom` = `{materiau} {epaisseur}`, `unite` = catalogue, `epaisseur`, `reference` = `external_id`, `largeur/hauteur` = format std, `image_url`, `material_id`, `couleur` restreinte aux `couleurs` dispo.
4. **`MaterialCard.tsx`** : si `item.material_id` présent, la liste **Couleur** est restreinte aux couleurs du matériau catalogue (fallback `COULEURS`), l'épaisseur est préremplie. Affichage d'un badge « 📦 catalogue ».
5. **`EnseigneSection.addItem`** (l.75-85) : ajouter une fonction sœur `addItemFromCatalog(section, preset)` qui fusionne le `preset` dans le `MaterialItem` créé, câblée au nouveau `onAddFromCatalog` de `MaterialSection`. `addItem(section)` (ajout vide) reste inchangé.

**Tests** : dans un CDC en édition, ouvrir une enseigne → « Choisir depuis le catalogue » → sélectionner Plexiglass 5mm → la carte se remplit (unité=plaque, épaisseur=5mm, couleurs restreintes, dimensions 2,44×1,22). Sauver, rouvrir, vérifier la persistance (`template_data`).

---

## Phase 5 — Finitions & alignement agent (optionnel)

- Aligner le prompt Brico / skill `cdc-generate` pour référencer les `external_id` du catalogue quand il génère `materiauxSections` (traçabilité prix).
- Migration douce : script one-shot mappant les `MaterialItem` existants vers `material_id` par nom+épaisseur.
- Afficher un coût matière estimé dans le CDC (somme `cout_unitaire × quantite`).

---

## Récapitulatif des fichiers touchés

**Créés** : `src/constants/materials.ts`, `src/types/materialCatalog.ts`, `src/hooks/useMaterials.ts`, `src/components/materials/*`, `src/pages/MaterialCatalog.tsx`, `src/components/shared/MaterialSuggestions.tsx`, `scripts/import-materials-csv.py`, table SQL `materials`.
**Modifiés** : `MaterialCard.tsx`, `MaterialSection.tsx`, `EnseigneSection.tsx`, `src/types/material.ts`, `App.tsx`, menu/HomePage.

## Ordre de livraison conseillé
Phase 1 (quick win édition) → Phase 2 (DB+seed) → Phase 3 (page catalogue) → Phase 4 (liaison CDC) → Phase 5 (finitions).
