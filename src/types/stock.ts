// src/types/stock.ts
// Types du module Stock — gestion logistique des matériaux de découpe.

export type StockType = "feuille" | "table_verre" | "table_bois" | "tableau";
export type StockNature = "vitre" | "plexiglass" | "miroir";
export type SectionStatut = "decoupe" | "rabote" | "utilise";

export interface StockSection {
  id: string;
  nom: string; // ex. "Plateau", "Côté", "Miroir"
  nature: StockNature;
  largeur: number; // cm
  hauteur: number; // cm
  statut: SectionStatut;
}

export interface StockHistoryEvent {
  ts: string; // ISO
  sectionId: string;
  sectionNom: string;
  from: SectionStatut;
  to: SectionStatut;
  byName: string;
}

export interface StockSheet {
  id: string;
  type: StockType;
  nature: StockNature;
  nom: string | null;
  longueur: number | null; // L (cm)
  largeur: number | null; // l (cm)
  hauteur: number | null; // h (cm) — tables
  epaisseur: string | null; // ex. "8 mm"
  sections: StockSection[];
  section_history: StockHistoryEvent[];
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockSheetInput {
  type: StockType;
  nature: StockNature;
  nom: string | null;
  longueur: number | null;
  largeur: number | null;
  hauteur: number | null;
  epaisseur: string | null;
  sections: StockSection[];
  section_history?: StockHistoryEvent[];
  created_by?: string | null;
  created_by_name?: string | null;
}

// ── Référentiels UI ──────────────────────────────────────────

export interface StockTypeDef {
  id: StockType;
  label: string;
  short: string;
  description: string;
  // Champs de dimensions demandés à l'utilisateur
  fields: ("longueur" | "largeur" | "hauteur")[];
}

export const STOCK_TYPES: StockTypeDef[] = [
  {
    id: "feuille",
    label: "Feuilles",
    short: "Feuille",
    description: "Feuille de matière libre, sections saisies manuellement",
    fields: ["longueur", "largeur"],
  },
  {
    id: "table_verre",
    label: "Tables en verre",
    short: "Table verre",
    description: "5 sections de vitre + 1 miroir",
    fields: ["longueur", "largeur", "hauteur"],
  },
  {
    id: "table_bois",
    label: "Tables en bois",
    short: "Table bois",
    description: "1 section de vitre + 1 miroir",
    fields: ["longueur", "largeur", "hauteur"],
  },
  {
    id: "tableau",
    label: "Tableaux",
    short: "Tableau",
    description: "1 section de plexiglass + 1 miroir",
    fields: ["longueur", "largeur"],
  },
];

export interface StockNatureDef {
  id: StockNature;
  label: string;
  tint: string; // teinte du rectangle (fond), la couleur de statut reste dominante en bordure
}

export const STOCK_NATURES: StockNatureDef[] = [
  { id: "vitre", label: "Vitre", tint: "rgba(56,189,248,0.14)" },
  { id: "plexiglass", label: "Plexiglass", tint: "rgba(203,213,225,0.28)" },
  { id: "miroir", label: "Miroir", tint: "rgba(100,116,139,0.18)" },
];

export interface StatutDef {
  id: SectionStatut;
  label: string;
  fill: string; // couleur de remplissage du rectangle
  border: string; // classe Tailwind bordure
  badge: string; // classes Tailwind du badge
  solid: string; // classe Tailwind bouton plein (sélecteur)
}

export const SECTION_STATUTS: StatutDef[] = [
  {
    id: "decoupe",
    label: "Découpé",
    fill: "rgba(56,132,255,0.22)",
    border: "border-blue-400",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
    solid: "bg-blue-600 hover:bg-blue-700",
  },
  {
    id: "rabote",
    label: "Raboté",
    fill: "rgba(245,158,11,0.24)",
    border: "border-amber-400",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    solid: "bg-amber-500 hover:bg-amber-600",
  },
  {
    id: "utilise",
    label: "Utilisé",
    fill: "rgba(16,185,129,0.24)",
    border: "border-emerald-400",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    solid: "bg-emerald-600 hover:bg-emerald-700",
  },
];

export const STATUT_ORDER: SectionStatut[] = ["decoupe", "rabote", "utilise"];

// ── Helpers ──────────────────────────────────────────────────

export function nextStatut(current: SectionStatut): SectionStatut {
  const idx = STATUT_ORDER.indexOf(current);
  return STATUT_ORDER[(idx + 1) % STATUT_ORDER.length];
}

export function statutLabel(statut: SectionStatut): string {
  return SECTION_STATUTS.find((s) => s.id === statut)?.label ?? statut;
}

export function typeLabel(type: StockType): string {
  return STOCK_TYPES.find((t) => t.id === type)?.short ?? type;
}

export function natureLabel(nature: StockNature): string {
  return STOCK_NATURES.find((n) => n.id === nature)?.label ?? nature;
}

/** Parse une saisie de dimension en cm, tolère la virgule française. */
export function parseCm(value: string): number | null {
  if (!value) return null;
  const n = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// ── Composition auto des sections ────────────────────────────

const r2 = (n: number) => Math.round(n * 100) / 100;

export function generateSections(
  type: StockType,
  L: number,
  l: number,
  h?: number,
): StockSection[] {
  const mk = (
    nom: string,
    nature: StockNature,
    largeur: number,
    hauteur: number,
  ): StockSection => ({
    id: crypto.randomUUID(),
    nom,
    nature,
    largeur: r2(largeur),
    hauteur: r2(hauteur),
    statut: "decoupe",
  });

  switch (type) {
    case "table_verre":
      return [
        mk("Plateau", "vitre", l, L),
        mk("Côté", "vitre", l, h ?? 0),
        mk("Côté", "vitre", l, h ?? 0),
        mk("Face", "vitre", L, h ?? 0),
        mk("Face", "vitre", L, h ?? 0),
        mk("Miroir", "miroir", Math.max(0, l - 2), Math.max(0, L - 2)),
      ];
    case "table_bois":
      return [
        mk("Vitre", "vitre", Math.max(0, l - 2), Math.max(0, L - 2)),
        mk("Miroir", "miroir", Math.max(0, l - 2), Math.max(0, L - 2)),
      ];
    case "tableau":
      return [
        mk("Plexiglass", "plexiglass", L, l),
        mk("Miroir", "miroir", Math.max(0, L - 2), Math.max(0, l - 2)),
      ];
    case "feuille":
    default:
      return [];
  }
}
