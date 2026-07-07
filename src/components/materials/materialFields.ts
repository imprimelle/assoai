// src/components/materials/materialFields.ts
// Configuration de l'affichage ADAPTATIF des matériaux par catégorie.
// Basé sur l'analyse du taux de remplissage réel de la table `materials`.

import React from "react";
import { Scissors, Lightbulb, Wrench, Frame, Layers, Package } from "lucide-react";
import type { MaterialCatalogFormData } from "@/types/materialCatalog";

export type MaterialField = keyof MaterialCatalogFormData;

/**
 * Champs UNIVERSELS (renseignés dans toutes les catégories) — toujours affichés.
 * materiau + categorie sont gérés à part (en-tête du formulaire).
 */
export const UNIVERSAL_FIELDS: MaterialField[] = [
  "format_standard",
  "unite",
  "cout_min",
  "cout_max",
];

/**
 * Champs SPÉCIFIQUES par catégorie (en plus des universels).
 * Dérivé du taux de remplissage réel : on n'affiche que ce qui a du sens.
 */
export const CATEGORY_EXTRA_FIELDS: Record<string, MaterialField[]> = {
  "Découpe": ["epaisseur", "largeur_std", "hauteur_std", "cout_usinage", "couleurs"],
  "Éclairage": ["puissance_volt", "etancheite", "couleurs"],
  "Métal": ["epaisseur", "largeur_std", "hauteur_std"],
  "Outillage": ["couleurs", "indications"],
  "Vinyl": [],
};

/** Métadonnées d'un champ (label + rendu). */
export interface FieldMeta {
  label: string;
  placeholder?: string;
  kind: "text" | "number" | "colors";
}

export const FIELD_META: Record<string, FieldMeta> = {
  format_standard: { label: "Format standard", placeholder: "ex: Grande feuille - 4,20m/1,22m", kind: "text" },
  unite: { label: "Unité", placeholder: "ex: plaque, m², pièce", kind: "text" },
  cout_min: { label: "Coût min (FCFA)", placeholder: "0", kind: "number" },
  cout_max: { label: "Coût max (FCFA)", placeholder: "0", kind: "number" },
  cout_usinage: { label: "Usinage (FCFA)", placeholder: "0", kind: "number" },
  epaisseur: { label: "Épaisseur", placeholder: "ex: 5mm", kind: "text" },
  largeur_std: { label: "Largeur std (m)", placeholder: "4.20", kind: "number" },
  hauteur_std: { label: "Hauteur std (m)", placeholder: "1.22", kind: "number" },
  couleurs: { label: "Couleurs disponibles", placeholder: "Transparent, Rouge, Bleu", kind: "colors" },
  puissance_volt: { label: "Puissance / Volt", placeholder: "ex: 12V - 200 W", kind: "text" },
  etancheite: { label: "Étanchéité", placeholder: "ex: Etanche", kind: "text" },
  indications: { label: "Indications", placeholder: "ex: 25mm", kind: "text" },
};

/**
 * Sous-types par catégorie (options suggérées, saisie libre possible).
 * Pour Éclairage, le sous-type change les champs pertinents (voir extraFor).
 */
export const SUBTYPES: Record<string, string[]> = {
  "Découpe": ["Plexiglass", "Plexiglass miroir", "Forex", "Allucobond"],
  "Éclairage": ["LED", "Transformateur", "Consommable"],
  "Métal": ["Tube", "Cornière", "Tôle"],
  "Outillage": ["Fixation", "Consommable", "Peinture", "Outil"],
  "Vinyl": ["Vinyle", "Bâche"],
};

export function subtypesFor(categorie: string): string[] {
  return SUBTYPES[categorie] ?? [];
}

/** Champs spécifiques effectifs, raffinés par sous-type (surtout Éclairage). */
function extraFor(categorie: string, sousType?: string | null): MaterialField[] {
  if (categorie === "Éclairage") {
    switch (sousType) {
      case "Transformateur":
        return ["puissance_volt", "etancheite"];
      case "LED":
        return ["couleurs", "etancheite"];
      case "Consommable":
        return ["etancheite"];
      default:
        return ["puissance_volt", "etancheite", "couleurs"];
    }
  }
  return CATEGORY_EXTRA_FIELDS[categorie] ?? [];
}

/** Liste ordonnée des champs à afficher pour une catégorie (+ sous-type optionnel). */
export function fieldsForCategory(categorie: string, sousType?: string | null): MaterialField[] {
  const extra = extraFor(categorie, sousType);
  const specs = extra.filter((f) => f !== "cout_usinage");
  const hasUsinage = extra.includes("cout_usinage");
  return [
    "format_standard",
    "unite",
    ...specs,
    "cout_min",
    "cout_max",
    ...(hasUsinage ? (["cout_usinage"] as MaterialField[]) : []),
  ];
}

/** Thème couleur par catégorie — cohérent avec les sections matériaux du CDC. */
export interface CategoryStyle {
  badge: string;
  iconBg: string;
  gradient: string;
  softBg: string;
  chip: string;
  icon: React.ReactNode;
}

const ICON_CLS = "h-4 w-4";

export const CATEGORY_STYLE: Record<string, CategoryStyle> = {
  "Découpe": {
    badge: "bg-rose-100 text-rose-700",
    iconBg: "bg-rose-100 text-rose-600",
    gradient: "from-rose-500 to-rose-400",
    softBg: "bg-rose-50",
    chip: "bg-rose-50 text-rose-700",
    icon: React.createElement(Scissors, { className: ICON_CLS }),
  },
  "Éclairage": {
    badge: "bg-amber-100 text-amber-700",
    iconBg: "bg-amber-100 text-amber-600",
    gradient: "from-amber-500 to-amber-400",
    softBg: "bg-amber-50",
    chip: "bg-amber-50 text-amber-700",
    icon: React.createElement(Lightbulb, { className: ICON_CLS }),
  },
  "Outillage": {
    badge: "bg-emerald-100 text-emerald-700",
    iconBg: "bg-emerald-100 text-emerald-600",
    gradient: "from-emerald-500 to-emerald-400",
    softBg: "bg-emerald-50",
    chip: "bg-emerald-50 text-emerald-700",
    icon: React.createElement(Wrench, { className: ICON_CLS }),
  },
  "Métal": {
    badge: "bg-slate-200 text-slate-700",
    iconBg: "bg-slate-200 text-slate-600",
    gradient: "from-slate-500 to-slate-400",
    softBg: "bg-slate-50",
    chip: "bg-slate-100 text-slate-700",
    icon: React.createElement(Frame, { className: ICON_CLS }),
  },
  "Vinyl": {
    badge: "bg-violet-100 text-violet-700",
    iconBg: "bg-violet-100 text-violet-600",
    gradient: "from-violet-500 to-violet-400",
    softBg: "bg-violet-50",
    chip: "bg-violet-50 text-violet-700",
    icon: React.createElement(Layers, { className: ICON_CLS }),
  },
};

export const DEFAULT_STYLE: CategoryStyle = {
  badge: "bg-gray-100 text-gray-700",
  iconBg: "bg-gray-100 text-gray-600",
  gradient: "from-gray-500 to-gray-400",
  softBg: "bg-gray-50",
  chip: "bg-gray-100 text-gray-700",
  icon: React.createElement(Package, { className: ICON_CLS }),
};

export function styleFor(categorie: string): CategoryStyle {
  return CATEGORY_STYLE[categorie] ?? DEFAULT_STYLE;
}
