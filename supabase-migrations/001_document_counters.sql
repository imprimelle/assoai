-- ============================================================
-- Migration: document_counters + next_document_number
-- Pour AssoAI — génération atomique d'identifiants document
-- À exécuter dans l'éditeur SQL Supabase
-- ============================================================

-- 1. Table des compteurs (un par type × année)
CREATE TABLE IF NOT EXISTS document_counters (
  doc_type   text NOT NULL,
  year       int NOT NULL,
  last_num   int NOT NULL DEFAULT 0,
  PRIMARY KEY (doc_type, year)
);

-- 2. Fonction atomique : réserve et retourne le prochain numéro
CREATE OR REPLACE FUNCTION next_document_number(p_doc_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year int := EXTRACT(YEAR FROM NOW())::int;
  v_next int;
  v_prefix text;
BEGIN
  v_prefix := CASE p_doc_type
    WHEN 'facture'  THEN 'F'
    WHEN 'devis'    THEN 'D'
    WHEN 'commande' THEN 'CMD'
    ELSE 'UNK'
  END;

  INSERT INTO document_counters (doc_type, year, last_num)
  VALUES (p_doc_type, v_year, 1)
  ON CONFLICT (doc_type, year)
  DO UPDATE SET last_num = document_counters.last_num + 1
  RETURNING last_num INTO v_next;

  RETURN v_prefix || '-' || v_year || '-' || LPAD(v_next::text, 3, '0');
END;
$$;

-- 3. Permissions
GRANT EXECUTE ON FUNCTION next_document_number(text) TO anon, authenticated, service_role;

-- 4. Test
SELECT next_document_number('facture');  -- → F-2026-001
SELECT next_document_number('facture');  -- → F-2026-002
SELECT next_document_number('devis');    -- → D-2026-001
