-- ============================================================
-- Migration 008: Modèle plat — la PIÈCE est l'unité, la FEUILLE est un lot de provenance
--  1. Renommage sections -> pieces
--  2. (Données) la transformation du jsonb (statut -> etat, aplatissement des sub_sections)
--     a été effectuée par script Python (une seule fois) — voir commit associé.
-- ============================================================

ALTER TABLE public.stock_sheets RENAME COLUMN sections TO pieces;

COMMENT ON COLUMN public.stock_sheets.pieces IS
  'Pièces de découpe [{id, nature, largeur, hauteur, quantite, etat}] — etat: disponible|utilise';
