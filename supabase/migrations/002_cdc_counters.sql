-- ============================================================
-- Migration 002: Ajout CDC aux compteurs atomiques
-- Pour AssoAI — identifiant CDC-YYYY-NNN
-- À exécuter dans l'éditeur SQL Supabase
-- ============================================================

-- Met à jour la fonction next_document_number pour supporter CDC
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
    WHEN 'facture'            THEN 'F'
    WHEN 'devis'              THEN 'D'
    WHEN 'commande'           THEN 'CMD'
    WHEN 'cahier_des_charges' THEN 'CDC'
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

-- Re-grant (la fonction a été recréée)
GRANT EXECUTE ON FUNCTION next_document_number(text) TO anon, authenticated, service_role;

-- Test
SELECT next_document_number('cahier_des_charges');  -- → CDC-2026-001
SELECT next_document_number('cahier_des_charges');  -- → CDC-2026-002
