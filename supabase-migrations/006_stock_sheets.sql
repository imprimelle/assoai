-- ============================================================
-- Migration 006: Table stock_sheets — gestion du stock de matériaux de découpe
-- Pour AssoAI — feuilles de vitre / plexiglass / miroir + sections découpées
-- À exécuter dans l'éditeur SQL Supabase (ou via Management API)
-- ============================================================

-- 1. Création de la table
CREATE TABLE IF NOT EXISTS public.stock_sheets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type        text NOT NULL DEFAULT 'feuille',  -- feuille | table_verre | table_bois | tableau
  nature      text NOT NULL DEFAULT 'vitre',    -- vitre | plexiglass | miroir
  nom         text,                             -- libellé optionnel
  largeur     numeric,                          -- L (cm)
  hauteur     numeric,                          -- l (cm)
  profondeur  numeric,                          -- h (cm) — pour les tables
  sections    jsonb NOT NULL DEFAULT '[]',      -- [{id,nom,nature,largeur,hauteur,statut}]
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. RLS — même pattern que materials (accès anon, politique unique ouverte)
ALTER TABLE public.stock_sheets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_sheets_all" ON public.stock_sheets;
CREATE POLICY "stock_sheets_all"
  ON public.stock_sheets
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 3. Commentaires
COMMENT ON TABLE public.stock_sheets IS
  'Stock de matériaux de découpe : feuilles de vitre/plexiglass/miroir et leurs sections découpées (statuts découpé/raboté/utilisé)';

-- 4. Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_stock_sheets_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stock_sheets_updated_at ON public.stock_sheets;
CREATE TRIGGER trg_stock_sheets_updated_at
  BEFORE UPDATE ON public.stock_sheets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_stock_sheets_updated_at();
