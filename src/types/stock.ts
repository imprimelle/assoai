// src/types/stock.ts
// Module Stock — gestion logistique des matériaux de découpe.
// La PIÈCE est l'unité. La FEUILLE est un lot de provenance (d'où viennent les pièces + date).

export type StockNature = "vitre" | "plexiglass" | "miroir";
export type PieceEtat = "disponible" | "utilise";

export interface StockPiece {
  id: string;
  nature: StockNature;
  largeur: number; // cm
  hauteur: number; // cm
  quantite: number; // nb de pièces identiques
  etat: PieceEtat;
}

export interface StockHistoryEvent {
  ts: string; // ISO
  pieceLabel: string; // ex. "Vitre 70×50"
  action: string; // ex. "Marquée utilisée", "Divisée en 2 pièces", "Supprimée"
  byName: string;
}

export interface StockSheet {
  id: string;
  nature: StockNature;
  nom: string | null; // ex. "Feuille 330×240"
  longueur: number | null; // dims de la feuille (cm)
  largeur: number | null;
  epaisseur: string | null;
  pieces: StockPiece[];
  section_history: StockHistoryEvent[];
  created_by: string | null;
  created_by_name: string | null;
  created_at: string; // date de fabrication / provenance
  updated_at: string;
}

export interface StockSheetInput {
  nature: StockNature;
  nom: string | null;
  longueur: number | null;
  largeur: number | null;
  epaisseur: string | null;
  pieces: StockPiece[];
  section_history?: StockHistoryEvent[];
  created_by?: string | null;
  created_by_name?: string | null;
}

// ── Référentiels UI ──────────────────────────────────────────

export interface StockNatureDef {
  id: StockNature;
  label: string;
  tint: string;
}

export const STOCK_NATURES: StockNatureDef[] = [
  { id: "vitre", label: "Vitre", tint: "rgba(56,189,248,0.14)" },
  { id: "plexiglass", label: "Plexiglass", tint: "rgba(203,213,225,0.28)" },
  { id: "miroir", label: "Miroir", tint: "rgba(100,116,139,0.18)" },
];

export const EPAISSEUR_OPTIONS = [
  "2 mm",
  "3 mm",
  "4 mm",
  "5 mm",
  "6 mm",
  "8 mm",
  "10 mm",
  "12 mm",
];

// ── Helpers ──────────────────────────────────────────────────

export function natureLabel(nature: StockNature): string {
  return STOCK_NATURES.find((n) => n.id === nature)?.label ?? nature;
}

/** Parse une saisie de dimension en cm, tolère la virgule française. */
export function parseCm(value: string): number | null {
  if (!value) return null;
  const n = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Nom auto-généré d'une feuille (nomenclature : dimensions). */
export function generateSheetName(L: number | null, l: number | null): string {
  const dims = [L, l]
    .filter((v): v is number => v != null && Number.isFinite(v))
    .map((v) => String(v))
    .join("×");
  return dims ? `Feuille ${dims}` : "Feuille";
}

/** Libellé lisible d'une pièce. */
export function pieceLabel(piece: StockPiece): string {
  return `${natureLabel(piece.nature)} ${piece.largeur}×${piece.hauteur}`;
}
