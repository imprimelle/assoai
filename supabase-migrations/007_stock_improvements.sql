-- ============================================================
-- Migration 007: Améliorations table stock_sheets
--  1. Renommage des colonnes de dimensions (sémantique claire, préservant les données)
--  2. Ajout : epaisseur, created_by, created_by_name, section_history (audit)
-- ============================================================

-- 1. Renommage (idempotent, préserve les données)
--    largeur (=L) → longueur · hauteur (=l) → largeur · profondeur (=h) → hauteur
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_sheets' AND column_name='largeur')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_sheets' AND column_name='longueur') THEN
    ALTER TABLE public.stock_sheets RENAME COLUMN largeur TO longueur;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_sheets' AND column_name='hauteur')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_sheets' AND column_name='largeur') THEN
    ALTER TABLE public.stock_sheets RENAME COLUMN hauteur TO largeur;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_sheets' AND column_name='profondeur')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_sheets' AND column_name='hauteur') THEN
    ALTER TABLE public.stock_sheets RENAME COLUMN profondeur TO hauteur;
  END IF;
END $$;

-- 2. Nouvelles colonnes
ALTER TABLE public.stock_sheets ADD COLUMN IF NOT EXISTS epaisseur text;
ALTER TABLE public.stock_sheets ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.stock_sheets ADD COLUMN IF NOT EXISTS created_by_name text;
ALTER TABLE public.stock_sheets ADD COLUMN IF NOT EXISTS section_history jsonb NOT NULL DEFAULT '[]';

-- 3. Commentaires
COMMENT ON COLUMN public.stock_sheets.longueur IS 'Longueur (L) en cm';
COMMENT ON COLUMN public.stock_sheets.largeur IS 'Largeur (l) en cm';
COMMENT ON COLUMN public.stock_sheets.hauteur IS 'Hauteur (h) en cm — tables uniquement';
COMMENT ON COLUMN public.stock_sheets.epaisseur IS 'Épaisseur de la feuille (ex. 8 mm)';
COMMENT ON COLUMN public.stock_sheets.created_by IS 'UUID du créateur (human_contacts.id)';
COMMENT ON COLUMN public.stock_sheets.created_by_name IS 'Nom du créateur (dénormalisé pour affichage)';
COMMENT ON COLUMN public.stock_sheets.section_history IS 'Historique des changements de statut [{ts, sectionId, sectionNom, from, to, byName}]';
